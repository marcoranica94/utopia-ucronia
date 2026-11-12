import assert from "node:assert/strict";
import { test } from "node:test";
import type { Fetcher } from "../scripts/access.ts";
import { verifyAccess } from "../scripts/access.ts";

const app = {
  id: "123",
  domain: "utopia-ucronia.marcoranica.com",
  type: "self_hosted",
};
const allow = {
  decision: "allow",
  include: [
    { email: { email: "owner@example.org" } },
    { email: { email: "second@example.org" } },
    { email: { email: "third@example.org" } },
  ],
};
function api(policies: unknown[], publicOverride = false): Fetcher {
  return async (path) => {
    const apps = path.startsWith("/access/apps?");
    const page = Number(
      new URL(`https://example.org${path}`).searchParams.get("page"),
    );
    const all = apps
      ? [
          {
            ...app,
            ...(publicOverride
              ? { destinations: [{ overrides: [{ behavior: "public" }] }] }
              : {}),
          },
        ]
      : policies;
    const per = apps ? 1 : 1;
    const result = all.slice((page - 1) * per, page * per);
    return {
      success: true,
      result,
      result_info: {
        page,
        total_pages: Math.ceil(all.length / per),
        total_count: all.length,
      },
    };
  };
}
test("checks every page and accepts the personal policy", async () => {
  await verifyAccess(
    api([allow, { decision: "deny" }]),
    app.domain,
    "owner@example.org",
  );
});
test("blocks extra addresses or generic rules", async () => {
  await assert.rejects(
    verifyAccess(
      api([
        {
          decision: "allow",
          include: [
            ...allow.include,
            { email: { email: "fourth@example.org" } },
          ],
        },
      ]),
      app.domain,
      "owner@example.org",
    ),
    /blocked/,
  );
  await assert.rejects(
    verifyAccess(
      api([
        { decision: "allow", include: [...allow.include, { everyone: {} }] },
      ]),
      app.domain,
      "owner@example.org",
    ),
    /blocked/,
  );
});
test("blocks a bypass on a later page", async () => {
  await assert.rejects(
    verifyAccess(
      api([allow, { decision: "bypass" }]),
      app.domain,
      "owner@example.org",
    ),
    /blocked/,
  );
});
test("blocks public exceptions on the domain", async () => {
  await assert.rejects(
    verifyAccess(api([allow], true), app.domain, "owner@example.org"),
    /Public/,
  );
});
test("blocks responses without verifiable pagination", async () => {
  await assert.rejects(
    verifyAccess(
      async () => ({ success: true, result: [app] }),
      app.domain,
      "owner@example.org",
    ),
    /Incomplete/,
  );
});

test("blocks a second application on a path of the domain", async () => {
  const base = api([allow]);
  await assert.rejects(
    verifyAccess(
      async (path) => {
        if (path.startsWith("/access/apps?"))
          return {
            success: true,
            result: [
              app,
              {
                id: "456",
                domain: `${app.domain}/public`,
                type: "self_hosted",
              },
            ],
            result_info: { page: 1, total_pages: 1, total_count: 2 },
          };
        return base(path);
      },
      app.domain,
      "owner@example.org",
    ),
    /paths/,
  );
});
