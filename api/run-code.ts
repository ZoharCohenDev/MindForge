/**
 * Vercel Serverless Function — Code Execution Proxy
 *
 * POST /api/run-code
 * Body: { language: string, code: string }
 *
 * Dynamically resolves the latest available Piston runtime version,
 * caches runtimes in-memory, retries once on transient failures.
 */

const PISTON_BASE = 'https://emkc.org/api/v2/piston';

// Normalize UI language names → Piston identifiers
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

// Module-level cache — survives warm lambda invocations
let _runtimesCache: PistonRuntime[] | null = null;
let _runtimesCachedAt = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 12000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

async function getRuntimes(): Promise<PistonRuntime[]> {
  const now = Date.now();
  if (_runtimesCache && now - _runtimesCachedAt < CACHE_TTL) return _runtimesCache;
  const resp = await fetchWithTimeout(`${PISTON_BASE}/runtimes`, {}, 8000);
  if (!resp.ok) throw new Error(`Runtimes fetch failed: ${resp.status}`);
  const data = await resp.json() as PistonRuntime[];
  _runtimesCache = data;
  _runtimesCachedAt = now;
  return data;
}

async function resolveRuntime(
  requestedLang: string
): Promise<{ language: string; version: string } | null> {
  const normalized = requestedLang.toLowerCase().trim();
  const pistonLang = LANG_ALIAS[normalized] ?? normalized;
  const runtimes = await getRuntimes();
  const matches = runtimes.filter(
    (r) => r.language === pistonLang || r.aliases?.includes(pistonLang)
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  return { language: matches[0].language, version: matches[0].version };
}

async function executeOnPiston(language: string, version: string, code: string): Promise<Response> {
  return fetchWithTimeout(
    `${PISTON_BASE}/execute`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language,
        version,
        files: [{ content: code }],
        stdin: '',
        args: [],
        compile_timeout: 10000,
        run_timeout: 5000,
      }),
    },
    20000
  );
}

export const config = { api: { bodyParser: true } };

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
      return res.status(422).json({ error: `Language "${language}" is not supported.` });
    }

    let execResp = await executeOnPiston(runtime.language, runtime.version, code);

    // Retry once on transient 5xx — bust cache so we re-resolve the version
    if (execResp.status >= 500) {
      console.warn(`[run-code] Piston returned ${execResp.status}, retrying with fresh runtime…`);
      _runtimesCache = null;
      const runtime2 = await resolveRuntime(language);
      if (runtime2) {
        execResp = await executeOnPiston(runtime2.language, runtime2.version, code);
      }
    }

    if (!execResp.ok) {
      const detail = await execResp.text().catch(() => '');
      console.error(`[run-code] Piston execute ${execResp.status}:`, detail);
      return res.status(503).json({
        error: `Code execution service is temporarily unavailable (${execResp.status}). Please try again in a moment.`,
      });
    }

    const data = await execResp.json();
    return res.status(200).json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Execution failed';
    console.error('[run-code]', message);
    if (message.includes('abort') || message.toLowerCase().includes('timeout')) {
      return res.status(504).json({ error: 'Code execution timed out. Please try again.' });
    }
    return res.status(502).json({ error: message });
  }
}
