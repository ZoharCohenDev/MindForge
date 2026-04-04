/**
 * useTreeEditor — manages the complete in-memory state for an open tree.
 *
 * Encapsulates:
 *  - Data loading (topics + notes for the active tree)
 *  - Derived views (treeNodes, notesByTopic, leafTopics, inGraphIds)
 *  - All node mutations: toggle done, add child, rename, delete, reorder
 *  - Note deletion
 *
 * TopicsPage (and future screen components) consume this hook instead of
 * calling dataApi directly for node-level operations. This keeps each
 * consumer lean and makes node editing logic easy to extend.
 *
 * Design rules:
 *  - Every mutation that is called standalone (delete, reorder) triggers a
 *    refresh internally so callers don't have to.
 *  - addChild does NOT trigger an internal refresh — callers that embed it
 *    in a modal save flow are responsible for calling editor.refresh(true)
 *    after any note saves that follow in the same operation.
 *    For standalone "add child" UI (future), call editor.refresh(true) after.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteTopicNote,
  listTopicNotes,
  listTopicsForTree,
  toggleTopicDone,
} from "./dataApi";
import { nodeService } from "./nodeService";
import type { Note, Topic, Tree, TreeNode } from "../types";
import {
  buildTreeNodes,
  computeReorderSwap,
  makeExpandToDepth,
} from "./treeUtils";

// ── Internal helpers ─────────────────────────────────────────────────────────

function groupNotesByTopic(notes: Note[]): Record<string, Note[]> {
  return notes.reduce<Record<string, Note[]>>((acc, note) => {
    if (!note.topic_id) return acc;
    (acc[note.topic_id] ??= []).push(note);
    return acc;
  }, {});
}

// ── Public types ─────────────────────────────────────────────────────────────

export type TreeEditorState = {
  topics: Topic[];
  notes: Note[];
  /** Assembled tree hierarchy — use for rendering recursive node trees. */
  treeNodes: TreeNode[];
  /** Notes keyed by topic id — use for note badges and view-notes panels. */
  notesByTopic: Record<string, Note[]>;
  /** expand/collapse state keyed by topic id. */
  expandedIds: Record<string, boolean>;
  setExpandedIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  /** Only the leaf nodes (no children), used for progress calculations. */
  leafTopics: Topic[];
  /** 0-100 completion percentage across all leaf topics. */
  overallProgress: number;
  /**
   * IDs of topics visible in the Knowledge Graph:
   * every "done" topic plus all its ancestors.
   */
  inGraphIds: Set<string>;
  isRefreshing: boolean;
  editorError: string | null;
  setEditorError: (msg: string | null) => void;
};

