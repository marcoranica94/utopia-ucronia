/**
 * Which sources have a /sources/ page. A PDF's reading edition is already its
 * whole text layer, so it gets no separate source page (owner decision of
 * 18/11/2026, to stay within the Cloudflare free-plan file limit); the reader
 * names the original file instead. Used by the reader, the source-page
 * generator and the S3 check, so the three always agree.
 */
export const hasSourcePage = (url: string) =>
  !/\.(?:pdf|zip)(?:[#?]|$)/i.test(url);

/** The original file a PDF or zip reading edition comes from, as the reader
 * names it: "remus.zip › 1 Documentazione Remus Repubblica Romana.doc". */
export const originalFile = (source: { url: string; entry?: string }) => {
  const file = decodeURIComponent(source.url.split("/").at(-1) ?? "");
  return source.entry ? `${file} › ${source.entry}` : file;
};
