/** One stop of a work's outline, as written by scripts/structured.ts. */
export type OutlineItem = {
  id: string;
  label: string;
  kind: "section" | "pod" | "entry" | "contribution" | "piece";
  depth: number;
  start?: number;
  end?: number;
  author?: string;
  contribution?: "comment" | "addition" | "variant" | "reply";
  replyTo?: string;
  size?: number;
};
