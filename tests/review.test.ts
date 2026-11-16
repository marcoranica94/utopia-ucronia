import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { proposed, unknownClassification } from "../scripts/editorial-core.ts";
import { preserveOwnerDecisions } from "../scripts/editorial-review.ts";
import { localReviewPlugin } from "../scripts/review/server.ts";
import {
  applyDecisions,
  decisionFileSchema,
  proposalFingerprint,
} from "../scripts/review-decisions.ts";
import { mapSchema } from "../src/editorial/model.ts";

function fixture() {
  const review = proposed(
    "Source identifies a standalone story",
    "A source excerpt",
  );
  return mapSchema.parse({
    version: 1,
    manifestDigest: "a".repeat(64),
    documents: [
      {
        id: "doc-a",
        url: "https://www.fmboschetto.it/Utopiaucronia/a.htm",
        path: "a.htm",
        sha256: "b".repeat(64),
        mediaType: "text/html",
        source: "origin",
      },
    ],
    authors: [],
    eras: [],
    places: [],
    themes: [],
    items: [
      {
        id: "item-a",
        slug: "a",
        title: "A story",
        level: "work",
        authors: [],
        language: { value: "unknown", review },
        sources: [
          {
            documentId: "doc-a",
            url: "https://www.fmboschetto.it/Utopiaucronia/a.htm",
            selection: { kind: "whole" },
          },
        ],
        composition: "single",
        classification: unknownClassification("A source excerpt"),
        review,
      },
    ],
    proposals: Array.from({ length: 25 }, (_, index) => ({
      id: `proposal-${String(index).padStart(2, "0")}`,
      documents: ["doc-a"],
      action: "work",
      level: "work",
      targets: ["item-a"],
      review,
    })),
  });
}
function decision(map = fixture()) {
  return {
    proposalId: "proposal-00",
    fingerprint: proposalFingerprint(map, "proposal-00"),
    state: "approved" as const,
    reason: "Reviewed the source and organization",
    updatedAt: new Date().toISOString(),
  };
}
test("owner decisions survive regeneration without approving item metadata", () => {
  const map = fixture(),
    ledger = decisionFileSchema.parse({
      version: 1,
      decisions: [decision(map)],
    });
  const reviewed = applyDecisions(structuredClone(map), ledger);
  assert.equal(reviewed.proposals[0].review.by, "owner");
  assert.equal(reviewed.items[0].classification.kind.review.state, "proposed");
  assert.equal(reviewed.items[0].review.by, "agent");
  const regenerated = fixture();
  preserveOwnerDecisions(regenerated, reviewed);
  applyDecisions(regenerated, ledger);
  assert.equal(regenerated.proposals[0].review.state, "approved");
  assert.throws(
    () =>
      applyDecisions(
        {
          ...fixture(),
          documents: [{ ...map.documents[0], sha256: "c".repeat(64) }],
        },
        ledger,
      ),
    /changed/,
  );
  const changed = fixture();
  changed.items[0].title = "Changed proposal target";
  assert.throws(() => applyDecisions(changed, ledger), /changed/);
  assert.equal(
    decisionFileSchema.safeParse({
      version: 1,
      decisions: [decision(map), decision(map)],
    }).success,
    false,
  );
});
test("local review API batches, rejects forged/stale writes, persists and restores only explicit fixture decisions", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ucronia-review-"));
  const mapPath = path.join(directory, "map.yaml"),
    decisionPath = path.join(directory, "decisions.json");
  await writeFile(mapPath, JSON.stringify(fixture()));
  type Handler = (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next: () => void,
  ) => unknown;
  let handler: Handler = (_req, res) => res.end();
  const integration = localReviewPlugin({ mapPath, decisionPath });
  const setup = integration.hooks["astro:server:setup"];
  assert.ok(setup);
  await setup({
    server: {
      middlewares: {
        use(value: Handler) {
          handler = value;
        },
      },
    },
  } as unknown as Parameters<typeof setup>[0]);
  const server = http.createServer((req, res) => {
    handler(req, res, () => {
      res.statusCode = 404;
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const first = await (await fetch(`${origin}/review/api`)).json();
    assert.equal(first.entries.length, 20);
    assert.equal(first.total, 25);
    const second = await (await fetch(`${origin}/review/api?page=2`)).json();
    assert.equal(second.entries.length, 5);
    assert.notEqual(first.entries[0].id, second.entries[0].id);
    const post = (body: unknown, token = first.token, source = origin) =>
      fetch(`${origin}/review/api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: source,
          "X-Review-Token": token,
        },
        body: JSON.stringify(body),
      });
    const body = { ...decision(), revision: first.revision };
    assert.equal((await post(body, "wrong")).status, 403);
    assert.equal(
      (await post(body, first.token, "https://attacker.invalid")).status,
      403,
    );
    assert.equal((await post({ ...body, reason: "x" })).status, 400);
    assert.equal(
      (await post({ ...body, fingerprint: "d".repeat(64) })).status,
      409,
    );
    assert.equal((await post(body)).status, 200);
    assert.equal((await post(body)).status, 409);
    const stored = decisionFileSchema.parse(
      JSON.parse(await readFile(decisionPath, "utf8")),
    );
    assert.equal(stored.decisions.length, 1);
    assert.equal(stored.decisions[0].proposalId, "proposal-00");
    const refreshed = await (
      await fetch(`${origin}/review/api?state=approved`)
    ).json();
    assert.equal(refreshed.total, 1);
    assert.equal(refreshed.entries[0].review.by, "owner");
    const raw = mapSchema.parse(JSON.parse(await readFile(mapPath, "utf8")));
    assert.equal(raw.proposals[0].review.by, "agent");
    assert.equal(
      applyDecisions(raw, stored).proposals[0].review.state,
      "approved",
    );
    const en = await (await fetch(`${origin}/en/review/`)).text();
    assert.ok(en.includes('<html lang="en">'));
    assert.ok(!en.includes("@title@"));
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
