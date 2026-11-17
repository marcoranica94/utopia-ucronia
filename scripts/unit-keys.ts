import type { BuildCache } from "./build-cache.ts";

/** Cache keys of the conversion and fidelity units. Kept apart from the
 * scripts so that tests can show each input really invalidates its unit. */

/** One conversion page: descriptor (item, parts, title, language), its
 * corrections, and for every source the document record and current bytes
 * (or, for a legacy preview, the decoded HTML). Routing tables are not part
 * of the key: the recorded lookups are replayed against them instead. */
export function convertPageKey<T>(
  cache: BuildCache<T>,
  descriptor: unknown,
  corrections: unknown,
  sources: { document: unknown; bytes: Uint8Array }[] | { html: string },
): string {
  const inputs: (string | Uint8Array)[] = [
    JSON.stringify(descriptor),
    JSON.stringify(corrections),
  ];
  if ("html" in sources) inputs.push("html", sources.html);
  else
    for (const source of sources)
      inputs.push(JSON.stringify(source.document), source.bytes);
  return cache.key(...inputs);
}

/** One fidelity comparison: rendered page, conversion record, map item and
 * its authors, all document records (illustrations are looked up among
 * them), the digest of each source original's current bytes, the gap entries
 * the item may consult, and its corrections. */
export function compareItemKey<T>(
  cache: BuildCache<T>,
  inputs: {
    page: Uint8Array;
    conversion: unknown;
    item: unknown;
    authors: unknown;
    documentsDigest: string;
    sourceDigests: string[];
    gaps: unknown;
    corrections: unknown;
  },
): string {
  return cache.key(
    inputs.page,
    JSON.stringify(inputs.conversion),
    JSON.stringify(inputs.item ?? null),
    JSON.stringify(inputs.authors),
    inputs.documentsDigest,
    JSON.stringify(inputs.sourceDigests),
    JSON.stringify(inputs.gaps),
    JSON.stringify(inputs.corrections),
  );
}
