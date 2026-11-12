import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { downloadArchiveFromR2 } from "../scripts/r2.ts";
import { sha256 } from "../scripts/recovery/core.ts";

const data = Buffer.from("A preserved original.");
const document = {
  url: "https://www.fmboschetto.it/Utopiaucronia/prova.htm",
  variants: [],
  outcome: "recovered",
  path: "utopiaucronia/prova.htm",
  sha256: sha256(data),
  size: data.length,
};
for (const scenario of ["intact", "corrupted", "unsafe path"]) {
  test(`simulated R2 restore: ${scenario}`, async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "ucronia-r2-test-"));
    const dest = path.join(temp, "backup");
    const requests: string[] = [];
    const manifest = {
      version: 1,
      documents: [
        {
          ...document,
          ...(scenario === "unsafe path" ? { path: "../../outside.htm" } : {}),
        },
      ],
    };
    try {
      const run = () =>
        downloadArchiveFromR2(dest, async (key, file) => {
          requests.push(key);
          await writeFile(
            file,
            key === "manifest.json"
              ? JSON.stringify(manifest)
              : scenario === "corrupted"
                ? Buffer.from("altered")
                : data,
          );
        });
      if (scenario === "intact") {
        await run();
        assert.deepEqual(
          await readFile(path.join(dest, "original", document.path)),
          data,
        );
        await assert.rejects(run(), /EEXIST/);
      } else
        await assert.rejects(
          run(),
          scenario === "corrupted" ? /not intact/ : /Unsafe path/,
        );
      assert.equal(requests.length, scenario === "unsafe path" ? 1 : 2);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
}
