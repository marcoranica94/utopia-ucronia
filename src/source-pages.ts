/**
 * Which sources have a /sources/ page. A PDF's reading edition is already its
 * whole text layer, so it gets no separate source page (owner decision of
 * 18/11/2026, to stay within the Cloudflare free-plan file limit); the reader
 * names the original file instead. Used by the reader, the source-page
 * generator and the S3 check, so the three always agree.
 */
export const hasSourcePage = (url: string) => !/\.pdf(?:[#?]|$)/i.test(url);
