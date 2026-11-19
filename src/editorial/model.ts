import { z } from "zod";

const email = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;
export const publicText = z
  .string()
  .refine(
    (value) => !email.test(value),
    "Email addresses belong only to the untouched archive",
  );
export const identifier = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
export const languageSchema = z.enum(["it", "fr", "es", "en", "unknown"]);
export const reviewSchema = z.object({
  by: z.enum(["agent", "owner"]),
  state: z.enum(["proposed", "approved", "deferred"]),
  reason: publicText.min(1),
  quote: publicText,
});
export const interpretation = <T extends z.ZodType>(value: T) =>
  z.object({
    value: z.union([value, z.literal("unknown")]),
    review: reviewSchema,
  });
export const documentSchema = z.object({
  id: identifier,
  url: z.url(),
  path: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  mediaType: z.string(),
  timestamp: z
    .string()
    .regex(/^\d{14}$/)
    .optional(),
  retrievedAt: z.iso.datetime().optional(),
  source: z.enum(["wayback", "origin"]),
});
export const sourceSchema = z.object({
  documentId: identifier,
  url: z.url(),
  /** A file inside a zip document (S7), named exactly as in the archive. */
  entry: z.string().min(1).max(300).optional(),
  timestamp: z
    .string()
    .regex(/^\d{14}$/)
    .optional(),
  selection: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("whole") }),
    z
      .object({
        kind: z.literal("blocks"),
        start: z.number().int().nonnegative(),
        end: z.number().int().positive(),
        digest: z.string().regex(/^[a-f0-9]{64}$/),
        anchor: z.string().optional(),
      })
      .refine((s) => s.end > s.start, "Empty or reversed block selection"),
  ]),
});
export const authorSchema = z.object({
  id: identifier,
  name: publicText.min(1),
  review: reviewSchema,
  documents: z.array(identifier).min(1),
});
export const eraSchema = z
  .object({
    id: identifier,
    label: publicText.min(1),
    start: z.number().int().optional(),
    end: z.number().int().optional(),
    outsideTime: z.boolean().default(false),
    review: reviewSchema,
  })
  .refine(
    (v) =>
      v.outsideTime ||
      (v.start !== undefined && v.end !== undefined && v.start <= v.end),
    "An era needs an ordered range or outsideTime",
  );
