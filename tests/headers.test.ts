import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  allowsSameOriginScripts,
  contentPolicies,
} from "../scripts/header-policies.ts";

const headers = await readFile(
  new URL("../public/_headers", import.meta.url),
  "utf8",
);
test("production headers permit theme, filters and reader scripts in both languages", () => {
  for (const path of [
    "/",
    "/en/",
    "/works/story/",
    "/en/works/story/",
    "/design/b/story/",
  ])
    assert.equal(
      allowsSameOriginScripts(contentPolicies(headers, path)),
      true,
      path,
    );
});
test("original copies keep the stricter policy even when the general policy allows scripts", () => {
  const policies = contentPolicies(
    headers,
    "/original/utopiaucronia/story.htm",
  );
  assert.equal(allowsSameOriginScripts(policies), false);
  assert.ok(policies.some((policy) => /script-src\s+'none'/.test(policy)));
});
test("a blocking policy cannot be cancelled by an additional permissive policy", () => {
  assert.equal(
    allowsSameOriginScripts(["script-src 'none'", "script-src 'self'"]),
    false,
  );
  assert.equal(
    allowsSameOriginScripts(["script-src 'self'; script-src-elem 'none'"]),
    false,
  );
});