export type TreeEditorActions = {
  /** Reload topics and notes from the database. */
  refresh: (preserveExpanded?: boolean) => Promise<void>;
  /** Toggle expand/collapse for a node. */
  toggleExpanded: (id: string) => void;
  /** Optimistically flip a node's done/not_started status. */
  toggleDone: (node: TreeNode) => void;
  /**
   * Create a new child topic under `parent`.
   * Expands the parent node in local state.
   * Does NOT trigger a refresh — call editor.refresh(true) after any
   * additional work in the same save flow (e.g. note creation).
   * For standalone "add child" buttons, call refresh(true) afterward.
   */
  addChild: (
    parent: Pick<Topic, "id" | "depth">,
    title: string,
    treeSlug: string,
    treeId: string,
  ) => Promise<void>;
  /** Rename a node's title and refresh. */
  renameNode: (nodeId: string, title: string) => Promise<void>;
  /** Delete a node (DB cascades children) and refresh. */
  deleteNode: (nodeId: string) => Promise<void>;
  /**
   * Move a node one step up or down among its siblings.
   * Applies an optimistic local sort_order swap, then persists.
   * Reverts on failure.
   */
  reorderNode: (nodeId: string, direction: "up" | "down") => Promise<void>;
  /** Delete a note by id and refresh (preserving expand state). */
  deleteNote: (noteId: string) => Promise<void>;
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTreeEditor(
  activeTree: Tree | null,
): TreeEditorState & TreeEditorActions {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Load (or clear) whenever the active tree changes.
  const refresh = useCallback(
    async (preserveExpanded = false) => {
      if (!activeTree) return;
      setIsRefreshing(true);
      setEditorError(null);
      try {
        const [topicRows, noteRows] = await Promise.all([
          listTopicsForTree(activeTree.id),
          listTopicNotes(),
        ]);
        setTopics(topicRows);
        setNotes(noteRows);
        if (!preserveExpanded) {
          setExpandedIds(makeExpandToDepth(topicRows));
        }
      } catch (err) {
        console.error(err);
        setEditorError("Could not load the tree.");
      } finally {
        setIsRefreshing(false);
      }
    },
    // activeTree.id drives re-creation; the full object is in scope via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTree?.id],
  );

  useEffect(() => {
    if (activeTree) {
      void refresh();
    } else {
      // Clear stale data when no tree is open (e.g. navigating back to list).
      setTopics([]);
      setNotes([]);
      setExpandedIds({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTree?.id]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const treeNodes = useMemo(() => buildTreeNodes(topics), [topics]);

  const notesByTopic = useMemo(() => groupNotesByTopic(notes), [notes]);

  const leafTopics = useMemo(() => {
    const parentIds = new Set(topics.map((t) => t.parent_id).filter(Boolean));
    return topics.filter((t) => !parentIds.has(t.id));
  }, [topics]);

  const overallProgress = useMemo(() => {
    if (leafTopics.length === 0) return 0;
    const done = leafTopics.filter((t) => t.status === "done").length;
    return Math.round((done / leafTopics.length) * 100);
  }, [leafTopics]);

  const inGraphIds = useMemo<Set<string>>(() => {
    const topicMap = new Map(topics.map((t) => [t.id, t]));
    const doneSet = new Set(
      topics.filter((t) => t.status === "done").map((t) => t.id),
    );
    const included = new Set<string>();
    doneSet.forEach((id) => {
      let cur: Topic | undefined = topicMap.get(id);
      while (cur) {
        included.add(cur.id);
        cur = cur.parent_id ? topicMap.get(cur.parent_id) : undefined;
      }
    });
    return included;
  }, [topics]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const toggleExpanded = useCallback(
    (id: string) => setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] })),
    [],
  );

  const toggleDone = useCallback((node: TreeNode) => {
    const next = node.status === "done" ? "not_started" : "done";
    setTopics((prev) =>
      prev.map((t) => (t.id === node.id ? { ...t, status: next } : t)),
    );
    void toggleTopicDone(node).catch((err) => {
      console.error(err);
      // Revert on DB failure.
      setTopics((prev) =>
        prev.map((t) => (t.id === node.id ? { ...t, status: node.status } : t)),
      );
    });
  }, []);

  const addChild = useCallback(
    async (
      parent: Pick<Topic, "id" | "depth">,
      title: string,
      treeSlug: string,
      treeId: string,
    ) => {
      const siblingCount = topics.filter(
        (t) => t.parent_id === parent.id,
      ).length;
      await nodeService.addChild({
        parentId: parent.id,
        title,
        depth: parent.depth + 1,
        sortOrder: siblingCount,
        treeId,
        treeSlug,
      });
      // Expand the parent so the new child is immediately visible.
      setExpandedIds((prev) => ({ ...prev, [parent.id]: true }));
    },
    [topics],
  );

  const renameNode = useCallback(
    async (nodeId: string, title: string) => {
      await nodeService.rename(nodeId, title);
      await refresh(true);
    },
    [refresh],
  );

  const deleteNode = useCallback(
    async (nodeId: string) => {
      await nodeService.delete(nodeId);
      await refresh();
    },
    [refresh],
  );

  const reorderNode = useCallback(
    async (nodeId: string, direction: "up" | "down") => {
      const node = topics.find((t) => t.id === nodeId);
      if (!node) return;
      const siblings = topics.filter((t) => t.parent_id === node.parent_id);
      const swaps = computeReorderSwap(siblings, nodeId, direction);
      if (!swaps) return;
      const [a, b] = swaps;
      // Optimistic local update — apply immediately so UI responds instantly.
      setTopics((prev) =>
        prev.map((t) =>
          t.id === a.id
            ? { ...t, sort_order: a.sort_order }
            : t.id === b.id
              ? { ...t, sort_order: b.sort_order }
              : t,
        ),
      );
      try {
        await Promise.all([
          nodeService.setOrder(a.id, a.sort_order),
          nodeService.setOrder(b.id, b.sort_order),
        ]);
      } catch (err) {
        console.error(err);
        // Revert on failure.
        await refresh(true);
      }
    },
    [topics, refresh],
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      await deleteTopicNote(noteId);
      await refresh(true);
    },
    [refresh],
  );

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    topics,
    notes,
    treeNodes,
    notesByTopic,
    expandedIds,
    setExpandedIds,
    leafTopics,
    overallProgress,
    inGraphIds,
    isRefreshing,
    editorError,
    setEditorError,
    refresh,
    toggleExpanded,
    toggleDone,
    addChild,
    renameNode,
    deleteNode,
    reorderNode,
    deleteNote,
  };
}
