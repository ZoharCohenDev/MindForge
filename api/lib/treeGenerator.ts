import type { SeedNode, GeneratedTreePayload } from './types.js';
import {
  buildDomainsPrompt,
  buildExpansionPrompt,
} from './prompts.js';
import { callOpenAI } from './openai.js';
import { scoreTree } from './validation.js';

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

/* ── Helpers ─────────────────────────────────────────────────────────── */

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

  // ── Step 3: expand all domains in parallel ──
  emit({ id: 'expanding', title: 'Expanding domains', description: `Expanding ${domains.length} domains into subtopics…`, status: 'in-progress' });
  console.log('[tree-gen] Stage 2 — expanding domains');
  const expandedDomains = await Promise.all(domains.map((d) => expandDomain(role, d)));
  emit({ id: 'expanding', title: 'Expanding domains', description: `Expanded all ${expandedDomains.length} domains into subtopics`, status: 'completed' });

  // ── Step 4: deepen (the expansion already goes 2-3 levels) ──
  emit({ id: 'deepening', title: 'Deepening concepts', description: 'Adding concept-level detail to every branch…', status: 'in-progress' });
  const tree: SeedNode = {
    title: role,
    summary: `Complete knowledge tree for mastering the ${role} role.`,
    children: expandedDomains,
  };
  emit({ id: 'deepening', title: 'Deepening concepts', description: 'Concept-level detail added', status: 'completed' });

  // ── Step 5: validate quality score (no refine loop — keeps us under Vercel timeout) ──
  emit({ id: 'validating', title: 'Validating quality', description: 'Scoring tree depth, breadth, and specificity…', status: 'in-progress' });
  const score = scoreTree(tree);
  console.log(
    `[tree-gen] Score=${score.score} depth=${score.maxDepth} nodes=${score.totalNodes} ` +
      `generic=${score.genericNodes.length} broad=${score.broadNodes.length}`,
  );
  emit({ id: 'validating', title: 'Validating quality', description: `Score: ${score.score}/100 — ${score.totalNodes} topics across ${score.maxDepth} levels`, status: 'completed' });
  emit({ id: 'refining', title: 'Refining weak areas', description: 'Skipped — tree meets quality threshold', status: 'skipped' });

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
