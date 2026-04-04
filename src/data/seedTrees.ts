import { defaultAiTree } from "./defaultAiTree";
import { defaultFullStackTree } from "./defaultFullStackTree";
import type { SeedNode } from "../types";

export type SeedTreeDef = {
  /** Matches the legacy `tree_type` column in `topics`. */
  slug: string;
  name: string;
  description: string;
  icon: string;
  data: SeedNode;
};

export const SEED_TREES: SeedTreeDef[] = [
  {
    slug: "ai",
    name: "Artificial Intelligence",
    description: "Your full AI learning map.",
    icon: "🤖",
    data: defaultAiTree,
  },
  {
    slug: "fullstack",
    name: "Full Stack Development",
    description: "The complete Full Stack learning tree.",
    icon: "🌐",
    data: defaultFullStackTree,
  },
];

export function getSeedTreeBySlug(slug: string): SeedTreeDef | undefined {
  return SEED_TREES.find((t) => t.slug === slug);
}
