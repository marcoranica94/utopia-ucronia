import assert from "node:assert/strict";
import { test } from "node:test";
import type { Carica } from "../scripts/access.ts";
import { verificaAccess } from "../scripts/access.ts";

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
function api(policies: unknown[], publicOverride = false): Carica {
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
test("verifica tutte le pagine e accetta la policy personale", async () => {
  await verificaAccess(
    api([allow, { decision: "deny" }]),
    app.domain,
    "owner@example.org",
  );
});
test("blocca indirizzi aggiuntivi o criteri generici", async () => {
  await assert.rejects(
    verificaAccess(
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
    /bloccato/,
  );
  await assert.rejects(
    verificaAccess(
      api([
        { decision: "allow", include: [...allow.include, { everyone: {} }] },
      ]),
      app.domain,
      "owner@example.org",
    ),
    /bloccato/,
  );
});
test("blocca un bypass in una pagina successiva", async () => {
  await assert.rejects(
    verificaAccess(
      api([allow, { decision: "bypass" }]),
      app.domain,
      "owner@example.org",
    ),
    /bloccato/,
  );
});
test("blocca eccezioni pubbliche sul dominio", async () => {
  await assert.rejects(
    verificaAccess(api([allow], true), app.domain, "owner@example.org"),
    /pubblica/,
  );
});
test("blocca risposte senza paginazione verificabile", async () => {
  await assert.rejects(
    verificaAccess(
      async () => ({ success: true, result: [app] }),
      app.domain,
      "owner@example.org",
    ),
    /incompleta/,
  );
});

test("blocca una seconda applicazione su un percorso del dominio", async () => {
  const base = api([allow]);
  await assert.rejects(
    verificaAccess(
      async (path) => {
        if (path.startsWith("/access/apps?"))
          return {
            success: true,
            result: [
              app,
              {
                id: "456",
                domain: `${app.domain}/pubblico`,
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
    /percorso/,
  );
});
