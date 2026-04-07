import { supabase } from "./supabase";
import { getSeedTreeBySlug, SEED_TREES } from "../data/seedTrees";
import type { Attachment, CodeBlock, Mission, Note, Project, Resource, SeedNode, SubExpression, Topic, Tree, TreeType } from "../types";

export async function uploadNoteAttachment(file: File): Promise<Attachment> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from('note-attachments')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('note-attachments')
    .getPublicUrl(path);

  return {
    name: file.name,
    url: urlData.publicUrl,
    type: file.type.startsWith('image/') ? 'image' : 'pdf',
    size: file.size,
  };
}

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) {
    throw new Error("User is not authenticated.");
  }
  return data.user.id;
}

export async function getDashboardCounts() {
  const [topics, projects, notes] = await Promise.all([
    supabase.from("topics").select("id", { count: "exact", head: true }),
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase.from("notes").select("id", { count: "exact", head: true }),
  ]);

  return {
    topics: topics.count ?? 0,
    projects: projects.count ?? 0,
    notes: notes.count ?? 0,
  };
}

export async function getDashboardData() {
  const [aiTopics, fsTopics, activeProjects, recentNotes] = await Promise.all([
    supabase.from("topics").select("id, status, parent_id, depth").eq("tree_type", "ai").range(0, 9999),
    supabase.from("topics").select("id, status, parent_id, depth").eq("tree_type", "fullstack").range(0, 9999),
    supabase.from("projects").select("*").neq("status", "done").order("created_at", { ascending: false }).limit(5),
    supabase.from("notes").select("id, title, created_at").order("created_at", { ascending: false }).limit(5),
  ]);

  const leafProgress = (rows: { id: string; status: string; parent_id: string | null }[]) => {
    const parentIds = new Set(rows.map(r => r.parent_id).filter(Boolean) as string[]);
    const leaves = rows.filter(r => !parentIds.has(r.id));
    if (leaves.length === 0) return { done: 0, total: 0, pct: 0 };
    const done = leaves.filter(r => r.status === 'done').length;
    return { done, total: leaves.length, pct: Math.round((done / leaves.length) * 100) };
  };

  const ai = leafProgress((aiTopics.data ?? []) as { id: string; status: string; parent_id: string | null }[]);
  const fs = leafProgress((fsTopics.data ?? []) as { id: string; status: string; parent_id: string | null }[]);

  return {
    ai,
    fs,
    activeProjects: (activeProjects.data ?? []) as Project[],
    recentNotes: (recentNotes.data ?? []) as Pick<Note, 'id' | 'title' | 'created_at'>[],
  };
}


// ─── Tree CRUD ───────────────────────────────────────────────────────────────

export async function listTrees(): Promise<Tree[]> {
  const { data, error } = await supabase
    .from("trees")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Tree[];
}

