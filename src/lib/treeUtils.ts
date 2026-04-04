import type { Topic, TreeNode, UserTree, Tree } from "../types";

// ── Core tree assembly ────────────────────────────────────────────────────────

/**
 * Assembles a flat Topic[] into a nested TreeNode hierarchy.
 * The input array need not be sorted — parent lookup is O(1) via a Map.
 * Topics whose parent_id is not present in the list become root nodes.
 */
export function buildTreeNodes(items: Topic[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  items.forEach((t) => map.set(t.id, { ...t, children: [] }));

  items.forEach((t) => {
    const node = map.get(t.id)!;
    if (t.parent_id) {
      const parent = map.get(t.parent_id);
      if (parent) {
        parent.children.push(node);
        return;
      }
    }
    roots.push(node);
  });

  return roots;
}

// ── Rendering helpers ────────────────────────────────────────────────────────

/** Returns a shallow-sorted copy of nodes by sort_order then title. */
export function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Calculates the completion percentage for all descendant leaf nodes
 * under the given node (the node itself is not counted).
 * Returns 0 when there are no descendants.
 */
export function calcTreeProgress(node: TreeNode): number {
  const all: TreeNode[] = [];
  const walk = (n: TreeNode) => {
    all.push(n);
    n.children.forEach(walk);
  };
  node.children.forEach(walk);
  if (all.length === 0) return 0;
  return Math.round(
    (all.filter((n) => n.status === "done").length / all.length) * 100,
  );
}

/**
 * Returns an expand-state map with every node whose depth ≤ maxDepth
 * set to true. Pass this to the expandedIds state for an initial view.
 */
export function makeExpandToDepth(
  topics: Topic[],
  maxDepth = 1,
): Record<string, boolean> {
  return Object.fromEntries(
    topics.filter((t) => t.depth <= maxDepth).map((t) => [t.id, true]),
  );
}

// ── Reorder helpers ──────────────────────────────────────────────────────────

/**
 * Given a flat list of sibling topics and a target id, computes the
 * sort_order swap needed to move the target one position in the given
 * direction.
 *
 * Returns two `{ id, sort_order }` pairs representing the target and its
 * neighbour after swapping, or `null` when the move is already at a boundary.
 *
 * The caller is responsible for persisting both updates (nodeService.setOrder)
 * and for applying an optimistic local state update when desired.
 */
export function computeReorderSwap(
  siblings: Topic[],
  targetId: string,
  direction: "up" | "down",
): [{ id: string; sort_order: number }, { id: string; sort_order: number }] | null {
  const sorted = [...siblings].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.title.localeCompare(b.title);
  });
  const idx = sorted.findIndex((t) => t.id === targetId);
  if (idx === -1) return null;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sorted.length) return null;
  const a = sorted[idx];
  const b = sorted[swapIdx];
  // Exchange sort_order values so the two nodes trade positions.
  return [
    { id: a.id, sort_order: b.sort_order },
    { id: b.id, sort_order: a.sort_order },
  ];
}

// ── Domain object assembly ───────────────────────────────────────────────────

/**
 * Combines a Tree metadata row with its flat topic list into a fully-loaded
 * UserTree domain object. The roots array is built once here and reused
 * for rendering — callers should not build trees separately.
 */
export function buildUserTree(meta: Tree, topics: Topic[]): UserTree {
  return {
    meta,
    topics,
    roots: buildTreeNodes(topics),
  };
}