export const placeSchema = z.object({
  id: identifier,
  label: publicText.min(1),
  review: reviewSchema,
});
export const themeSchema = z.object({
  id: identifier,
  label: publicText.min(1),
  review: reviewSchema,
});
export const contributionSchema = z.object({
  id: identifier,
  localId: z.string(),
  itemId: identifier,
  documentId: identifier,
  authorId: identifier.optional(),
  kind: interpretation(z.enum(["comment", "addition", "variant", "reply"])),
  replyTo: identifier.optional(),
  replyToLocalId: z.string().optional(),
  replyReview: reviewSchema.optional(),
  quote: publicText,
  anchor: z.string().optional(),
});
export const classificationSchema = z.object({
  divergences: interpretation(z.array(z.number().int())),
  eras: interpretation(z.array(identifier)),
  places: interpretation(z.array(identifier)),
  themes: interpretation(z.array(identifier)),
  kind: interpretation(
    z.enum(["uchronia", "utopia", "story", "chronology", "essay", "game"]),
  ),
  world: interpretation(identifier),
});
export const itemSchema = z.object({
  id: identifier,
  slug: identifier,
  title: publicText.min(1),
  level: z.enum(["divergence", "work", "world"]),
  authors: z.array(identifier),
  language: interpretation(languageSchema),
  sources: z.array(sourceSchema).min(1),
  composition: z.enum(["single", "chapters", "equivalent"]).default("single"),
  classification: classificationSchema,
  contributions: z.array(contributionSchema).default([]),
  developedIn: z.array(identifier).default([]),
  parent: identifier.optional(),
  review: reviewSchema,
});
export const proposalSchema = z.object({
  id: identifier,
  documents: z.array(identifier).min(1),
  action: z.enum([
    "work",
    "split",
    "merge",
    "world",
    "index",
    "discard",
    "attachment",
  ]),
  level: z.enum(["divergence", "work", "world", "none"]),
  targets: z.array(identifier),
  review: reviewSchema,
});
export const mapSchema = z
  .object({
    version: z.literal(1),
    manifestDigest: z.string().regex(/^[a-f0-9]{64}$/),
    documents: z.array(documentSchema),
    authors: z.array(authorSchema),
    eras: z.array(eraSchema),
    places: z.array(placeSchema),
    themes: z.array(themeSchema),
    proposals: z.array(proposalSchema),
    items: z.array(itemSchema),
  })
  .superRefine((map, ctx) => {
    const unique = (values: { id: string }[], key: string) => {
      const seen = new Set<string>();
      for (const v of values) {
        if (seen.has(v.id))
          ctx.addIssue({
            code: "custom",
            message: `Duplicate ${key}: ${v.id}`,
          });
        seen.add(v.id);
      }
      return seen;
    };
    const docs = unique(map.documents, "document");
    const authors = unique(map.authors, "author");
    const items = unique(map.items, "item");
    unique(map.proposals, "proposal");
    const eras = unique(map.eras, "era");
    const places = unique(map.places, "place");
    const themes = unique(map.themes, "theme");
    const slugs = new Set<string>();
    const check = (ids: string[], valid: Set<string>, label: string) => {
      for (const id of ids)
        if (!valid.has(id))
          ctx.addIssue({ code: "custom", message: `Unknown ${label}: ${id}` });
    };
    for (const author of map.authors)
      check(author.documents, docs, "author source");
    for (const p of map.proposals) {
      check(p.documents, docs, "proposal source");
      check(p.targets, items, "proposal target");
    }
    for (const item of map.items) {
      if (slugs.has(item.slug))
        ctx.addIssue({
          code: "custom",
          message: `Duplicate slug: ${item.slug}`,
        });
      slugs.add(item.slug);
      check(item.authors, authors, "item author");
      check(
        item.sources.map((s) => s.documentId),
        docs,
        "item source",
      );
      check(item.developedIn, items, "developed work");
      if (item.parent) check([item.parent], items, "parent");
      for (const [key, registry] of [
        ["eras", eras],
        ["places", places],
        ["themes", themes],
      ] as const) {
        const value = item.classification[key].value;
        if (value !== "unknown") check(value, registry, key);
      }
      if (item.classification.world.value !== "unknown")
        check(
          [item.classification.world.value],
          new Set(
            map.items.filter((i) => i.level === "world").map((i) => i.id),
          ),
          "world",
        );
      const contributionIds = unique(item.contributions, "contribution");
      if (item.composition === "single" && item.sources.length > 1)
        ctx.addIssue({
          code: "custom",
          message: `Multiple sources require an explicit composition: ${item.id}`,
        });
      for (const c of item.contributions) {
        if (c.itemId !== item.id)
          ctx.addIssue({
            code: "custom",
            message: `Contribution has wrong parent: ${c.id}`,
          });
        check([c.documentId], docs, "contribution source");
        if (c.authorId) check([c.authorId], authors, "contributor");
        if (c.replyTo) {
          check(
            [c.replyTo],
            new Set([...contributionIds, ...items]),
            "reply target",
          );
          if (!c.replyReview)
            ctx.addIssue({
              code: "custom",
              message: `Reply relation lacks review evidence: ${c.id}`,
            });
        }
        if (c.replyTo === c.id)
          ctx.addIssue({ code: "custom", message: `Self-reply: ${c.id}` });
      }
    }
  });
export const correctionSchema = z.array(
  z.object({
    from: z.string().min(1),
    to: z.string(),
    reason: publicText.optional(),
  }),
);
export type EditorialMap = z.infer<typeof mapSchema>;
export type EditorialItem = z.infer<typeof itemSchema>;
export type EditorialSource = z.infer<typeof sourceSchema>;
export type Review = z.infer<typeof reviewSchema>;
