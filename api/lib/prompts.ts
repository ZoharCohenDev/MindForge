export const SYSTEM_PROMPT =
  'You are a senior engineering educator and curriculum architect. ' +
  'You design deeply technical, role-specific learning roadmaps. ' +
  'Every node you produce must be a concrete, specific technical concept — never a generic category. ' +
  'FORBIDDEN titles include: Foundations, Core Concepts, Basics, Overview, Introduction, Advanced Topics, ' +
  'Career Growth, Hands-on Practice, Best Practices, Core Skills, Key Terminology, Essential Tools. ' +
  'Respond with valid JSON only — no markdown fences, no commentary.';

/* ── Stage 1: Top-level domain generation ────────────────────────────── */

export function buildDomainsPrompt(role: string): string {
  return `Identify all top-level technical DOMAINS that a professional "${role}" must master.

RULES:
- Each domain must be a SPECIFIC, NAMED technical area (e.g. "JavaScript", "SQL", "Docker", "Linear Algebra").
- Do NOT use generic groupings: Foundations, Core Concepts, Basics, Advanced Topics, Career Growth, Overview, Introduction, Best Practices, Hands-on Practice, Core Skills.
- Include 12–25 domains depending on role breadth.
- Order roughly from foundational knowledge → specialised / production topics.

Return JSON:
{
  "name": "<role> Roadmap",
  "description": "<one sentence describing this learning path>",
  "icon": "<single relevant emoji>",
  "domains": [
    { "title": "<specific domain name>", "summary": "<one technical sentence>" }
  ]
}`;
}

/* ── Stage 2: Node expansion ─────────────────────────────────────────── */

export function buildExpansionPrompt(
  role: string,
  nodeTitle: string,
  nodeSummary: string,
  depth: number,
  ancestorPath: string[],
): string {
  const pathStr =
    ancestorPath.length > 0
      ? `Context path: ${ancestorPath.join(' → ')} → ${nodeTitle}`
      : `Domain: ${nodeTitle}`;

  return `Expand a knowledge-tree node for a "${role}" learning platform.

${pathStr}
Summary: ${nodeSummary}
Current tree depth: ${depth}

TASK: Generate detailed children for "${nodeTitle}". Go 2–3 levels deep from this node.

RULES:
1. Generate 3–7 direct children.
2. Each child should itself have 2–5 sub-children where the topic warrants decomposition.
3. Continue decomposing until you reach atomic learning units (20–60 min study sessions).
4. FORBIDDEN titles: Foundations, Core Concepts, Basics, Advanced Topics, Career Growth, Overview, Introduction, Best Practices, Hands-on Practice, Core Skills, Key Terminology, Essential Tools, General Practice, Soft Skills.
5. Every title must name a CONCRETE technical concept, tool, pattern, or skill.
6. Include implementation details, edge cases, debugging knowledge, and real-world patterns where relevant.

Every node at every depth MUST include: title (string), summary (string, 1 sentence), children (array, even if empty).

Return JSON:
{
  "children": [
    {
      "title": "<specific concept>",
      "summary": "<one sentence>",
      "children": [
        { "title": "...", "summary": "...", "children": [] }
      ]
    }
  ]
}`;
}

/* ── Stage 3: Refinement / regeneration ──────────────────────────────── */

export function buildRefinementPrompt(
  role: string,
  nodeTitle: string,
  nodeSummary: string,
  reason: string,
  ancestorPath: string[],
): string {
  const pathStr = ancestorPath.join(' → ');

  return `A node in a "${role}" knowledge tree was flagged for quality issues and needs regeneration.

Path: ${pathStr}${pathStr ? ' → ' : ''}${nodeTitle}
Summary: ${nodeSummary}
Issue: ${reason}

TASK: Generate BETTER children for "${nodeTitle}" that fix the quality issue above.

RULES:
1. Replace any generic headings with concrete, specific technical concepts.
2. Generate 3–6 direct children, each with 2–4 sub-children.
3. FORBIDDEN titles: Foundations, Core Concepts, Basics, Advanced Topics, Career Growth, Overview, Introduction, Best Practices, Hands-on Practice, Core Skills, Key Terminology, Essential Tools, Soft Skills.
4. Each leaf should be an atomic learning unit (20–60 minutes of focused study).
5. Be deeply technical and role-specific.

Every node at every depth MUST include: title (string), summary (string, 1 sentence), children (array, even if empty).

Return JSON:
{
  "children": [
    {
      "title": "<specific concept>",
      "summary": "<one sentence>",
      "children": [
        { "title": "...", "summary": "...", "children": [] }
      ]
    }
  ]
}`;
}
