import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
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
// Site history: the 2004 home page's own images, kept pixel for pixel.
const history = JSON.parse(
  await readFile("data/history-images.json", "utf8"),
) as { images: Record<string, string> };
await rm("public/history", { recursive: true, force: true });
await mkdir("public/history", { recursive: true });
const historyEvidence = [];
for (const [name, path] of Object.entries(history.images)) {
  const document = manifest.documents.find((d) => d.path === path);
  assert.ok(
    document && isRecovered(document) && (await verifyDocument(document)),
    `Unverified history image: ${path}`,
  );
  // GIFs become lossless PNG; JPEGs are already web images and are copied.
  const jpeg = document.type === "image/jpeg";
  const derived = `/history/${name}.${jpeg ? "jpg" : "png"}`;
  const source = safePath("archive/original", path);
  if (jpeg) await copyFile(source, `public${derived}`);
  else
    await sharp(source).png({ compressionLevel: 9 }).toFile(`public${derived}`);
  const result = await sharp(`public${derived}`).metadata();
  historyEvidence.push({
    name,
    source: document.url,
    sha256: document.sha256,
    derived,
    width: result.width,
    height: result.height,
  });
}
for (const target of Object.values(config.aliases))
  assert.ok(config.images[target]);
await writeJson("reports/period-images.json", {
  passed: true,
  images: evidence,
  aliases: config.aliases,
  history: historyEvidence,
});
console.log(
  `${evidence.length} themed archive illustrations and ${historyEvidence.length} site-history images derived; originals unchanged.`,
);
