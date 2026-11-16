import { z } from "zod";
import { publicText } from "../editorial/model.ts";

const localPath = z.string().regex(/^\/[a-z0-9/#%._~!$&'()*+,;=:@?+-]*$/i);
export const targetSchema = z
  .object({
    id: z.string().regex(/^record-[a-f0-9]{12}$/),
    title: publicText.min(1),
    source: publicText,
    status: z.enum(["ready", "recovered", "missing", "external"]),
    href: localPath,
    readingHref: localPath.optional(),
    timestamp: z.string().optional(),
    mediaType: z.string().optional(),
    fragmentMissing: z.boolean().optional(),
  })
  .superRefine((target, ctx) => {
    if ((target.status === "ready") !== Boolean(target.readingHref))
      ctx.addIssue({
        code: "custom",
        message: "Read-here status requires a published reading target",
      });
    if (
      target.href !== (target.readingHref ?? `/archive-records/${target.id}/`)
    )
      ctx.addIssue({
        code: "custom",
        message: "Reference must lead to its reading page or its own record",
      });
  });
export const groupSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  source: z.string(),
  title: z.object({ it: publicText, en: publicText }),
  count: z.number().int().nonnegative(),
  historical: z.boolean().optional(),
  timestamp: z.string().optional(),
});
export const promptSchema = z.object({
  id: z.string(),
  title: publicText,
  body: publicText,
  authors: z.array(publicText),
  group: z.string(),
  source: z.string(),
  block: z.number().int().nonnegative(),
  readingHref: localPath.optional(),
  targets: z.array(z.string()),
  references: z.array(z.string()).default([]),
});
export const catalogEntrySchema = z.object({
  id: z.string(),
  title: publicText,
  caption: publicText,
  group: z.string(),
  source: z.string(),
  cell: z.number().int().nonnegative(),
  targets: z.array(z.string()).min(1),
});
export const browseSchema = z
  .object({
    version: z.literal(1),
    promptGroups: z.array(groupSchema),
    workGroups: z.array(groupSchema),
    prompts: z.array(promptSchema),
    entries: z.array(catalogEntrySchema),
    targets: z.array(targetSchema),
  })
  .superRefine((data, ctx) => {
    const unique = (ids: string[]) => new Set(ids).size === ids.length;
    if (
      !unique(data.targets.map((t) => t.id)) ||
      !unique(data.prompts.map((p) => p.id)) ||
      !unique(data.entries.map((e) => e.id))
    )
      ctx.addIssue({ code: "custom", message: "Duplicate browse identifiers" });
    const targets = new Set(data.targets.map((t) => t.id));
    for (const entry of [...data.prompts, ...data.entries])
      for (const id of [
        ...entry.targets,
        ...("references" in entry ? entry.references : []),
      ])
        if (!targets.has(id))
          ctx.addIssue({ code: "custom", message: `Unknown target: ${id}` });
    for (const [groups, entries] of [
      [data.promptGroups, data.prompts],
      [data.workGroups, data.entries],
    ] as const) {
      for (const entry of entries)
        if (!groups.some((g) => g.id === entry.group))
          ctx.addIssue({
            code: "custom",
            message: `Unknown group: ${entry.group}`,
          });
      for (const group of groups)
        if (entries.filter((e) => e.group === group.id).length !== group.count)
          ctx.addIssue({
            code: "custom",
            message: `Group count mismatch: ${group.id}`,
          });
    }
  });
export type BrowseData = z.infer<typeof browseSchema>;
export type BrowseTarget = z.infer<typeof targetSchema>;
export type BrowseGroup = z.infer<typeof groupSchema>;
export type BrowsePrompt = z.infer<typeof promptSchema>;
export type BrowseEntry = z.infer<typeof catalogEntrySchema>;
