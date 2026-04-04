import { useCallback, useRef, useState } from 'react';
import type { SeedNode } from '../types';

/* ── Types ───────────────────────────────────────────────────────────── */

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
  { id: 'understanding', title: 'Understanding the role',  description: 'Analysing what the role requires…',         status: 'pending' },
  { id: 'domains',       title: 'Generating domains',      description: 'Identifying core knowledge areas…',         status: 'pending' },
  { id: 'expanding',     title: 'Expanding domains',       description: 'Breaking domains into subtopics…',          status: 'pending' },
  { id: 'deepening',     title: 'Deepening concepts',      description: 'Adding concept-level detail…',              status: 'pending' },
  { id: 'validating',    title: 'Validating quality',      description: 'Scoring tree quality…',                     status: 'pending' },
  { id: 'refining',      title: 'Refining weak areas',     description: 'Improving low-quality branches…',           status: 'pending' },
  { id: 'finalizing',    title: 'Finalizing tree',         description: 'Assembling your roadmap…',                  status: 'pending' },
];

/* ── Step animation schedule (ms from request start) ───────────────── */
// Calibrated to a typical 12–20 s generation time.
// If the fetch resolves early, remaining steps fast-forward instantly.
const SCHEDULE: { id: StepId; activeAt: number; completeAt: number | 'fetch' }[] = [
  { id: 'understanding', activeAt: 0,     completeAt: 900   },
  { id: 'domains',       activeAt: 1000,  completeAt: 5000  },
  { id: 'expanding',     activeAt: 5100,  completeAt: 16000 },
  { id: 'deepening',     activeAt: 16100, completeAt: 17500 },
  { id: 'validating',    activeAt: 17600, completeAt: 19000 },
  { id: 'refining',      activeAt: 19000, completeAt: 19000 }, // always skipped
  { id: 'finalizing',    activeAt: 19100, completeAt: 'fetch' },
];

/* ── Hook ────────────────────────────────────────────────────────────── */

export type GenPhase = 'idle' | 'generating' | 'done' | 'error';

export function useTreeGeneration() {
  const [phase, setPhase] = useState<GenPhase>('idle');
  const [steps, setSteps] = useState<StepState[]>(INITIAL_STEPS);
  const [result, setResult] = useState<GeneratedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef  = useRef<AbortController | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const updateStep = useCallback((id: StepId, patch: Partial<StepState>) => {
    setSteps(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const generate = useCallback(async (careerGoal: string) => {
    setPhase('generating');
    setSteps(INITIAL_STEPS.map(s => ({ ...s })));
    setResult(null);
    setError(null);
    clearTimers();

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // ── Start the fetch immediately ──
    const fetchPromise = fetch('/api/generate-tree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ careerGoal }),
      signal: ctrl.signal,
    });

    // ── Kick off the animated step schedule ──
    const after = (ms: number, fn: () => void) => {
      const id = setTimeout(fn, ms);
      timersRef.current.push(id);
    };

    for (const s of SCHEDULE) {
      if (s.id === 'refining') {
        // refining is always skipped
        after(s.activeAt, () => updateStep('refining', { status: 'skipped' }));
        continue;
      }
      after(s.activeAt, () => updateStep(s.id, { status: 'in-progress' }));
      if (typeof s.completeAt === 'number') {
        after(s.completeAt, () => updateStep(s.id, { status: 'completed' }));
      }
      // completeAt === 'fetch' means we wait for the response (finalizing)
    }

    try {
      const resp = await fetchPromise;
      clearTimers();

      if (!resp.ok) {
        const ct = resp.headers.get('content-type') ?? '';
        const msg = ct.includes('application/json')
          ? ((await resp.json()) as { error?: string }).error ?? `Generation failed (${resp.status})`
          : `Generation failed (${resp.status})`;
        throw new Error(msg);
      }

      const data = (await resp.json()) as GeneratedPayload;

      // Fast-forward: complete any still-pending/in-progress steps, keep skipped
      setSteps(prev =>
        prev.map(s =>
          s.status === 'pending' || s.status === 'in-progress'
            ? { ...s, status: s.id === 'refining' ? 'skipped' : 'completed' }
            : s,
        ),
      );
      setResult(data);
      setPhase('done');
      return data;
    } catch (err: unknown) {
      clearTimers();
      if ((err as Error).name === 'AbortError') return null;
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setError(msg);
      setPhase('error');
      throw err;
    }
  }, [updateStep, clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    abortRef.current?.abort();
    setPhase('idle');
    setSteps(INITIAL_STEPS.map(s => ({ ...s })));
    setResult(null);
    setError(null);
  }, [clearTimers]);

  return { phase, steps, result, error, generate, reset };
}

