import { SYSTEM_PROMPT } from './prompts';

/**
 * Call OpenAI chat completions with JSON mode.
 * The system prompt enforces the curriculum-architect persona.
 */
export async function callOpenAI<T>(prompt: string): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as any;
  const raw: string = data.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(raw) as T;
}
