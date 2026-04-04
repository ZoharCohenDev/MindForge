import { useCallback, useRef, useState } from 'react';
import type { SeedNode } from '../types';

/* ── Types mirroring the backend StepEvent ─────────────────────────── */

export type StepId =
  | 'understanding'
  | 'domains'
  | 'expanding'
  | 'deepening'
  | 'validating'
  | 'refining'
  | 'finalizing';

export type StepStatus = 'pending' | 'in-progress' | 'completed' | 'skipped';

export interface StepState {
  id: StepId;
  title: string;
  description: string;
  status: StepStatus;
}

export interface GeneratedPayload {
  name: string;
  description: string;
  icon: string;
  tree: SeedNode;
}

/* ── Initial step list ──────────────────────────────────────────────── */

const INITIAL_STEPS: StepState[] = [
  { id: 'understanding', title: 'Understanding the role', description: 'Analysing what the role requires…', status: 'pending' },
  { id: 'domains', title: 'Generating domains', description: 'Identifying core knowledge areas…', status: 'pending' },
  { id: 'expanding', title: 'Expanding domains', description: 'Breaking domains into subtopics…', status: 'pending' },
  { id: 'deepening', title: 'Deepening concepts', description: 'Adding concept-level detail…', status: 'pending' },
  { id: 'validating', title: 'Validating quality', description: 'Scoring tree quality…', status: 'pending' },
  { id: 'refining', title: 'Refining weak areas', description: 'Improving low-quality branches…', status: 'pending' },
  { id: 'finalizing', title: 'Finalizing tree', description: 'Assembling your roadmap…', status: 'pending' },
];

/* ── Hook ────────────────────────────────────────────────────────────── */

export type GenPhase = 'idle' | 'generating' | 'done' | 'error';

export function useTreeGeneration() {
  const [phase, setPhase] = useState<GenPhase>('idle');
  const [steps, setSteps] = useState<StepState[]>(INITIAL_STEPS);
  const [result, setResult] = useState<GeneratedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const updateStep = useCallback((id: StepId, patch: Partial<StepState>) => {
    setSteps(prev =>
      prev.map(s => (s.id === id ? { ...s, ...patch } : s)),
    );
  }, []);

  const generate = useCallback(async (careerGoal: string) => {
    // Reset state
    setPhase('generating');
    setSteps(INITIAL_STEPS.map(s => ({ ...s })));
    setResult(null);
    setError(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const resp = await fetch('/api/generate-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ careerGoal, stream: true }),
        signal: ctrl.signal,
      });

      // If the backend doesn't support SSE (e.g. mock mode), fall back to JSON
      const ct = resp.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        if (!resp.ok) {
          const err = (await resp.json()) as { error?: string };
          throw new Error(err.error ?? `Generation failed (${resp.status})`);
        }
        const data = (await resp.json()) as GeneratedPayload;
        // Instantly mark all steps completed for mock mode
        setSteps(prev => prev.map(s => ({ ...s, status: 'completed' as StepStatus })));
        setResult(data);
        setPhase('done');
        return data;
      }

      // ── SSE parsing ──
      if (!resp.body) throw new Error('No response body for SSE');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventType = '';   // persists across TCP chunks — an SSE event can span multiple reads
      let payload: GeneratedPayload | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const raw = line.slice(6);
            try {
              const data = JSON.parse(raw);
              if (eventType === 'step') {
                const s = data as StepState;
                updateStep(s.id, { title: s.title, description: s.description, status: s.status });
              } else if (eventType === 'result') {
                payload = data as GeneratedPayload;
              } else if (eventType === 'error') {
                throw new Error((data as { error?: string }).error ?? 'Generation failed');
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                // Partial JSON line — will be reassembled via buffer across reads
              } else {
                throw e;
              }
            }
            eventType = '';
          }
        }
      }

      if (!payload) throw new Error('Stream ended without a result');
      setResult(payload);
      setPhase('done');
      return payload;
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return null;
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setError(msg);
      setPhase('error');
      throw err;
    }
  }, [updateStep]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase('idle');
    setSteps(INITIAL_STEPS.map(s => ({ ...s })));
    setResult(null);
    setError(null);
  }, []);

  return { phase, steps, result, error, generate, reset };
}
