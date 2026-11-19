import { readdir } from "node:fs/promises";

/**
 * Cloudflare's free Workers plan accepts at most 20,000 static asset files
 * per version (the deploy of 17/11/2026 failed at 30,827). Fail locally with
 * a margin, before CI tries to upload.
 */
const limit = 20_000;
const budget = Number(process.env.ASSET_FILE_BUDGET ?? 19_500);
const files = (
  await readdir("dist", { recursive: true, withFileTypes: true })
).filter((entry) => entry.isFile()).length;
if (files > budget)
  throw new Error(
    `dist has ${files} files: over the ${budget}-file budget (Cloudflare free limit ${limit}). Reduce generated files before deploying.`,
  );
console.log(
  `${files} static files in dist (budget ${budget}, Cloudflare free limit ${limit}).`,
);
