/**
 * Vercel Serverless Function — Code Execution Proxy
 *
 * POST /api/run-code
 * Body: { language: string, code: string }
 *
 * Uses Judge0 CE (ce.judge0.com) — free, no API key required.
 * Returns { run: { stdout, stderr, code } } matching the previous Piston format.
 */

const JUDGE0_BASE = 'https://ce.judge0.com';

// Judge0 CE language IDs (stable across versions)
const LANG_ID: Record<string, number> = {
  python:     71,   // Python 3.8.1
  javascript: 63,   // JavaScript (Node.js 12.14.0)
  typescript: 74,   // TypeScript 3.7.4
  java:       62,   // Java (OpenJDK 13.0.1)
  'c++':      54,   // C++ (GCC 9.2.0)
  cpp:        54,
  'c#':       51,   // C# (Mono 6.6.0)
  csharp:     51,
  go:         60,   // Go 1.13.5
  rust:       73,   // Rust 1.40.0
  bash:       46,   // Bash 5.0.0
};

function getLangId(lang: string): number | null {
  const key = lang.toLowerCase().trim();
  return LANG_ID[key] ?? null;
}

function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 25000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
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

  const langId = getLangId(language);
  if (langId === null) {
    return res.status(422).json({ error: `Language "${language}" is not supported.` });
  }

  try {
    // ?wait=true makes Judge0 execute synchronously (up to ~5s)
    const execResp = await fetchWithTimeout(
      `${JUDGE0_BASE}/submissions?base64_encoded=false&wait=true`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language_id: langId,
          source_code: code,
          stdin: '',
        }),
      },
      25000
    );

    if (!execResp.ok) {
      const detail = await execResp.text().catch(() => '');
      console.error(`[run-code] Judge0 ${execResp.status}:`, detail);
      return res.status(503).json({
        error: `Code execution service unavailable (${execResp.status}). Please try again.`,
      });
    }

    const data = await execResp.json() as {
      stdout?: string | null;
      stderr?: string | null;
      compile_output?: string | null;
      status?: { id: number; description: string };
    };

    // Combine stderr + compile errors into a single stderr string
    const stderr = [data.stderr, data.compile_output].filter(Boolean).join('\n');
    const stdout = data.stdout ?? '';
    // status.id 3 = "Accepted" = clean exit; anything else = failure
    const exitCode = data.status?.id === 3 ? 0 : 1;

    return res.status(200).json({
      run: { stdout, stderr, code: exitCode },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Execution failed';
    console.error('[run-code]', message);
    if (message.includes('abort') || message.toLowerCase().includes('timeout')) {
      return res.status(504).json({ error: 'Code execution timed out. Please try again.' });
    }
    return res.status(502).json({ error: message });
  }
}
