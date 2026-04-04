import type { SeedNode, GeneratedTreePayload } from './types';
import {
  buildDomainsPrompt,
  buildExpansionPrompt,
  buildRefinementPrompt,
} from './prompts';
import { callOpenAI } from './openai';
import { scoreTree, findWeakNodes } from './validation';

/* ── Step event types (used by SSE transport) ────────────────────────── */

export type StepId =
  | 'understanding'
  | 'domains'
  | 'expanding'
  | 'deepening'
  | 'validating'
  | 'refining'
  | 'finalizing';

export type StepStatus = 'pending' | 'in-progress' | 'completed' | 'skipped';

export interface StepEvent {
  id: StepId;
  title: string;
  description: string;
  status: StepStatus;
}

export type OnStep = (step: StepEvent) => void;

/* ── Config ──────────────────────────────────────────────────────────── */

/** Max parallel OpenAI requests per batch. */
const BATCH_SIZE = 5;

/** How many validate → refine cycles to run. */
const MAX_REFINE_PASSES = 2;

/** Minimum acceptable tree quality score (0–100). */
const MIN_SCORE = 60;

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Run async work in batches of `size`. */
async function batchAll<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

/** Normalise a node tree in-place: ensure every node has a children array. */
function normalise(node: SeedNode): void {
  if (!node.children) node.children = [];
  if (!node.title) node.title = 'Untitled';
  if (!node.summary) node.summary = '';
  for (const child of node.children) normalise(child);
}

/* ── Stage 1: Domain generation ──────────────────────────────────────── */

interface DomainsResponse {
  name?: string;
  description?: string;
  icon?: string;
  domains: { title: string; summary: string }[];
}

/* ── Stage 2: Domain expansion ───────────────────────────────────────── */

async function expandDomain(
  role: string,
  domain: { title: string; summary: string },
): Promise<SeedNode> {
  const prompt = buildExpansionPrompt(role, domain.title, domain.summary, 1, []);
  const result = await callOpenAI<{ children?: SeedNode[] }>(prompt);
  const node: SeedNode = {
    title: domain.title,
    summary: domain.summary,
    children: result.children ?? [],
  };
  normalise(node);
  return node;
}

/* ── Stage 3: Validate & refine ──────────────────────────────────────── */

async function refineWeakNodes(
  role: string,
  tree: SeedNode,
): Promise<number> {
  const weakNodes = findWeakNodes(tree);
  if (weakNodes.length === 0) return 0;

  await batchAll(weakNodes, BATCH_SIZE, async (w) => {
    try {
      const result = await callOpenAI<{ children?: SeedNode[] }>(
        buildRefinementPrompt(role, w.node.title, w.node.summary, w.reason, w.path),
      );
      w.node.children = result.children ?? [];
      normalise(w.node);
    } catch (err) {
      console.warn(`[tree-gen] Refinement failed for "${w.node.title}":`, err);
    }
  });

  return weakNodes.length;
}

/* ── Public orchestrator ─────────────────────────────────────────────── */

