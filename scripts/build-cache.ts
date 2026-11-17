import { createHash } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

/**
 * Per-unit cache of verified build results.
 *
 * Every entry is keyed by a digest of ALL the inputs of its unit plus the
 * toolchain digest (every script, page, component, configuration file,
 * lockfile and correction). Identical inputs give an identical verdict, so a
 * stored result can stand in for recomputation without weakening a check;
 * anything that changes an input, or any code, produces a different key.
 *
 * `BUILD_CACHE=off` disables reads and writes entirely. Corrupted or foreign
 * entries are ignored and recomputed. Entries not used by a successful run
 * are pruned at its end.
 */
export const cacheEnabled = (env = process.env) => env.BUILD_CACHE !== "off";
export const defaultCacheRoot = ".cache/build";
const FORMAT = 1;

/** Unambiguous digest of a sequence of parts (each part is length-prefixed). */
export function digest(...parts: (string | Uint8Array)[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    const bytes = typeof part === "string" ? Buffer.from(part) : part;
    hash.update(`${bytes.length}:`);
    hash.update(bytes);
  }
  return hash.digest("hex");
}

/** Files that define how the build behaves. Generated folders are excluded:
 * they are outputs of the build, keyed separately as unit inputs. */
export const toolchainSources = {
  directories: ["scripts", "src", "data/corrections"],
  files: [
    "package.json",
    "pnpm-lock.yaml",
    "astro.config.mjs",
    "astro.config.ts",
    "astro.config.js",
    "tsconfig.json",
  ],
  excluded: ["src/content/works", "src/generated"],
};

async function walk(root: string, dir: string, excluded: Set<string>) {
  const result: string[] = [];
  let items: import("node:fs").Dirent[];
  try {
    items = await readdir(path.join(root, dir), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return result;
    throw error;
  }
  for (const item of items) {
    const relative = path.posix.join(dir, item.name);
    if (excluded.has(relative)) continue;
    if (item.isDirectory())
      result.push(...(await walk(root, relative, excluded)));
    else if (item.isFile()) result.push(relative);
  }
  return result;
}

/** Digest of the whole toolchain: any change recomputes every unit. */
export async function toolchainHash(
  root = ".",
  sources = toolchainSources,
): Promise<string> {
  const excluded = new Set(sources.excluded);
  const files = [...sources.files];
  for (const dir of sources.directories)
    files.push(...(await walk(root, dir, excluded)));
  const parts: (string | Uint8Array)[] = [];
  for (const file of [...new Set(files)].sort()) {
    try {
      const data = await readFile(path.join(root, file));
      parts.push(file, data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return digest(`toolchain-v${FORMAT}`, ...parts);
}

type Entry<T> = { format: number; namespace: string; key: string; value: T };

export type CacheStats = { hits: number; misses: number; stored: number };

export class BuildCache<T> {
  readonly stats: CacheStats = { hits: 0, misses: 0, stored: 0 };
  private readonly used = new Set<string>();
  private readonly dir: string;
  readonly namespace: string;
  private readonly toolchain: string;
  private readonly options: { root?: string; enabled?: boolean };
  constructor(
    namespace: string,
    toolchain: string,
    options: { root?: string; enabled?: boolean } = {},
  ) {
    this.namespace = namespace;
    this.toolchain = toolchain;
    this.options = options;
    if (!/^[a-z0-9-]+$/.test(namespace))
      throw new Error(`Invalid cache namespace: ${namespace}`);
    this.dir = path.join(options.root ?? defaultCacheRoot, namespace);
  }
  get enabled(): boolean {
    return this.options.enabled ?? cacheEnabled();
  }
  /** Final key of a unit: its own inputs plus the toolchain. */
  key(...inputs: (string | Uint8Array)[]): string {
    return digest(this.namespace, this.toolchain, ...inputs);
  }
  private file(key: string) {
    if (!/^[0-9a-f]{64}$/.test(key))
      throw new Error(`Invalid cache key: ${key}`);
    return path.join(this.dir, `${key}.json`);
  }
  async get(key: string): Promise<T | undefined> {
    if (!this.enabled) return undefined;
    this.used.add(key);
    try {
      const entry = JSON.parse(
        await readFile(this.file(key), "utf8"),
      ) as Entry<T>;
      if (
        entry?.format === FORMAT &&
        entry.namespace === this.namespace &&
        entry.key === key &&
        "value" in entry
      ) {
        this.stats.hits++;
        return entry.value;
      }
    } catch {
      // Missing or corrupted: recompute.
    }
    this.stats.misses++;
    return undefined;
  }
  async set(key: string, value: T): Promise<void> {
    if (!this.enabled) return;
    this.used.add(key);
    await mkdir(this.dir, { recursive: true });
    const file = this.file(key);
    const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    const entry: Entry<T> = {
      format: FORMAT,
      namespace: this.namespace,
      key,
      value,
    };
    await writeFile(tmp, JSON.stringify(entry));
    await rename(tmp, file);
    this.stats.stored++;
  }
  /** Removes entries this run did not use. Call only after a successful run. */
  async prune(): Promise<number> {
    if (!this.enabled) return 0;
    let removed = 0;
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch {
      return 0;
    }
    for (const name of names) {
      const key = name.replace(/\.json$/, "");
      if (name.endsWith(".json") && this.used.has(key)) continue;
      await rm(path.join(this.dir, name), { force: true });
      removed++;
    }
    return removed;
  }
  /** Counts a hit whose entry turned out not to apply (e.g. a replayed
   * lookup differed) as a recomputation. */
  reject(): void {
    this.stats.hits--;
    this.stats.misses++;
  }
  summary(): string {
    if (!this.enabled) return `build cache ${this.namespace}: off`;
    const { hits, misses } = this.stats;
    return `build cache ${this.namespace}: ${hits} reused, ${misses} computed`;
  }
}

/** Opens a cache for one script run, computing the toolchain digest once. */
export async function openCache<T>(
  namespace: string,
  options: { root?: string; enabled?: boolean; projectRoot?: string } = {},
): Promise<BuildCache<T>> {
  const enabled = options.enabled ?? cacheEnabled();
  const toolchain = enabled ? await toolchainHash(options.projectRoot) : "";
  return new BuildCache<T>(namespace, toolchain, { ...options, enabled });
}

/** JSON round trip, so a freshly computed value and a cached one are
 * indistinguishable (undefined array slots become null, absent keys vanish). */
export const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Facts extracted from one file, cached by the file's bytes. The extractor
 * must depend only on those bytes; callers keep every assertion live. */
export async function fileFacts<T>(
  cache: BuildCache<T>,
  file: string,
  extract: (bytes: Buffer) => T,
): Promise<T> {
  const bytes = await readFile(file);
  const key = cache.key(bytes);
  const cached = await cache.get(key);
  if (cached !== undefined) return cached;
  const value = plain(extract(bytes));
  await cache.set(key, value);
  return value;
}
