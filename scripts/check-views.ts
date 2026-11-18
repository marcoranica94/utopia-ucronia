import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Page } from "playwright";
import { writeJson } from "./recovery/core.ts";

/**
 * S6 view audit. Serves the built `dist/` and opens every kind of page, in
 * Italian and English, at phone to desktop widths, with text at 200%, in light
 * and dark. For each case it checks: no horizontal page scroll, no email
 * address in the visible text, axe (WCAG 2.2 A/AA) without violations, and a
 * visible focus on the first Tab. Run after `pnpm build`:
 *
 *   pnpm views:check [--only /library/] [--report reports/s6-views.json]
 */

const { values } = parseArgs({
  options: {
    only: { type: "string" },
    report: { type: "string", default: "reports/s6-views.json" },
  },
});

const dist = path.resolve("dist");
const require = createRequire(import.meta.url);
const axeSource = require.resolve("axe-core/axe.min.js");

/** One page per kind of view; EN shares the templates, so a subset suffices. */
const ROUTES = [
  "/",
  "/library/",
  "/works/",
  "/works/ucronia-25-luglio-1943-ordine-del-giorno-farinacci-ef21eb1c/",
  "/works/keikyo-il-giappone-nestoriano-7176c306/",
  "/works/1848-nasce-la-repubblica-italiana-7c5e68c2/",
  "/works/introduzione-ffaddce0/",
  "/divergences/",
  "/divergences/il-business-plot-1ee21bfc/",
  "/eras/",
  "/eras/1500s/",
  "/places/",
  "/places/africa/",
  "/themes/",
  "/themes/cold-war/",
  "/authors/",
  "/authors/adriano-boni-f4bd43eb4006/",
  "/worlds/",
  "/worlds/capvt-mvndi/",
  "/tree/",
  "/whatif/",
  "/history/",
  "/search/",
  "/sources/doc-005bfe47becd/",
  "/archive-records/record-005bfe47becd/",
  "/gaps/",
  "/design/",
  "/404.html",
  "/en/",
  "/en/library/",
  "/en/works/ucronia-25-luglio-1943-ordine-del-giorno-farinacci-ef21eb1c/",
  "/en/eras/",
  "/en/worlds/capvt-mvndi/",
  "/en/tree/",
  "/en/whatif/",
  "/en/history/",
  "/en/search/",
  "/en/authors/",
];
const WIDTHS = [320, 390, 768, 1024, 1440];
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

async function resolveFile(url: string): Promise<string | undefined> {
  const clean = decodeURIComponent(new URL(url, "http://x").pathname);
  let file = path.join(dist, clean);
  if (!file.startsWith(dist)) return undefined;
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    await stat(file);
    return file;
  } catch {
    return undefined;
  }
}

const server = createServer(async (req, res) => {
  const file = await resolveFile(req.url ?? "/");
  const target = file ?? path.join(dist, "404.html");
  res.writeHead(file ? 200 : 404, {
    "content-type": MIME[path.extname(target)] ?? "application/octet-stream",
  });
  createReadStream(target).pipe(res);
});
await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
const address = server.address();
const origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

interface Failure {
  path: string;
  case: string;
  problem: string;
  detail?: unknown;
}
const failures: Failure[] = [];
const fail = (
  route: string,
  label: string,
  problem: string,
  detail?: unknown,
) => failures.push({ path: route, case: label, problem, detail });

async function overflow(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    if (root.scrollWidth <= root.clientWidth + 1) return undefined;
    // Name the widest element that sticks out, to make the report useful.
    const limit = root.clientWidth;
    let worst: { selector: string; right: number } | undefined;
    for (const el of document.body.querySelectorAll("*")) {
      const box = el.getBoundingClientRect();
      if (
        box.width &&
        box.right > limit + 1 &&
        (!worst || box.right > worst.right)
      ) {
        const cls =
          typeof el.className === "string" && el.className.trim()
            ? `.${el.className.trim().split(/\s+/).join(".")}`
            : "";
        worst = {
          selector: `${el.tagName.toLowerCase()}${cls}`,
          right: Math.round(box.right),
        };
      }
    }
    return { scrollWidth: root.scrollWidth, clientWidth: limit, worst };
  });
}

