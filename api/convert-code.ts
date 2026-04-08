/**
 * Vercel Serverless Function — AI Code Converter
 *
 * POST /api/convert-code
 * Body: { code: string, sourceLanguage: string, targetLanguage: string }
 *
 * Returns: { convertedCode: string, targetLanguage: string, notes: string }
 *
 * Required env vars (same as generate-explanation):
 *   OPENAI_API_KEY    — when AI_PROVIDER is "openai" (default)
 *   ANTHROPIC_API_KEY — when AI_PROVIDER is "claude"
 *   AI_PROVIDER       — optional, "openai" | "claude"
 */

const SYSTEM_PROMPT =
  'You are an expert polyglot programmer. Convert code between programming languages precisely. ' +
  'Preserve the original logic, variable names where idiomatic, and comments. ' +
  'The "notes" field MUST be written in Hebrew. Code itself stays in the target language as normal. ' +
  'Respond with valid JSON only — no markdown fences, no extra text, just the raw JSON object.';

function buildConvertPrompt(
  code: string,
  sourceLanguage: string,
  targetLanguage: string,
): string {
  return `Convert the following ${sourceLanguage} code to ${targetLanguage}.

Rules:
- Preserve all logic and intent exactly.
- Use idiomatic ${targetLanguage} patterns (e.g. list comprehensions in Python, arrow functions in JS).
- Keep variable names as close to the original as possible unless naming conventions differ.
- Preserve comments, adapting them if the syntax differs.
- "notes": Only include this if there are meaningful conversion differences worth knowing (e.g. "Python has no static types — type hints added", "null vs None"). Keep it to 1-2 sentences max. Return empty string if nothing notable. Write in Hebrew.

Source code (${sourceLanguage}):
\`\`\`
${code}
\`\`\`

Return ONLY this exact JSON, nothing else:
{
  "convertedCode": "the full converted code as a single string",
  "targetLanguage": "${targetLanguage}",
  "notes": "..."
}`;
}

async function callOpenAI(
  code: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<Record<string, string>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildConvertPrompt(code, sourceLanguage, targetLanguage) },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${text}`);
  }

  const data = await resp.json() as any;
  const raw: string = data.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(raw);
}

async function callClaude(
  code: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<Record<string, string>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: buildConvertPrompt(code, sourceLanguage, targetLanguage) },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Claude error ${resp.status}: ${text}`);
  }

  const data = await resp.json() as any;
  const raw: string = data.content?.[0]?.text ?? '{}';
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(cleaned);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { requireAuth } = await import('./lib/requireAuth.js');
  const userId = await requireAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  let body: { code?: string; sourceLanguage?: string; targetLanguage?: string };
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { code, sourceLanguage, targetLanguage } = body;

  if (!code?.trim())           return res.status(400).json({ error: 'code is required' });
  if (!sourceLanguage?.trim()) return res.status(400).json({ error: 'sourceLanguage is required' });
  if (!targetLanguage?.trim()) return res.status(400).json({ error: 'targetLanguage is required' });

  if (sourceLanguage.trim().toLowerCase() === targetLanguage.trim().toLowerCase()) {
    return res.status(400).json({ error: 'Source and target languages must be different' });
  }

  const provider = process.env.AI_PROVIDER ?? 'openai';

  try {
    const result =
      provider === 'claude'
        ? await callClaude(code, sourceLanguage, targetLanguage)
        : await callOpenAI(code, sourceLanguage, targetLanguage);

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI call failed';
    console.error('[convert-code]', message);
    return res.status(502).json({ error: message });
  }
}
