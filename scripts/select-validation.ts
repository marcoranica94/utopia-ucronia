import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { readMap } from "./editorial-core.ts";
import { sha256, writeJson } from "./recovery/core.ts";

const map = await readMap();
const pools = [
  {
    name: "works",
    count: 15,
    items: map.items.filter(
      (i) =>
        i.level === "work" &&
        !i.parent &&
        i.sources.every((s) =>
          map.documents
            .find((d) => d.id === s.documentId)
            ?.mediaType.includes("html"),
        ),
    ),
  },
  {
    name: "divergences",
    count: 10,
    items: map.items.filter((i) => i.level === "divergence"),
  },
  {
    name: "anchored-pieces",
    count: 5,
    items: map.items.filter((i) => i.parent),
  },
];
const digest = sha256(
  Buffer.from(
    JSON.stringify(
      pools.map((p) => ({
        name: p.name,
        ids: p.items.map((i) => i.id).sort(),
      })),
    ),
  ),
);
let existing: { seed: string; poolDigest: string; items: string[] } | undefined;
try {
  existing = JSON.parse(await readFile("data/validation-sample.json", "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
if (existing) {
  if (existing.poolDigest !== digest)
    throw new Error(
      "The validation pool changed. Review the existing recorded sample; do not silently replace failed cases.",
    );
  if (
    new Set(existing.items).size !== 30 ||
    existing.items.some((id) => !map.items.some((i) => i.id === id))
  )
    throw new Error("Invalid recorded validation sample");
  console.log(`Existing 30-item sample retained; seed ${existing.seed}`);
} else {
  const seed = randomBytes(16).toString("hex");
  const selected = pools.flatMap((pool) => {
    if (pool.items.length < pool.count)
      throw new Error(`Insufficient items in ${pool.name}`);
    return [...pool.items]
      .sort((a, b) =>
        sha256(Buffer.from(`${seed}:${a.id}`)).localeCompare(
          sha256(Buffer.from(`${seed}:${b.id}`)),
        ),
      )
      .slice(0, pool.count)
      .map((i) => i.id);
  });
  await writeJson("data/validation-sample.json", {
    version: 1,
    method:
      "Stratified random sample without replacement; SHA-256 ranking with a recorded random seed. No rejection or resampling after failures.",
    seed,
    poolDigest: digest,
    groups: pools.map((p) => ({
      name: p.name,
      count: p.count,
      population: p.items.length,
    })),
    items: selected,
  });
  console.log(`Recorded 30 randomly selected items; seed ${seed}`);
}
