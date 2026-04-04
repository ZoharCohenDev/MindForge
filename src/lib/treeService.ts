/**
 * Tree service — the single entry point for all tree-level operations.
 *
 * Pages and components should import from here rather than calling dataApi
 * directly for tree management. Topic-level operations (createTopic, etc.)
 * remain on dataApi since they are more granular and numerous.
 *
 * This boundary makes it easy to:
 *  - swap implementations (e.g. add AI-generation without touching pages)
 *  - add caching or optimistic logic in one place
 *  - test tree operations in isolation
 */

import {
  listTrees,
  createTree,
  updateTree,
  deleteTree,
  seedTreeFromSlug,
  seedTreeWithSeedNode,
} from "./dataApi";
import { generateTreeFromGoal } from "./treeGeneration";
import type { Tree } from "../types";

export type CreateTreeInput = {
  name: string;
  description?: string;
  icon?: string | null;
};

export const treeService = {
  /** Fetch all trees owned by the current user. */
  getAll: (): Promise<Tree[]> => listTrees(),

  /** Create a new blank tree with the given metadata. */
  create: (input: CreateTreeInput): Promise<Tree> => createTree(input),

  /** Update a tree's name, description, or icon. */
  update: (
    treeId: string,
    patch: Partial<Pick<Tree, "name" | "description" | "icon">>,
  ): Promise<Tree> => updateTree(treeId, patch),

  /**
   * Delete a tree and all its topics.
   * Topic deletion is handled by the cascade FK on topics.tree_id.
   */
  delete: (treeId: string): Promise<void> => deleteTree(treeId),

  /**
   * Seed a tree from a built-in template by slug ('ai' | 'fullstack').
   * Creates the trees row if needed, then populates topic rows from
   * the static seed data. Returns the updated Tree metadata row.
   */
  seedFromTemplate: (slug: string): Promise<Tree> => seedTreeFromSlug(slug),

  /**
   * Calls the AI generation API with a career goal, creates a new tree row,
   * and seeds it with the AI-generated topic structure in a single operation.
   * Falls back to a mock response when OPENAI_API_KEY is not configured.
   */
  generateAndCreate: async (careerGoal: string): Promise<Tree> => {
    const payload = await generateTreeFromGoal(careerGoal);
    const tree = await createTree({
      name: payload.name,
      description: payload.description,
      icon: payload.icon,
    });
    await seedTreeWithSeedNode(tree.id, tree.slug, payload.tree);
    return tree;
  },
};
