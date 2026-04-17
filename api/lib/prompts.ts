export const SYSTEM_PROMPT =
  'You are a senior engineering educator and curriculum architect. ' +
  'You design deeply technical, role-specific learning roadmaps. ' +
  'Every node you produce must be a concrete, specific technical concept — never a generic category. ' +
  'FORBIDDEN titles include: Foundations, Core Concepts, Basics, Overview, Introduction, Advanced Topics, ' +
  'Career Growth, Hands-on Practice, Best Practices, Core Skills, Key Terminology, Essential Tools. ' +
  'All descriptive text (descriptions, summaries) MUST be written in Hebrew. Keep technical titles and concept names in English. ' +
  'Respond with valid JSON only — no markdown fences, no commentary.';

/* ── Stage 1: Top-level domain generation ────────────────────────────── */

export function buildDomainsPrompt(role: string): string {
  return `You are given an input that describes a professional role, certification, or learning goal: "${role}".

FIRST — carefully analyse the input:
- Is it a job title? (e.g. "Full Stack Developer", "DevOps Engineer")
- Is it a certification? (e.g. "AWS Solutions Architect", "Claude Certified Architect")
- Is it a specialisation or topic? (e.g. "LLM Systems and Agents", "Prompt Engineering")
- Does it name specific technologies, frameworks, or vendors? (e.g. Claude, MCP, LangChain, Kubernetes)

THEN — identify all top-level technical DOMAINS that someone mastering "${role}" specifically needs to know.

CRITICAL RULES:
1. Base every domain DIRECTLY on the exact role/certification/topic provided. Do NOT substitute with generic software-engineering domains unless they are genuinely required for THIS specific role.
2. If the input mentions specific tools, platforms, frameworks, or vendor products (e.g. Claude, MCP, Agents, Kubernetes, React), those must appear as top-level domains.
3. Each domain must be a CONCRETE, NAMED technical area — not a category wrapper.
4. Do NOT use generic groupings: Foundations, Core Concepts, Basics, Advanced Topics, Career Growth, Overview, Introduction, Best Practices, Hands-on Practice, Core Skills.
5. Include 8–12 domains. Order from foundational → specialised / production topics relevant to THIS role.

EXAMPLES of correct domain extraction:
- "Claude Certified Architect - LLM Systems, Agents, MCP, and Prompt Engineering" → Agent Architecture, Prompt Engineering, MCP (Model Context Protocol), Context Management, Claude API & Models, Tool Use & Function Calling, Multi-Agent Workflows, Guardrails & Safety, Evaluation & Reliability
- "AWS Solutions Architect" → IAM & Security, EC2 & Compute, S3 & Storage, VPC & Networking, RDS & Databases, Lambda & Serverless, CloudFormation & IaC, High Availability & Disaster Recovery, Cost Optimisation, Monitoring & Observability
- "Full Stack Developer" → JavaScript, TypeScript, React, Node.js, REST APIs, SQL, Authentication, Docker, CI/CD, Web Security

LANGUAGE: All "description" and "summary" values MUST be written in Hebrew. Keep "name" and "title" values in English (technical terms).

Return JSON:
{
  "name": "<concise roadmap name that reflects the exact role>",
  "description": "<one sentence describing this learning path — in Hebrew>",
  "icon": "<single relevant emoji>",
  "domains": [
    { "title": "<specific domain name>", "summary": "<one technical sentence — in Hebrew>" }
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

LANGUAGE: All "summary" values MUST be written in Hebrew. Keep "title" values in English.

Return JSON:
{
  "children": [
    {
      "title": "<specific concept>",
      "summary": "<one sentence — in Hebrew>",
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

LANGUAGE: All "summary" values MUST be written in Hebrew. Keep "title" values in English.

Return JSON:
{
  "children": [
    {
      "title": "<specific concept>",
      "summary": "<one sentence — in Hebrew>",
      "children": [
        { "title": "...", "summary": "...", "children": [] }
      ]
    }
  ]
}`;
}
