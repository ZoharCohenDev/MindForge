import type { SeedNode } from './types';

/* ── Forbidden generic titles ────────────────────────────────────────── */

const FORBIDDEN_TITLES = new Set([
  'foundations',
  'core concepts',
  'core skills',
  'advanced topics',
  'hands-on practice',
  'career growth',
  'basics',
  'overview',
  'introduction',
  'key terminology',
  'essential tools',
  'general practice',
  'industry trends',
  'mindset',
  'soft skills',
  'best practices',
  'tools overview',
  'guided projects',
  'independent projects',
  'intermediate patterns',
  'basic techniques',
  'advanced techniques',
]);

/** Returns true if the title matches a forbidden generic heading. */
export function isGenericTitle(title: string): boolean {
  const normalised = title.toLowerCase().replace(/^\d+[\.\)]\s*/, '').trim();
  return FORBIDDEN_TITLES.has(normalised);
}

/* ── Tree scoring ────────────────────────────────────────────────────── */

export interface TreeScore {
  maxDepth: number;
  totalNodes: number;
  leafNodes: number;
  genericNodes: string[];
  broadNodes: string[];   // non-leaf nodes with ≤ 1 child
  score: number;          // 0–100
}

function walk(
  node: SeedNode,
  depth: number,
  acc: Omit<TreeScore, 'score'>,
  path: string[],
): void {
  acc.totalNodes++;
  if (depth > acc.maxDepth) acc.maxDepth = depth;

  const children = node.children ?? [];

  if (children.length === 0) {
    acc.leafNodes++;
  } else if (children.length <= 1) {
    acc.broadNodes.push([...path, node.title].join(' → '));
  }

  if (isGenericTitle(node.title)) {
    acc.genericNodes.push([...path, node.title].join(' → '));
  }

  for (const child of children) {
    walk(child, depth + 1, acc, [...path, node.title]);
  }
}

/** Score a tree from 0–100 based on depth, node count, and quality. */
export function scoreTree(root: SeedNode): TreeScore {
  const acc: Omit<TreeScore, 'score'> = {
    maxDepth: 0,
    totalNodes: 0,
    leafNodes: 0,
    genericNodes: [],
    broadNodes: [],
  };

  walk(root, 0, acc, []);

  let score = 50;
  score += Math.min(20, acc.maxDepth * 4);                 // depth   0–20
  score += Math.min(20, Math.floor(acc.totalNodes / 10));   // size    0–20
  score -= Math.min(30, acc.genericNodes.length * 5);       // generic 0–30 penalty
  score -= Math.min(20, acc.broadNodes.length * 3);         // broad   0–20 penalty

  return { ...acc, score: Math.max(0, Math.min(100, score)) };
}

/* ── Weak-node detection ─────────────────────────────────────────────── */

export interface WeakNode {
  path: string[];
  node: SeedNode;
  reason: string;
}

/**
 * Walk the tree and collect nodes that should be regenerated.
 * Returns mutable references — callers can replace `.children` in-place.
 */
export function findWeakNodes(
  root: SeedNode,
  minLeafDepth: number = 2,
): WeakNode[] {
  const weak: WeakNode[] = [];

  function recurse(node: SeedNode, depth: number, path: string[]) {
    const children = node.children ?? [];

    // Generic title → replace entirely (don't recurse into children)
    if (isGenericTitle(node.title)) {
      weak.push({ path, node, reason: `Generic title: "${node.title}"` });
      return;
    }

    // Leaf that is too shallow
    if (children.length === 0 && depth < minLeafDepth) {
      weak.push({
        path,
        node,
        reason: `Leaf at depth ${depth} — too shallow, needs children`,
      });
    }

    // Non-leaf with only 1 child
    if (children.length === 1 && depth < 4) {
      weak.push({
        path,
        node,
        reason: `Only 1 child — needs broader decomposition`,
      });
    }

    for (const child of children) {
      recurse(child, depth + 1, [...path, node.title]);
    }
  }

  // Start from the top-level domains (depth 1)
  for (const child of root.children ?? []) {
    recurse(child, 1, [root.title]);
  }

  return weak;
}
