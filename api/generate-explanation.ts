/**
 * Vercel Serverless Function — AI Explanation Generator
 *
 * Supports OpenAI (default) and Anthropic Claude.
 *
 * Required env vars in Vercel → Project Settings → Environment Variables:
 *   OPENAI_API_KEY    — when AI_PROVIDER is "openai" (default)
 *   ANTHROPIC_API_KEY — when AI_PROVIDER is "claude"
 *   AI_PROVIDER       — optional, "openai" | "claude" (defaults to "openai")
 */

const SYSTEM_PROMPT =
  'You are a concise ML/CS educator. Write short, crystal-clear learning notes with real examples. ' +
  'All explanatory text (explanation, name, value fields) MUST be written in Hebrew. Keep code, formulas, and expression symbols in their original form. ' +
  'Respond with valid JSON only — no markdown fences, no extra text, just the raw JSON object.';

function buildUserPrompt(topicTitle: string, topicPath?: string): string {
  const pathContext = topicPath ? `\nFull topic path: ${topicPath}` : '';
  return `Create a sharp learning note for: "${topicTitle}"${pathContext}

Style guide — follow this exact pattern:

explanation example for "Dot Product":
"An operation between two vectors that multiplies corresponding elements and sums the result, returning a single number.\n\nIn Machine Learning:\nDot product is used to combine features with weights.\n\nExample:\ny = w · x + b\n\nThis is the core of linear regression and neural networks."

Rules for each field:
- "title": Max 7 words. Clear and specific. Write in Hebrew.
- "explanation": SHORT — 1 sentence definition, then context in ML/CS (1–2 sentences), then a tiny concrete Example block showing the formula/idea. End with 1 sentence on why it matters. No fluff. Write entirely in Hebrew.
- "code": Practical, well-commented Python (or the most natural language). For broad topics, show multiple labeled examples. For specific topics, one complete focused example. Return "" only for non-technical concepts. Code and comments stay in English.
- "formula": The key mathematical expression (e.g. "y = w · x + b"). Use Unicode math symbols (·, σ, μ, Σ, √, ², ∂, ∇). Return "" if not applicable.
- "sub_expressions": An array of the symbols/parts used in the formula. Each entry has:
  - "expression": the symbol or sub-formula (e.g. "w", "μ", "σ²", "Σᵢ")
  - "name": short label in Hebrew (e.g. "משקולות", "ממוצע", "שונות")
  - "value": brief meaning in Hebrew (e.g. "פרמטרים נלמדים", "ממוצע כל הערכים", "פיזור הנתונים")
  Include entries for EVERY symbol in the formula. If formula is "", return [].
  For statistics/math: always expand μ (mean), σ (std), Σ (sum), etc.

Return ONLY this JSON:
{
  "title": "...",
  "explanation": "...",
  "code": "...",
  "formula": "...",
  "sub_expressions": [{"expression": "...", "name": "...", "value": "..."}]
}`;
}

async function callOpenAI(
  topicTitle: string,
  topicPath?: string,
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
        { role: 'user', content: buildUserPrompt(topicTitle, topicPath) },
      ],
      temperature: 0.6,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${text}`);
  }

  const data = await resp.json() as any;
  const raw: string = data.choices?.[0]?.message?.content ?? '{}';;
  return JSON.parse(raw);
}

async function callClaude(
  topicTitle: string,
  topicPath?: string,
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
        { role: 'user', content: buildUserPrompt(topicTitle, topicPath) },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Claude error ${resp.status}: ${text}`);
  }

  const data = await resp.json() as any;
  const raw: string = data.content?.[0]?.text ?? '{}';;
  // Claude may wrap JSON in markdown fences despite the prompt; strip them.
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
  let body: { topicTitle?: string; topicPath?: string };
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { topicTitle, topicPath } = body;
  if (!topicTitle?.trim()) {
    return res.status(400).json({ error: 'topicTitle is required' });
  }

  const provider = process.env.AI_PROVIDER ?? 'openai';

  try {
    const result =
      provider === 'claude'
        ? await callClaude(topicTitle, topicPath)
        : await callOpenAI(topicTitle, topicPath);

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI call failed';
    console.error('[generate-explanation]', message);
    return res.status(502).json({ error: message });
  }
}