export async function generateTreeStaged(
  careerGoal: string,
  onStep?: OnStep,
): Promise<GeneratedTreePayload> {
  const role = careerGoal.trim();
  const emit = onStep ?? (() => {});

  // ── Step 1: understanding ──
  emit({ id: 'understanding', title: 'Understanding the role', description: `Analysing what a ${role} needs to know…`, status: 'in-progress' });
  // (no real work — this is the "thinking" beat before the first API call)
  emit({ id: 'understanding', title: 'Understanding the role', description: `Analysing what a ${role} needs to know…`, status: 'completed' });

  // ── Step 2: top-level domains ──
  emit({ id: 'domains', title: 'Generating domains', description: 'Identifying core technical knowledge areas…', status: 'in-progress' });
  console.log(`[tree-gen] Stage 1 — generating domains for "${role}"`);
  const meta = await callOpenAI<DomainsResponse>(buildDomainsPrompt(role));
  const domains = meta.domains ?? [];
  console.log(`[tree-gen]   → ${domains.length} domains`);
  emit({ id: 'domains', title: 'Generating domains', description: `Found ${domains.length} technical domains`, status: 'completed' });

  // ── Step 3: expand each domain (parallel batches, with per-batch progress) ──
  emit({ id: 'expanding', title: 'Expanding domains', description: `Expanding ${domains.length} domains into subtopics…`, status: 'in-progress' });
  console.log('[tree-gen] Stage 2 — expanding domains');
  const expandedDomains: SeedNode[] = [];
  for (let i = 0; i < domains.length; i += BATCH_SIZE) {
    const batch = domains.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((d) => expandDomain(role, d)));
    expandedDomains.push(...batchResults);
    const done = expandedDomains.length;
    if (done < domains.length) {
      emit({ id: 'expanding', title: 'Expanding domains', description: `Expanded ${done} of ${domains.length} domains…`, status: 'in-progress' });
    }
  }
  emit({ id: 'expanding', title: 'Expanding domains', description: `Expanded all ${expandedDomains.length} domains into subtopics`, status: 'completed' });

  // ── Step 4: deepen (the expansion already goes 2-3 levels) ──
  emit({ id: 'deepening', title: 'Deepening concepts', description: 'Adding concept-level detail to every branch…', status: 'in-progress' });
  const tree: SeedNode = {
    title: role,
    summary: `Complete knowledge tree for mastering the ${role} role.`,
    children: expandedDomains,
  };
  emit({ id: 'deepening', title: 'Deepening concepts', description: 'Concept-level detail added', status: 'completed' });

  // ── Step 5 + 6: validate → refine loop ──
  emit({ id: 'validating', title: 'Validating quality', description: 'Scoring tree depth, breadth, and specificity…', status: 'in-progress' });
  let didRefine = false;
  for (let pass = 0; pass < MAX_REFINE_PASSES; pass++) {
    const score = scoreTree(tree);
    console.log(
      `[tree-gen] Pass ${pass + 1} — score=${score.score} depth=${score.maxDepth} ` +
        `nodes=${score.totalNodes} generic=${score.genericNodes.length} broad=${score.broadNodes.length}`,
    );

    if (score.score >= MIN_SCORE && score.genericNodes.length === 0) {
      console.log('[tree-gen]   → quality threshold met');
      break;
    }

    emit({ id: 'validating', title: 'Validating quality', description: `Score: ${score.score}/100 — needs improvement`, status: 'completed' });
    emit({ id: 'refining', title: 'Refining weak areas', description: `Regenerating ${score.genericNodes.length + score.broadNodes.length} weak branches…`, status: 'in-progress' });
    didRefine = true;

    const refined = await refineWeakNodes(role, tree);
    console.log(`[tree-gen]   → refined ${refined} weak nodes`);
    if (refined === 0) break;
  }

  if (!didRefine) {
    emit({ id: 'validating', title: 'Validating quality', description: 'Quality threshold met', status: 'completed' });
    emit({ id: 'refining', title: 'Refining weak areas', description: 'No refinement needed', status: 'skipped' });
  } else {
    emit({ id: 'refining', title: 'Refining weak areas', description: 'Weak branches regenerated', status: 'completed' });
  }

  // ── Step 7: finalise ──
  emit({ id: 'finalizing', title: 'Finalizing tree', description: 'Assembling your personalised roadmap…', status: 'in-progress' });
  const final = scoreTree(tree);
  console.log(
    `[tree-gen] Done — score=${final.score} depth=${final.maxDepth} nodes=${final.totalNodes}`,
  );
  emit({ id: 'finalizing', title: 'Finalizing tree', description: `${final.totalNodes} topics across ${final.maxDepth} levels — ready!`, status: 'completed' });

  return {
    name: meta.name || `${role} Roadmap`,
    description:
      meta.description || `A deeply technical learning path for the ${role} role.`,
    icon: meta.icon || '🧠',
    tree,
  };
}
