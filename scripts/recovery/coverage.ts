import { readFile, writeFile } from "node:fs/promises";
import { isRecovered, readManifest, urlKey } from "./core.ts";

type Entry = { url: string; foundIn: string[] };

export async function coverage(): Promise<void> {
  const queue = JSON.parse(await readFile("archive/queue.json", "utf8")) as {
    complete: boolean;
    documents: Entry[];
  };
  const manifest = await readManifest();
  const byKey = new Map(manifest.documents.map((d) => [urlKey(d.url), d]));
  const counts = new Map<string, Record<string, number>>();
  const years = new Map<string, number>();
  const missing: string[] = [];
  const candidates: string[] = [];
  const byName = new Map<string, string[]>();
  for (const doc of manifest.documents.filter(isRecovered)) {
    const name = decodeURIComponent(new URL(doc.url).pathname)
      .split("/")
      .at(-1)
      ?.toLowerCase();
    if (name && /\.(gif|jpe?g|png|webp|bmp|ico)$/i.test(name))
      byName.set(name, [...(byName.get(name) ?? []), doc.url]);
  }
  for (const entry of queue.documents) {
    const doc = byKey.get(urlKey(entry.url));
    const ext =
      new URL(entry.url).pathname.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ??
      "";
    const kind = /^(png|jpe?g|gif|webp|bmp|ico|svg|tiff?)$/.test(ext)
      ? "Images"
      : ext === "pdf"
        ? "PDF"
        : /^(html?|shtml)$/.test(ext) || !ext
          ? "HTML or extensionless"
          : "Other";
    const row = counts.get(kind) ?? {
      recovered: 0,
      missing: 0,
      failed: 0,
      pending: 0,
    };
    const status = !doc
      ? "pending"
      : isRecovered(doc)
        ? "recovered"
        : doc.outcome === "missing"
          ? "missing"
          : "failed";
    row[status]++;
    counts.set(kind, row);
    if (doc?.timestamp && isRecovered(doc))
      years.set(
        doc.timestamp.slice(0, 4),
        (years.get(doc.timestamp.slice(0, 4)) ?? 0) + 1,
      );
    if (status !== "recovered") {
      const refs = entry.foundIn.length
        ? entry.foundIn.join(", ")
        : "not linked by a scanned source";
      missing.push(`- ${status}: ${entry.url} — referenced by: ${refs}`);
      if (status === "missing") {
        const name = decodeURIComponent(new URL(entry.url).pathname)
          .split("/")
          .at(-1)
          ?.toLowerCase();
        const matches = name ? byName.get(name) : undefined;
        if (matches?.length)
          candidates.push(
            `- ${entry.url} — same filename: ${matches.join(", ")}`,
          );
      }
    }
  }
  const withDefects = manifest.documents
    .filter((d) => isRecovered(d) && d.defects?.length)
    .map((d) => `- ${d.url} — ${d.defects?.join("; ")}`);
  const lines = [
    "# Archive coverage",
    "",
    `Generated: ${new Date().toISOString()}`,
    `CDX index exhausted: ${queue.complete ? "yes" : "no"}`,
    "",
    "| Type | Recovered | Missing | Failed attempt | Not attempted | Total | Recovered % |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const [kind, row] of [...counts].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const total = row.recovered + row.missing + row.failed + row.pending;
    lines.push(
      `| ${kind} | ${row.recovered} | ${row.missing} | ${row.failed} | ${row.pending} | ${total} | ${((100 * row.recovered) / total).toFixed(1)}% |`,
    );
  }
  lines.push(
    "",
    "## Capture years",
    "",
    ...[...years]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, count]) => `- ${year}: ${count}`),
    "",
    "## Unrecovered URLs and referring sources",
    "",
    ...(missing.length ? missing : ["None in the current queue."]),
    "",
    "## Recovered with defects",
    "",
    "No clean copy exists for these files. They are kept as the server or the latest capture holds them, with the defect noted; a defect is not a transfer error.",
    "",
    ...(withDefects.length ? withDefects : ["None."]),
    "",
    "## Possible image matches to review",
    "",
    "Matching filenames are only leads: they do not establish identical content and must not be substituted automatically.",
    "",
    ...(candidates.length ? candidates : ["None found."]),
    "",
    "## Limits",
    "",
    "The queue combines the indexed captures with links found in scanned recovered documents. It cannot prove the original site or all resources were archived. Links in scripts, complex CSS and external sites may be absent. Missing means no valid capture was found by the current checks; failed attempts remain recorded for possible future work. Percentages describe this queue, not the original site.",
    "",
  );
  await writeFile("archive/coverage.md", lines.join("\n"));
  console.log(
    `Coverage written: ${queue.documents.length} URLs; ${missing.length} not recovered.`,
  );
}
