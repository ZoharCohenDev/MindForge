import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';

// ── Local API shim ────────────────────────────────────────────────────────────
// Intercepts /api/* requests during `npm run dev` and routes them through
// the same Vercel-style handler modules used in production.
// Uses server.ssrLoadModule so TypeScript is transpiled on the fly and HMR works.
// In production (Vercel) these routes are served by the real serverless runtime.

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/** Minimal shim matching the Vercel req/res interface used by all api/* handlers. */
function makeShimRes(res: ServerResponse) {
  let headersSent = false;
  const shim = {
    // Expose the raw Node ServerResponse so handlers can use SSE streaming.
    _raw: res,
    status(code: number) {
      return {
        json(data: unknown) {
          if (headersSent) return;
          headersSent = true;
          res.writeHead(code, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        },
      };
    },
  };
  return shim;
}

const API_HANDLERS = new Set([
  'generate-tree',
  'generate-explanation',
  'run-code',
  'convert-code',
]);

function localApiPlugin(): Plugin {
  let viteServer: ViteDevServer;
  return {
    name: 'local-api',
    configureServer(server) {
      viteServer = server;

      // Load ALL env vars from .env / .env.local into process.env so that
      // server-side handlers (e.g. OPENAI_API_KEY) can access them.
      const env = loadEnv('development', process.cwd(), '');
      for (const [key, val] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = val;
      }

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        // Only intercept /api/* — pass everything else through to Vite.
        const path = (req.url ?? '').split('?')[0];
        if (!path.startsWith('/api/')) return next();

        const handler = path.slice('/api/'.length); // e.g. "generate-tree"
        if (!API_HANDLERS.has(handler)) return next();

        try {
          const rawBody = await readBody(req);
          const shimReq = { method: req.method ?? 'POST', body: rawBody };
          const shimRes = makeShimRes(res);

          // ssrLoadModule transpiles the TS file and respects HMR.
          const mod = await viteServer.ssrLoadModule(`/api/${handler}.ts`);
          await (mod.default as (req: unknown, res: unknown) => Promise<void>)(shimReq, shimRes);
        } catch (err) {
          console.error(`[local-api] /${handler}:`, err);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        }
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export default defineConfig({
  plugins: [react(), localApiPlugin()],
});
