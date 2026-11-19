import { readdir } from "node:fs/promises";

/**
 * Cloudflare's free Workers plan accepts at most 20,000 static asset files
 * per version (the deploy of 17/11/2026 failed at 30,827). Fail locally with
 * a margin, before CI tries to upload.
 */
const limit = 20_000;
const budget = Number(process.env.ASSET_FILE_BUDGET ?? 19_500);
const entries = (
  await readdir("dist", { recursive: true, withFileTypes: true })
).filter((entry) => entry.isFile());
const files = entries.length;
// S7: the site serves reading text only, never the attachments themselves.
const attachments = entries.filter((entry) =>
  /\.(?:pdf|zip|docx?|xlsx?|pptx?|ppsx?|rtf|odt)$/i.test(entry.name),
);
if (attachments.length)
  throw new Error(
    `dist must not serve attachment files: ${attachments
      .slice(0, 5)
      .map((entry) => entry.name)
      .join(", ")}`,
  );
if (files > budget)
  throw new Error(
    `dist has ${files} files: over the ${budget}-file budget (Cloudflare free limit ${limit}). Reduce generated files before deploying.`,
  );
console.log(
  `${files} static files in dist (budget ${budget}, Cloudflare free limit ${limit}).`,
);
