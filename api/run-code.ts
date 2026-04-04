/**
 * Vercel Serverless Function — Code Execution Proxy
 *
 * POST /api/run-code
 * Body: { language: string, version: string, code: string }
 *
 * Proxies to the Piston code execution API from the server side
 * to avoid CORS restrictions and 401s in production.
 */

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body: { language?: string; version?: string; code?: string };
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { language, version, code } = body;
  if (!language || !version || !code?.trim()) {
    return res.status(400).json({ error: 'language, version, and code are required' });
  }

  try {
    const resp = await fetch(PISTON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language,
        version,
        files: [{ content: code }],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Piston error ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    return res.status(200).json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Execution failed';
    console.error('[run-code]', message);
    return res.status(502).json({ error: message });
  }
}
