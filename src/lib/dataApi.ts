import { supabase } from "./supabase";
import { defaultAiTree } from "../data/defaultAiTree";
import { defaultFullStackTree } from "../data/defaultFullStackTree";
import type { CodeBlock, Mission, Note, Project, Resource, SubExpression, Topic, TreeType } from "../types";

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
) {
  const userId = await requireUserId();
  const { error } = await supabase.from("notes").insert({
    user_id: userId,
    topic_id: topicId,
    title: title?.trim() || "Quick note",
    content,
    code_blocks: codeBlocks && codeBlocks.length > 0 ? codeBlocks : null,
    math_expression: mathExpression?.trim() || null,
    sub_expressions: subExpressions && subExpressions.length > 0 ? subExpressions : null,
  });

  if (error) throw error;
}

export async function updateTopicNote(
  noteId: string,
  payload: { title: string; content: string; code_blocks?: CodeBlock[] | null; math_expression?: string | null; sub_expressions?: SubExpression[] | null },
) {
  const { error } = await supabase
    .from("notes")
    .update(payload)
    .eq("id", noteId);
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
  });
  const children = node.children ?? [];
  for (let i = 0; i < children.length; i++) {
    flattenSeedTree(children[i], userId, id, depth + 1, i, result, treeType);
  }
}

export async function seedDefaultAiTree() {
  const userId = await requireUserId();

  // Remove only AI-tree topics so other trees are untouched.
  const { error: deleteError } = await supabase
    .from("topics")
    .delete()
    .eq("user_id", userId)
    .eq("tree_type", "ai");
  if (deleteError) throw deleteError;

  // Build the full flat list with all IDs assigned client-side.
  const rows: SeedRow[] = [];
  flattenSeedTree(defaultAiTree, userId, null, 0, 0, rows, "ai");

  // Batch-insert in chunks of 100 to stay well within PostgREST limits.
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from("topics").insert(rows.slice(i, i + CHUNK));
    if (error) throw error;
  }
}

export async function seedDefaultFullStackTree() {
  const userId = await requireUserId();

  // Remove only Full Stack tree topics so other trees are untouched.
  const { error: deleteError } = await supabase
    .from("topics")
    .delete()
    .eq("user_id", userId)
    .eq("tree_type", "fullstack");
  if (deleteError) throw deleteError;

  // Build the full flat list with all IDs assigned client-side.
  const rows: SeedRow[] = [];
  flattenSeedTree(defaultFullStackTree, userId, null, 0, 0, rows, "fullstack");

  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from("topics").insert(rows.slice(i, i + CHUNK));
    if (error) throw error;
  }
}

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
