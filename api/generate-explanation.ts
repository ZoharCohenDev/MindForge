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
  'You are a senior software engineer writing concise, practical learning notes. ' +
  'Your output is code-first: let code do most of the teaching. ' +
  'Respond with valid JSON only — no markdown fences, no extra text, just the raw JSON object.';

function buildUserPrompt(topicTitle: string, topicPath?: string): string {
  const pathContext = topicPath ? `\nFull topic path: ${topicPath}` : '';
  return `Create a sharp, practical learning note for: "${topicTitle}"${pathContext}

Rules:
- "title": A clear, specific title (max 8 words).
- "explanation": 2–4 SHORT paragraphs. Be direct and practical. Skip intros like "In this note…". Add a real-world analogy ONLY if it genuinely clarifies the concept — never force one. Focus on WHY it matters and HOW it works.
- "code": This is the most important field. Write practical, well-commented, teaching-oriented code.
  - If the topic is a broad concept (e.g. "Data Structures", "Sorting Algorithms", "Design Patterns"), include MULTIPLE labeled examples covering the key subtypes/implementations in a single code block, separated by clear comments.
  - If the topic is specific (e.g. "Binary Search"), write one focused, complete example with edge cases shown.
  - Use Python unless another language is clearly more idiomatic for the topic.
  - Return an empty string ONLY if code genuinely does not apply (e.g. a soft concept like "Agile Methodology").
- "formula": A key formula or notation if relevant (e.g. "O(log n)", "y = wx + b"). Return empty string if not applicable.

Return ONLY this JSON, nothing else:
{
  "title": "...",
  "explanation": "...",
  "code": "...",
  "formula": "..."
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

  // Vercel auto-parses JSON bodies; guard against string form just in case.
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
