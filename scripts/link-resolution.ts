import { redact } from "./editorial-core.ts";
import { type ArchiveDocument, sha256, urlKey } from "./recovery/core.ts";
export type GapReason =
  | "archive-missing"
  | "edition-pending"
  | "attachment-pending"
  | "external-excluded"
  | "unsupported-format"
  | "unsupported-query"
  | "archive-unlisted"
  | "anchor-missing";
export type Gap = {
  id: string;
  resource: string;
  source: string;
  reason: GapReason;
  image: boolean;
};
export function explainedGap(
  href: string,
  source: string,
  image: boolean,
  documents: Map<string, ArchiveDocument>,
  override?: GapReason,
): Gap {
  let reason = override;
  let resource = href;
  if (!reason)
    try {
      const u = new URL(href, source);
      resource = u.href;
      if (
        !["www.fmboschetto.it", "fmboschetto.it"].includes(u.hostname) ||
        !["http:", "https:"].includes(u.protocol)
      )
        reason = "external-excluded";
      else if (u.search) reason = "unsupported-query";
      else {
        const d = documents.get(urlKey(u.href.split("#")[0]));
        reason = !d
          ? "archive-unlisted"
          : !d.outcome.startsWith("recovered")
            ? "archive-missing"
            : /pdf|msword|zip|powerpoint/i.test(d.type ?? "")
              ? "attachment-pending"
              : image && /\.bmp$/i.test(d.path ?? "")
                ? "unsupported-format"
                : /html|image/i.test(d.type ?? "")
                  ? "edition-pending"
                  : "unsupported-format";
      }
    } catch {
      reason = "external-excluded";
    }
  resource = redact(resource);
  source = redact(source);
  return {
    id: `gap-${sha256(Buffer.from(`${source}:${resource}:${reason}`)).slice(0, 12)}`,
    resource,
    source,
    reason: reason ?? "external-excluded",
    image,
  };
}
