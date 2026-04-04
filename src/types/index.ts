export type AppStatus = 'not_started' | 'learning' | 'in_progress' | 'done';
export type ProjectCategory = 'work' | 'study' | 'udemy' | 'personal';
export type ProjectPriority = 'low' | 'medium' | 'high';
export type TreeType = 'ai' | 'fullstack';

export type Tree = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  /** Matches the legacy tree_type column in topics (e.g. 'ai', 'fullstack'). */
  slug: string;
  icon: string | null;
  created_at: string;
  updated_at: string;
};

// ── Tree domain model ────────────────────────────────────────────────────────

/**
 * The shape of a single node inside a static seed file.
 * Used as input when seeding a tree from local data.
 */
export type SeedNode = {
  title: string;
  summary?: string;
  children?: SeedNode[];
};

/**
 * A Topic with its children recursively attached.
 * This is the in-memory rendering model used by the tree UI and graph view.
 * Built at runtime from a flat Topic[] via buildTreeNodes().
 */
export type TreeNode = Topic & { children: TreeNode[] };

/**
 * The fully-loaded domain object for one user-owned tree.
 * Combines the tree metadata row, the flat topic list,
 * and the assembled root nodes ready for rendering.
 */
export type UserTree = {
  meta: Tree;
  topics: Topic[];
  roots: TreeNode[];
};

export type Topic = {
  id: string;
  user_id: string;
  title: string;
  parent_id: string | null;
  status: AppStatus;
  summary: string;
  notes_count?: number;
  sort_order: number;
  depth: number;
  /** Legacy column kept for backward compatibility. Primary key going forward is tree_id. */
  tree_type: TreeType;
  /** FK → trees.id. Null only for rows created before the add-trees-table migration. */
  tree_id: string | null;
  created_at: string;
  updated_at?: string;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  status: AppStatus;
  category: ProjectCategory;
  priority: ProjectPriority;
  github_url: string | null;
  colab_url: string | null;
  demo_url: string | null;
  tech_stack: string[];
  deadline: string | null;
  lessons_learned: string | null;
  created_at: string;
};

export type SubExpression = {
  expression: string;
  name: string;
  value: string;
};

export type CodeBlock = {
  language: string;
  code: string;
};

export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  topic_id: string | null;
  code_example: string | null;
  math_expression: string | null;
  sub_expressions: SubExpression[] | null;
  code_blocks: CodeBlock[] | null;
  created_at: string;
};

export type Resource = {
  id: string;
  user_id: string;
  title: string;
  type: string;
  url: string;
  created_at: string;
};

export type Mission = {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  status: 'todo' | 'done';
  created_at: string;
};
