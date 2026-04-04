export type SeedNode = {
  title: string;
  summary: string;
  children?: SeedNode[];
};

export type GeneratedTreePayload = {
  name: string;
  description: string;
  icon: string;
  tree: SeedNode;
};
