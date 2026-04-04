/**
 * Vercel Serverless Function — Code Execution Proxy
 *
 * POST /api/run-code
 * Body: { language: string, code: string }
 *
 * Dynamically resolves the latest available Piston runtime version
 * for the requested language, then proxies execution server-to-server.
 */

const PISTON_BASE = 'https://emkc.org/api/v2/piston';

// Normalize language names from our UI to Piston language identifiers
const LANG_ALIAS: Record<string, string> = {
  python:     'python',
  javascript: 'javascript',
  typescript: 'typescript',
  java:       'java',
  'c++':      'c++',
  cpp:        'c++',
  'c#':       'csharp',
  csharp:     'csharp',
  go:         'go',
  rust:       'rust',
  bash:       'bash',
};

type PistonRuntime = { language: string; version: string; aliases: string[] };

async function resolveRuntime(requestedLang: string): Promise<{ language: string; version: string } | null> {
  const normalized = requestedLang.toLowerCase().trim();
  const pistonLang = LANG_ALIAS[normalized] ?? normalized;

  const resp = await fetch(`${PISTON_BASE}/runtimes`);
  if (!resp.ok) throw new Error(`Could not fetch Piston runtimes: ${resp.status}`);

  const runtimes = await resp.json() as PistonRuntime[];

  // Find exact match or alias match, then pick the highest version
  const matches = runtimes.filter(
    (r) => r.language === pistonLang || r.aliases?.includes(pistonLang)
  );

  if (matches.length === 0) return null;

  // Sort by version descending and pick latest
  matches.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  return { language: matches[0].language, version: matches[0].version };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body: { language?: string; code?: string };
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { language, code } = body;
  if (!language || !code?.trim()) {
    return res.status(400).json({ error: 'language and code are required' });
  }

  try {
    const runtime = await resolveRuntime(language);
    if (!runtime) {
      return res.status(422).json({ error: `Language "${language}" is not available on Piston.` });
    }

    const resp = await fetch(`${PISTON_BASE}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: runtime.language,
        version: runtime.version,
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
