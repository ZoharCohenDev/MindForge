/**
 * Client-side tree generation utilities.
 *
 * Calls /api/generate-tree and validates the response into our SeedNode schema.
 * The actual OpenAI prompt lives on the server side (api/generate-tree.ts);
 * this module handles the HTTP call, parsing, and type safety.
 */

import type { SeedNode } from '../types';
import { getAuthHeaders } from './supabase';

// ── Public types ─────────────────────────────────────────────────────────────

export type GeneratedTreePayload = {
  /** Suggested tree name, e.g. "AI Engineer Roadmap" */
  name: string;
  /** One-sentence description of the learning path */
  description: string;
  /** Single emoji icon for the tree */
  icon: string;
  /** The generated tree structure (compatible with our SeedNode schema) */
  tree: SeedNode;
};

// ── Validation ───────────────────────────────────────────────────────────────

function isValidSeedNode(node: unknown): node is SeedNode {
  if (!node || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  if (typeof n.title !== 'string' || !n.title.trim()) return false;
  if (n.children !== undefined && !Array.isArray(n.children)) return false;
  if (Array.isArray(n.children)) {
    for (const child of n.children) {
      if (!isValidSeedNode(child)) return false;
    }
  }
  return true;
}

/**
 * Validates and normalises a raw server response into a GeneratedTreePayload.
 * Throws a descriptive error if the payload does not match the expected schema.
 */
export function parseGeneratedTree(raw: unknown): GeneratedTreePayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid AI response: expected an object');
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== 'string' || !r.name.trim()) {
    throw new Error('Invalid AI response: missing "name"');
  }
  if (!isValidSeedNode(r.tree)) {
    throw new Error('Invalid AI response: "tree" is not a valid SeedNode');
  }
  return {
    name: r.name.trim(),
    description: typeof r.description === 'string' ? r.description.trim() : '',
    icon: typeof r.icon === 'string' && r.icon.trim() ? r.icon.trim() : '🌱',
    tree: r.tree as SeedNode,
  };
}

// ── API call ──────────────────────────────────────────────────────────────────

/**
 * Calls the /api/generate-tree endpoint and returns a validated
 * GeneratedTreePayload ready to be saved through treeService.
 */
export async function generateTreeFromGoal(
  careerGoal: string,
): Promise<GeneratedTreePayload> {
  const resp = await fetch('/api/generate-tree', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ careerGoal }),
  });

  if (!resp.ok) {
    let message = `Tree generation failed (${resp.status})`;
    try {
      const err = await resp.json() as { error?: string };
      if (err.error) message = err.error;
    } catch { /* ignore parse errors */ }
    throw new Error(message);
  }

  const data: unknown = await resp.json();
  return parseGeneratedTree(data);
}
