import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";
import {
  isRecovered,
  readManifest,
  safePath,
  verifyDocument,
  writeJson,
} from "./recovery/core.ts";

const config = JSON.parse(
  await readFile("data/period-images.json", "utf8"),
) as { images: Record<string, string>; aliases: Record<string, string> };
const manifest = await readManifest();
await mkdir("public/periods", { recursive: true });
const evidence = [];
for (const [period, path] of Object.entries(config.images)) {
  const document = manifest.documents.find((d) => d.path === path);
  assert.ok(
    document && isRecovered(document) && (await verifyDocument(document)),
    `Unverified period image: ${path}`,
  );
  const output = `public/periods/${period}.webp`;
  const result = await sharp(safePath("archive/original", path))
    .rotate()
    .resize(720, 360, {
      fit: "cover",
      position: "attention",
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toFile(output);
  evidence.push({
    period,
    source: document.url,
    sha256: document.sha256,
    derived: `/periods/${period}.webp`,
    bytes: result.size,
  });
}
for (const target of Object.values(config.aliases))
  assert.ok(config.images[target]);
await writeJson("reports/period-images.json", {
  passed: true,
  images: evidence,
  aliases: config.aliases,
});
console.log(
  `${evidence.length} themed archive illustrations optimized; originals unchanged.`,
);