export async function createTree(payload: {
  name: string;
  description?: string;
  icon?: string | null;
}): Promise<Tree> {
  const userId = await requireUserId();
  const raw = payload.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${raw || "tree"}-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await supabase
    .from("trees")
    .insert({
      user_id: userId,
      name: payload.name.trim(),
      description: payload.description?.trim() ?? "",
      slug,
      icon: payload.icon ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Tree;
}

export async function deleteTree(treeId: string): Promise<void> {
  // Topics cascade-delete via the tree_id FK on delete cascade in the DB.
  const { error } = await supabase.from("trees").delete().eq("id", treeId);
  if (error) throw error;
}

export async function updateTree(
  treeId: string,
  payload: Partial<Pick<Tree, "name" | "description" | "icon">>,
): Promise<Tree> {
  const trimmed: Partial<Pick<Tree, "name" | "description" | "icon">> = {};
  if (payload.name !== undefined) trimmed.name = payload.name.trim();
  if (payload.description !== undefined) trimmed.description = payload.description.trim();
  if (payload.icon !== undefined) trimmed.icon = payload.icon;

  const { data, error } = await supabase
    .from("trees")
    .update(trimmed)
    .eq("id", treeId)
    .select()
    .single();
  if (error) throw error;
  return data as Tree;
}

/**
 * Upserts a trees row for the current user identified by slug.
 * Returns the row id (existing or newly created).
 */
async function getOrCreateTreeForUser(
  userId: string,
  slug: string,
  name: string,
  description: string,
): Promise<string> {
  // Try to find an existing row first.
  const { data: existing } = await supabase
    .from("trees")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const seedDef = getSeedTreeBySlug(slug);
  const { data: created, error } = await supabase
    .from("trees")
    .insert({
      user_id: userId,
      name,
      description,
      slug,
      icon: seedDef?.icon ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return (created as { id: string }).id;
}

// ─── Topics ──────────────────────────────────────────────────────────────────

/**
 * Fetch all topics belonging to a specific tree (by tree_id).
 * This is the primary lookup path after the add-trees-table migration.
 */
export async function listTopicsForTree(treeId: string): Promise<Topic[]> {
  const { data, error } = await supabase
    .from("topics")
    .select("*")
    .eq("tree_id", treeId)
    .range(0, 9999)
    .order("depth", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Topic[];
}

/**
 * Legacy lookup by tree_type string.
 * Still used by GraphPage and getDashboardData; kept for backward compatibility.
 */
export async function listTopics(treeType: TreeType = 'ai') {
  const { data, error } = await supabase
    .from("topics")
    .select("*")
    .eq("tree_type", treeType)
    // ensure we fetch more than the default page size (PostgREST may cap results)
    .range(0, 9999)
    .order("depth", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Topic[];
}

export async function createTopic(payload: {
  title: string;
  summary: string;
  status?: Topic["status"];
  parent_id?: string | null;
  sort_order?: number;
  depth?: number;
  tree_type?: TreeType;
  tree_id?: string | null;
}) {
  const userId = await requireUserId();
  const { error } = await supabase.from("topics").insert({
    user_id: userId,
    title: payload.title,
    summary: payload.summary,
    status: payload.status ?? "not_started",
    parent_id: payload.parent_id ?? null,
    sort_order: payload.sort_order ?? 0,
    depth: payload.depth ?? 0,
    tree_type: payload.tree_type ?? 'ai',
    tree_id: payload.tree_id ?? null,
  });

  if (error) throw error;
}

export async function updateTopic(
  topicId: string,
  payload: Partial<
    Pick<
      Topic,
      "title" | "summary" | "status" | "parent_id" | "sort_order" | "depth"
    >
  >,
) {
  const { error } = await supabase
    .from("topics")
    .update(payload)
    .eq("id", topicId);
  if (error) throw error;
}

export async function toggleTopicDone(topic: Topic) {
  const nextStatus = topic.status === "done" ? "not_started" : "done";
  await updateTopic(topic.id, { status: nextStatus });
}

export async function listProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function createProject(
  payload: Omit<Project, "id" | "user_id" | "created_at">,
) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("projects")
    .insert({ ...payload, user_id: userId });
  if (error) throw error;
}

export async function updateProject(
  id: string,
  payload: Omit<Project, "id" | "user_id" | "created_at">,
) {
  const { error } = await supabase
    .from("projects")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export async function listNotes() {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Note[];
}

export async function listTopicNotes() {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .not("topic_id", "is", null)
    // make sure we get all topic notes (avoid unexpected row caps)
    .order("created_at", { ascending: false })
    .range(0, 9999);

  if (error) throw error;
  return (data ?? []) as Note[];
}

export async function createNote(payload: Pick<Note, "title" | "content">) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("notes")
    .insert({ ...payload, user_id: userId });
  if (error) throw error;
}

export async function createTopicNote(
  topicId: string,
  content: string,
  title?: string,
  codeBlocks?: CodeBlock[],
  mathExpression?: string,
  subExpressions?: SubExpression[],
  attachments?: Attachment[],
) {
  const userId = await requireUserId();
  const { error } = await supabase.from('notes').insert({
    user_id: userId,
    topic_id: topicId,
    title: title?.trim() || 'Quick note',
    content,
    code_blocks: codeBlocks && codeBlocks.length > 0 ? codeBlocks : null,
    math_expression: mathExpression?.trim() || null,
    sub_expressions: subExpressions && subExpressions.length > 0 ? subExpressions : null,
    attachments: attachments && attachments.length > 0 ? attachments : null,
  });

  if (error) throw error;
}

export async function updateTopicNote(
  noteId: string,
  payload: { title: string; content: string; code_blocks?: CodeBlock[] | null; math_expression?: string | null; sub_expressions?: SubExpression[] | null; attachments?: Attachment[] | null },
) {
  const { error } = await supabase
    .from('notes')
    .update(payload)
    .eq('id', noteId);
  if (error) throw error;
}

export async function deleteTopicNote(noteId: string) {
  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  if (error) throw error;
}

export async function deleteTopic(topicId: string) {
  const { error } = await supabase.from("topics").delete().eq("id", topicId);
  if (error) throw error;
}

export async function listResources() {
  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Resource[];
}

export async function createResource(
  payload: Pick<Resource, "title" | "type" | "url">,
) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("resources")
    .insert({ ...payload, user_id: userId });
  if (error) throw error;
}

export async function updateResource(
  id: string,
  payload: Pick<Resource, "title" | "type" | "url">,
) {
  const { error } = await supabase
    .from("resources")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteResource(id: string) {
  const { error } = await supabase.from("resources").delete().eq("id", id);
  if (error) throw error;
}

export async function updateNote(
  id: string,
  payload: {
    title: string;
    content: string;
    code_example?: string | null;
    math_expression?: string | null;
    sub_expressions?: unknown[] | null;
  },
) {
  const { error } = await supabase
    .from("notes")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

const KNOWN_TREE_TYPES = new Set<string>(['ai', 'fullstack']);

/**
 * Returns a safe value for the legacy tree_type column.
 * Only 'ai' and 'fullstack' are meaningful values; any other slug
 * (e.g. an AI-generated slug like 'data-scientist-a3f9b2c1') falls
 * back to 'ai' so DB CHECK constraints are never violated.
 */
function safeTreeType(slug: string): TreeType {
  return KNOWN_TREE_TYPES.has(slug) ? (slug as TreeType) : 'ai';
}

type SeedRow = {
  id: string;
  user_id: string;
  title: string;
  summary: string;
  status: string;
  parent_id: string | null;
  depth: number;
  sort_order: number;
  tree_type: TreeType;
  tree_id: string;
};

/**
 * Recursively walks the seed tree and builds a flat array of rows with
 * pre-generated UUIDs so that parent_id can be set without round-tripping
 * to the database for every node.
 */
function flattenSeedTree(
  node: { title: string; summary?: string; children?: { title: string; summary?: string; children?: any[] }[] },
  userId: string,
  parentId: string | null,
  depth: number,
  sortOrder: number,
  result: SeedRow[],
  treeType: TreeType,
  treeId: string,
): void {
  const id = crypto.randomUUID();
  result.push({
    id,
    user_id: userId,
    title: node.title,
    summary: node.summary ?? "",
    status: "not_started",
    parent_id: parentId,
    depth,
    sort_order: sortOrder,
    tree_type: treeType,
    tree_id: treeId,
  });
  const children = node.children ?? [];
  for (let i = 0; i < children.length; i++) {
    flattenSeedTree(children[i], userId, id, depth + 1, i, result, treeType, treeId);
  }
}

/**
 * Seeds an already-created tree with topics from a SeedNode root.
 * This function only inserts — it does not delete existing topics.
 * Call this on a freshly-created tree; for re-seeding, delete topics first.
 */
export async function seedTreeWithSeedNode(
  treeId: string,
  treeSlug: string,
  root: SeedNode,
): Promise<void> {
  const userId = await requireUserId();
  const rows: SeedRow[] = [];
  flattenSeedTree(root, userId, null, 0, 0, rows, safeTreeType(treeSlug), treeId);
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from('topics').insert(rows.slice(i, i + CHUNK));
    if (error) throw error;
  }
}

/**
 * Seeds any tree by slug. Creates the trees row if needed, wipes the old
 * topic rows for that tree, then re-inserts fresh topic rows with tree_id set.
 * Both `seedDefaultAiTree` and `seedDefaultFullStackTree` delegate here.
 */
export async function seedTreeFromSlug(slug: string): Promise<Tree> {
  const seedDef = getSeedTreeBySlug(slug);
  if (!seedDef) throw new Error(`No seed definition found for tree slug: "${slug}"`);

  const userId = await requireUserId();

  // Upsert the trees row and get its id.
  const treeId = await getOrCreateTreeForUser(
    userId,
    seedDef.slug,
    seedDef.name,
    seedDef.description,
  );

  // Delete existing topics for this tree (by tree_id first, then by tree_type
  // for any legacy rows that had no tree_id yet).
  const { error: delById } = await supabase
    .from("topics")
    .delete()
    .eq("tree_id", treeId);
  if (delById) throw delById;

  const { error: delLegacy } = await supabase
    .from("topics")
    .delete()
    .eq("user_id", userId)
    .eq("tree_type", slug)
    .is("tree_id", null);
  if (delLegacy) throw delLegacy;

  // Build and batch-insert the fresh topic rows.
  const rows: SeedRow[] = [];
  flattenSeedTree(seedDef.data, userId, null, 0, 0, rows, safeTreeType(slug), treeId);

  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from("topics").insert(rows.slice(i, i + CHUNK));
    if (error) throw error;
  }

  // Return the updated trees row so callers can update their local state.
  const { data, error: fetchErr } = await supabase
    .from("trees")
    .select("*")
    .eq("id", treeId)
    .single();
  if (fetchErr) throw fetchErr;
  return data as Tree;
}

/** @deprecated Use seedTreeFromSlug('ai') instead. Kept for backward compatibility. */
export async function seedDefaultAiTree() {
  await seedTreeFromSlug('ai');
}

/** @deprecated Use seedTreeFromSlug('fullstack') instead. Kept for backward compatibility. */
export async function seedDefaultFullStackTree() {
  await seedTreeFromSlug('fullstack');
}

// Expose SEED_TREES so the UI can render seed options without importing from data/.
export { SEED_TREES };

/* ─── Missions ─────────────────────────────────────────────────────────────── */

export async function listMissions(projectId: string): Promise<Mission[]> {
  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Mission[];
}

export async function createMission(projectId: string, title: string): Promise<Mission> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("missions")
    .insert({ project_id: projectId, user_id: userId, title: title.trim(), status: "todo" })
    .select()
    .single();
  if (error) throw error;
  return data as Mission;
}

export async function updateMission(id: string, status: Mission["status"]): Promise<void> {
  const { error } = await supabase.from("missions").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteMission(id: string): Promise<void> {
  const { error } = await supabase.from("missions").delete().eq("id", id);
  if (error) throw error;
}