async function axe(page: Page) {
  await page.addScriptTag({ path: axeSource });
  return page.evaluate(async () => {
    // biome-ignore lint/suspicious/noExplicitAny: axe is injected at runtime
    const result = await (window as any).axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
      resultTypes: ["violations"],
    });
    return result.violations.map(
      (v: {
        id: string;
        impact: string;
        nodes: { target: string[]; failureSummary: string }[];
      }) => ({
        id: v.id,
        impact: v.impact,
        count: v.nodes.length,
        examples: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
      }),
    );
  });
}

async function focusVisible(page: Page) {
  await page.keyboard.press("Tab");
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "nothing focused";
    const s = getComputedStyle(el);
    const outline =
      s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth) > 0;
    const ring = s.boxShadow && s.boxShadow !== "none";
    const box = el.getBoundingClientRect();
    if (!outline && !ring) return `no focus indicator on ${el.tagName}`;
    if (box.bottom < 0 || box.top > innerHeight)
      return "focused element off screen";
    return undefined;
  });
}

const browser = await chromium.launch();
const routes = values.only ? ROUTES.filter((r) => r === values.only) : ROUTES;
let cases = 0;
try {
  for (const route of routes) {
    const expected = route === "/404.html" ? 404 : 200;
    const runs: {
      label: string;
      width: number;
      dark: boolean;
      text200: boolean;
      full: boolean;
    }[] = [
      ...WIDTHS.map((width) => ({
        label: `${width}px`,
        width,
        dark: false,
        text200: false,
        full: width === 1440 || width === 320,
      })),
      {
        label: "320px dark",
        width: 320,
        dark: true,
        text200: false,
        full: false,
      },
      {
        label: "1440px dark",
        width: 1440,
        dark: true,
        text200: false,
        full: true,
      },
      {
        label: "390px text 200%",
        width: 390,
        dark: false,
        text200: true,
        full: false,
      },
      {
        label: "1280px text 200%",
        width: 1280,
        dark: false,
        text200: true,
        full: false,
      },
    ];
    for (const run of runs) {
      cases++;
      const context = await browser.newContext({
        viewport: { width: run.width, height: 900 },
        colorScheme: run.dark ? "dark" : "light",
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      try {
        const response = await page.goto(origin + route, {
          waitUntil: "load",
          timeout: 60_000,
        });
        const status = response?.status() ?? 0;
        if (status !== expected && !(route === "/404.html" && status === 200))
          fail(route, run.label, `HTTP ${status}`);
        if (run.text200)
          await page.addStyleTag({
            content: "html{font-size:200% !important}",
          });
        const wide = await overflow(page);
        if (wide) fail(route, run.label, "horizontal scroll", wide);
        if (run.full) {
          // Visible text only, as a reader sees it.
          // biome-ignore lint/performance/useDomNodeTextContent: rendered text is the point
          const text = await page.evaluate(() => document.body.innerText);
          const email = EMAIL.exec(text);
          if (email)
            fail(
              route,
              run.label,
              "email in visible text",
              email[0].replace(/^[^@]+/, "…"),
            );
          const violations = await axe(page);
          for (const v of violations) fail(route, run.label, `axe ${v.id}`, v);
          if (!run.dark) {
            const focus = await focusVisible(page);
            if (focus) fail(route, run.label, "keyboard focus", focus);
          }
        }
        if (errors.length) fail(route, run.label, "script error", errors);
      } catch (error) {
        fail(route, run.label, "page did not load", String(error));
      } finally {
        await context.close();
      }
    }
    process.stdout.write(
      `${route} ${failures.filter((f) => f.path === route).length ? "✗" : "✓"}\n`,
    );
  }
} finally {
  await browser.close();
  server.close();
}

await writeJson(values.report, {
  date: new Date().toISOString().slice(0, 10),
  routes: routes.length,
  cases,
  widths: WIDTHS,
  checks: [
    "status",
    "horizontal scroll",
    "text 200%",
    "emails",
    "axe WCAG 2.2 A/AA (light and dark)",
    "first Tab focus",
  ],
  passed: failures.length === 0,
  failures,
});
console.log(
  `${routes.length} routes, ${cases} cases, ${failures.length} failures → ${values.report}`,
);
if (failures.length) process.exitCode = 1;
