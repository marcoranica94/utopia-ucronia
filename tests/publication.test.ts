import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import { proposed, unknownClassification } from "../scripts/editorial-core.ts";
import {
  publicationFingerprint,
  publicationItems,
  publicationSchema,
  publicationTargets,
  readPublication,
  selectPublication,
  updatePublication,
} from "../scripts/publication-core.ts";
import { sha256 } from "../scripts/recovery/core.ts";
import { reviewSourcePage } from "../scripts/review/source-page.ts";
import {
  type DecisionFile,
  proposalFingerprint,
} from "../scripts/review-decisions.ts";
import { mapSchema } from "../src/editorial/model.ts";

function fixture() {
  const review = proposed("Standalone source text", "Source quotation");
  return mapSchema.parse({
    version: 1,
    manifestDigest: "a".repeat(64),
    authors: [],
    eras: [],
    places: [],
    themes: [],
    documents: ["a", "b"].map((name) => ({
      id: `doc-${name}`,
      url: `https://www.fmboschetto.it/Utopiaucronia/${name}.htm`,
      path: `${name}.htm`,
      sha256: "b".repeat(64),
      mediaType: "text/html",
      source: "origin",
    })),
    items: ["a", "b"].map((name) => ({
      id: `item-${name}`,
      slug: name,
      title: `Story ${name}`,
      level: "work",
      authors: [],
      language: { value: "it", review },
      sources: [
        {
          documentId: `doc-${name}`,
          url: `https://www.fmboschetto.it/Utopiaucronia/${name}.htm`,
          selection: { kind: "whole" },
        },
      ],
      composition: "single",
      classification: unknownClassification("Source quotation"),
      review,
    })),
    proposals: [
      {
        id: "proposal-b",
        documents: ["doc-b"],
        action: "work",
        level: "work",
        targets: ["item-b"],
        review,
      },
    ],
  });
}
function approvals(map = fixture()): DecisionFile {
  return {
    version: 1,
    decisions: [
      {
        proposalId: "proposal-b",
        fingerprint: proposalFingerprint(map, "proposal-b"),
        state: "approved",
        reason: "Explicit fixture-only structural review",
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}
const empty = () => publicationSchema.parse({ version: 1, selections: [] });

test("approved publication expands the baseline without approving classifications or changing the map", () => {
  const map = fixture(),
    before = JSON.stringify(map),
    ledger = approvals(map);
  assert.deepEqual(
    publicationItems(map, ledger, empty(), ["item-a"]).extraIds,
    [],
  );
  const selection = selectPublication(
    map,
    ledger,
    empty(),
    ["item-a"],
    "proposal-b",
  );
  const edition = publicationItems(map, ledger, selection, ["item-a"]);
  assert.deepEqual(
    edition.items.map((i) => i.id),
    ["item-a", "item-b"],
  );
  assert.deepEqual(edition.extraIds, ["item-b"]);
  assert.equal(edition.items[1].classification.kind.value, "unknown");
  assert.equal(edition.items[1].classification.kind.review.state, "proposed");
  assert.equal(JSON.stringify(map), before);
  assert.throws(
    () => selectPublication(map, ledger, selection, ["item-a"], "proposal-b"),
    /already selected/,
  );
  assert.throws(
    () =>
      publicationSchema.parse({
        ...selection,
        selections: [...selection.selections, ...selection.selections],
      }),
    /Duplicate/,
  );
});

test("forged metadata approvals, deferrals and changed source/target/route reject publication", () => {
  const map = fixture(),
    ledger = approvals(map);
  map.proposals[0].review = {
    ...map.proposals[0].review,
    by: "owner",
    state: "approved",
  };
  assert.throws(
    () =>
      selectPublication(
        map,
        { version: 1, decisions: [] },
        empty(),
        ["item-a"],
        "proposal-b",
      ),
    /explicit current owner approval/,
  );
  assert.throws(
    () =>
      selectPublication(
        map,
        {
          version: 1,
          decisions: [{ ...ledger.decisions[0], state: "deferred" }],
        },
        empty(),
        ["item-a"],
        "proposal-b",
      ),
    /explicit current owner approval/,
  );
  const selection = selectPublication(
    map,
    ledger,
    empty(),
    ["item-a"],
    "proposal-b",
  );
  const sourceChanged = structuredClone(map);
  sourceChanged.documents[1].sha256 = "c".repeat(64);
  assert.throws(
    () => publicationItems(sourceChanged, ledger, selection, ["item-a"]),
    /changed/,
  );
  const routeChanged = structuredClone(map);
  routeChanged.items[1].slug = "renamed";
  assert.throws(
    () => publicationItems(routeChanged, ledger, selection, ["item-a"]),
    /selection changed/,
  );
  const languageChanged = structuredClone(map);
  languageChanged.items[1].language.value = "fr";
  assert.notEqual(
    publicationFingerprint(map, "proposal-b"),
    publicationFingerprint(languageChanged, "proposal-b"),
  );
  assert.throws(
    () => publicationItems(languageChanged, ledger, selection, ["item-a"]),
    /selection changed/,
  );
});

test("overlapping editions are rejected; a reviewed split is selected as a whole with adjacent fragments", () => {
  const map = fixture();
  map.items[1].sources = structuredClone(map.items[0].sources);
  map.proposals[0].documents = ["doc-a"];
  assert.throws(
    () =>
      selectPublication(map, approvals(map), empty(), ["item-a"], "proposal-b"),
    /Overlapping/,
  );
  const split = fixture();
  split.items[1].sources[0].selection = {
    kind: "blocks",
    start: 0,
    end: 2,
    digest: "d".repeat(64),
  };
  split.items.push({
    ...structuredClone(split.items[1]),
    id: "item-c",
    slug: "c",
    sources: [
      {
        ...split.items[1].sources[0],
        selection: { kind: "blocks", start: 2, end: 4, digest: "e".repeat(64) },
      },
    ],
  });
  split.proposals[0].action = "split";
  split.proposals[0].targets.push("item-c");
  const ledger = approvals(split);
  const selection = selectPublication(
    split,
    ledger,
    empty(),
    ["item-a"],
    "proposal-b",
  );
  assert.deepEqual(
    publicationItems(split, ledger, selection, ["item-a"]).extraIds,
    ["item-b", "item-c"],
  );
  split.items[2].sources[0].selection = {
    kind: "blocks",
    start: 1,
    end: 3,
    digest: "e".repeat(64),
  };
  assert.throws(
    () =>
      selectPublication(
        split,
        approvals(split),
        empty(),
        ["item-a"],
        "proposal-b",
      ),
    /Overlapping/,
  );
});

test("technical/attachment proposals, worlds, unsupported files and out-of-proposal sources cannot enter reading publication", () => {
  for (const action of ["attachment", "index", "discard", "world"] as const) {
    const map = fixture();
    map.proposals[0].action = action;
    assert.throws(
      () => publicationTargets(map, "proposal-b"),
      /no supported reading edition/,
    );
  }
  const world = fixture();
  world.items[1].level = "world";
  assert.throws(
    () => publicationTargets(world, "proposal-b"),
    /World publication/,
  );
  const file = fixture();
  file.documents[1].mediaType = "application/octet-stream";
  assert.throws(() => publicationTargets(file, "proposal-b"), /Unsupported/);
  const unreviewed = fixture();
  unreviewed.proposals[0].documents = ["doc-a"];
  assert.throws(
    () => publicationTargets(unreviewed, "proposal-b"),
    /outside its reviewed proposal/,
  );
});

test("atomic publication writes reject concurrent/invalid updates and leave the previous selection intact", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ucronia-publication-")),
    file = path.join(dir, "publication.json");
  await writeFile(file, JSON.stringify(empty()));
  try {
    await writeFile(`${file}.lock`, "another writer");
    await assert.rejects(
      updatePublication(file, (current) => current),
      /EEXIST/,
    );
    await rm(`${file}.lock`);
    await assert.rejects(
      updatePublication(file, () => {
        throw Error("Rejected update");
      }),
      /Rejected/,
    );
    assert.deepEqual(await readPublication(file), empty());
    await updatePublication(file, (current) =>
      selectPublication(
        fixture(),
        approvals(),
        current,
        ["item-a"],
        "proposal-b",
      ),
    );
    assert.equal((await readPublication(file)).selections.length, 1);
    await assert.rejects(readFile(`${file}.lock`));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI status/next/dry-run leave fixture decisions unchanged; select/remove persist only explicit approved choices", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ucronia-publication-cli-"));
  const map = fixture(),
    ledger = approvals(map);
  await mkdir(path.join(dir, "data"));
  await mkdir(path.join(dir, "reports"));
  for (const [name, data] of Object.entries({
    "data/map.yaml": map,
    "data/review-decisions.json": ledger,
    "data/publication.json": empty(),
    "data/validation-sample.json": { items: ["item-a"] },
    "data/publication-baseline.json": {
      version: 1,
      validationFingerprint: sha256(
        Buffer.from(JSON.stringify({ items: ["item-a"] })),
      ),
      items: ["item-a"],
    },
    "reports/editorial-selection.json": { additional: [] },
  }))
    await writeFile(path.join(dir, name), JSON.stringify(data));
  const script = fileURLToPath(
    new URL("../scripts/publication.ts", import.meta.url),
  );
  const cli = (...args: string[]) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: dir,
      encoding: "utf8",
    });
  try {
    const status = cli("status");
    assert.equal(status.status, 0, status.stderr);
    assert.equal(JSON.parse(status.stdout).canonicalItems, 1);
    assert.equal(
      JSON.parse(status.stdout).readyToSelect[0].proposalId,
      "proposal-b",
    );
    await writeFile(
      path.join(dir, "reports/editorial-selection.json"),
      JSON.stringify({ additional: [{ id: "forged-report-item" }] }),
    );
    assert.equal(JSON.parse(cli("status").stdout).canonicalItems, 1);
    const preview = cli("select", "proposal-b", "--dry-run");
    assert.equal(preview.status, 0, preview.stderr);
    assert.equal(JSON.parse(preview.stdout).canonicalItems, 2);
    assert.deepEqual(
      await readPublication(path.join(dir, "data/publication.json")),
      empty(),
    );
    const selected = cli("select", "proposal-b");
    assert.equal(selected.status, 0, selected.stderr);
    assert.equal(JSON.parse(cli("status").stdout).additionalItems, 1);
    assert.deepEqual(JSON.parse(cli("status").stdout).readyToSelect, []);
    assert.equal(cli("remove", "proposal-b").status, 0);
    const bulkPreview = cli("select-approved", "--dry-run");
    assert.equal(bulkPreview.status, 0, bulkPreview.stderr);
    assert.equal(JSON.parse(bulkPreview.stdout).selected, 1);
    assert.deepEqual(
      await readPublication(path.join(dir, "data/publication.json")),
      empty(),
    );
    const bulk = cli("select-approved");
    assert.equal(bulk.status, 0, bulk.stderr);
    assert.equal(JSON.parse(cli("status").stdout).additionalItems, 1);
    assert.equal(JSON.parse(cli("select-approved").stdout).selected, 0);
    assert.equal(cli("remove", "proposal-b").status, 0);
    assert.equal(
      await readFile(path.join(dir, "data/review-decisions.json"), "utf8"),
      JSON.stringify(ledger),
    );
    await writeFile(
      path.join(dir, "data/review-decisions.json"),
      JSON.stringify({ version: 1, decisions: [] }),
    );
    assert.equal(JSON.parse(cli("next").stdout).proposals, 1);
    assert.notEqual(cli("select", "proposal-b").status, 0);
    assert.deepEqual(
      await readPublication(path.join(dir, "data/publication.json")),
      empty(),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("review source view preserves full inert text and checks the immutable source hash", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ucronia-review-source-"));
  const original =
    '<html><body><h1>Opera completa</h1><p>Inizio &amp; accenti: città.</p><script>active()</script><p onclick="bad()">Fine della storia. author@example.org</p><a href="mailto:author@example.org">Firma</a><a href="/Utopiaucronia/appendix.pdf">Appendice</a></body></html>';
  const map = fixture();
  map.documents[0].sha256 = sha256(Buffer.from(original, "latin1"));
  await writeFile(path.join(dir, "a.htm"), Buffer.from(original, "latin1"));
  try {
    const $ = load(await reviewSourcePage(map, "doc-a", "it", dir));
    assert.ok($("main").text().includes("Inizio & accenti: città."));
    assert.ok($("main").text().includes("Fine della storia."));
    assert.ok(!/active\(\)|example\.org|mailto:/.test($("body").text()));
    assert.equal($("script,iframe,object,[onclick]").length, 0);
    assert.ok(
      $("section li")
        .text()
        .includes("https://www.fmboschetto.it/Utopiaucronia/appendix.pdf"),
    );
    assert.equal($("a[href*=appendix]").length, 0);
    await assert.rejects(
      reviewSourcePage(map, "doc-unknown", "it", dir),
      /Unknown/,
    );
    await writeFile(path.join(dir, "a.htm"), `${original}changed`);
    await assert.rejects(
      reviewSourcePage(map, "doc-a", "en", dir),
      /Original changed/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
