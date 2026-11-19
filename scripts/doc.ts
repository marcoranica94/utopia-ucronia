import WordExtractor from "word-extractor";

/**
 * Word 97–2003 documents found inside zips (S7) as simple HTML, so they go
 * through the same anatomy and conversion as the pages. word-extractor reads
 * the body text only (no formatting): a run of short lines is a poem stanza
 * and keeps its line breaks; a short line standing alone before running text
 * is a heading; tab leaders of tables of contents become spaces.
 */
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function bodyToHtml(body: string, title: string): string {
  const blocks = body
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.replace(/\t+/g, " ").replace(/\s+/g, " ").trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length);
  const html: string[] = [];
  for (const [i, lines] of blocks.entries()) {
    const short = lines.every((line) => line.length <= 70);
    if (lines.length > 1 && short) {
      html.push(`<p>${lines.map(escapeHtml).join("<br>")}</p>`);
      continue;
    }
    for (const line of lines) {
      const next = blocks[i + 1]?.[0] ?? "";
      const heading =
        lines.length === 1 &&
        line.length <= 80 &&
        !/[.;,:!?»”"]$/.test(line) &&
        next.length > 80;
      html.push(
        heading ? `<h3>${escapeHtml(line)}</h3>` : `<p>${escapeHtml(line)}</p>`,
      );
    }
  }
  return `<html><head><title>${escapeHtml(title)}</title></head><body>${html.join("\n")}</body></html>`;
}

export async function docToHtml(data: Buffer, title: string): Promise<string> {
  const document = await new WordExtractor().extract(data);
  return bodyToHtml(document.getBody(), title);
}
