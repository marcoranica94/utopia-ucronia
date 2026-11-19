import { z } from "zod";

/**
 * Worlds and cycles (S4). A world is one alternative history told across
 * many pages with its own table of contents; a cycle is a set of separate
 * works that the original site grouped under a shared heading repeated on
 * every member. Chapters stay ordinary reading items at their /works/ paths:
 * a world only orders and groups them, so no published URL changes.
 *
 * The chapters are never written by hand: `pnpm worlds propose` derives them
 * from the source named in `source`, and `pnpm worlds check` (part of the
 * build) derives them again and fails if the file disagrees with the archive.
 */

const review = z.object({
  by: z.enum(["agent", "owner"]),
  state: z.enum(["proposed", "approved", "deferred"]),
  reason: z.string().min(1),
  quote: z.string().min(1),
});

export const worldSourceSchema = z.discriminatedUnion("kind", [
  // A page whose links, in order, are the chapters (a frame's contents bar).
  z.object({
    kind: z.literal("contents"),
    document: z.string().min(1),
    /** Contents links that are not chapters (introductions kept as index). */
    exclude: z.array(z.string().min(1)).default([]),
  }),
  // A heading repeated on each member above the list of the other members.
  z.object({ kind: z.literal("navigation"), heading: z.string().min(1) }),
  // The links listed under a section heading of one page, up to the next
  // heading set in the same type (an author's cycles on racconti.htm, S8).
  z.object({
    kind: z.literal("section"),
    document: z.string().min(1),
    heading: z.string().min(1),
  }),
  // The readable files inside one zip, in the order of their names (S8).
  z.object({ kind: z.literal("zip"), document: z.string().min(1) }),
  // Published works titled "<prefix> Parte prima", "… seconda", … in the
  // order of the part number (S8).
  z.object({ kind: z.literal("series"), prefix: z.string().min(1) }),
]);

export const worldChapterSchema = z.object({
  documentId: z.string().regex(/^doc-[0-9a-f]{12}$/),
  path: z.string().min(1),
  /** A file inside the zip at `path`. */
  entry: z.string().min(1).optional(),
});

export const worldSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  form: z.enum(["world", "cycle"]),
  language: z.enum(["it", "fr", "es", "en"]),
  /** One interface sentence on what the world is, in both site languages. */
  description: z.object({ it: z.string().min(1), en: z.string().min(1) }),
  source: worldSourceSchema,
  /** A quotation from an original document that names the world. */
  evidence: z.object({ document: z.string().min(1), quote: z.string().min(1) }),
  review,
  chapters: z.array(worldChapterSchema).default([]),
});

export const worldsFileSchema = z.object({
  version: z.literal(1),
  worlds: z.array(worldSchema),
  /** Link clusters looked at and not proposed, with the reason. */
  rejected: z
    .array(
      z.object({
        documents: z.array(z.string().min(1)).min(1),
        reason: z.string().min(1),
      }),
    )
    .default([]),
});

export type World = z.infer<typeof worldSchema>;
export type WorldsFile = z.infer<typeof worldsFileSchema>;
export type WorldChapter = z.infer<typeof worldChapterSchema>;
