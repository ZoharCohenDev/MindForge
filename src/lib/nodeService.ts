/**
 * Node service — data-layer operations for individual tree nodes (topics).
 *
 * Keeps node-level mutations separate from tree-level mutations (treeService)
 * so each layer has a single, well-scoped responsibility.
 *
 * Consumers should prefer calling these methods through the useTreeEditor
 * hook rather than directly, so local state stays in sync automatically.
 */

import { createTopic, deleteTopic, updateTopic } from "./dataApi";
import type { TreeType } from "../types";

export type AddChildPayload = {
  /** Parent topic id. */
  parentId: string;
  /** Display title for the new node. */
  title: string;
  /** Optional summary / description text. Defaults to "". */
  summary?: string;
  /** Depth level in the tree hierarchy (parent.depth + 1). */
  depth: number;
  /** 0-based position among siblings (used for initial ordering). */
  sortOrder: number;
  /** FK → trees.id */
  treeId: string;
  /** Legacy tree_type column value; pass tree.slug. */
  treeSlug: string;
};

export const nodeService = {
  /**
   * Inserts a new child topic under the given parent.
   * Depth and sort order must be computed by the caller; this function
   * does no sibling-count queries of its own.
   */
  addChild: (payload: AddChildPayload): Promise<void> =>
    createTopic({
      title: payload.title.trim(),
      summary: payload.summary ?? "",
      parent_id: payload.parentId,
      depth: payload.depth,
      sort_order: payload.sortOrder,
      status: "not_started",
      tree_type: payload.treeSlug as TreeType,
      tree_id: payload.treeId,
    }),

  /**
   * Updates the display title of an existing topic.
   * Other fields (summary, status, etc.) are unchanged.
   */
  rename: (topicId: string, title: string): Promise<void> =>
    updateTopic(topicId, { title: title.trim() }),

  /**
   * Deletes a topic row. Child topics are cascade-deleted by the database
   * via the parent_id ON DELETE CASCADE constraint.
   */
  delete: (topicId: string): Promise<void> => deleteTopic(topicId),

  /**
   * Writes a new sort_order value for a single topic.
   * Call in pairs when swapping two siblings (see computeReorderSwap).
   */
  setOrder: (topicId: string, sortOrder: number): Promise<void> =>
    updateTopic(topicId, { sort_order: sortOrder }),
};
