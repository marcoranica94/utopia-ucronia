import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AstroIntegration } from "astro";
import { mapSchema } from "../../src/editorial/model.ts";
import { useTranslations } from "../../src/i18n.ts";
import { redact } from "../editorial-core.ts";
import { sha256 } from "../recovery/core.ts";
import {
  applyDecisions,
  decisionFileSchema,
  proposalFingerprint,
  readDecisions,
  reviewDecisionSchema,
} from "../review-decisions.ts";

// Installed only by Vite's development server. No route or data is emitted at build time.
export function localReviewPlugin(
  options: { mapPath?: string; decisionPath?: string } = {},
): AstroIntegration {
  const mapPath = options.mapPath ?? "data/map.yaml";
  const decisionPath = options.decisionPath ?? "data/review-decisions.json";
  const token = randomBytes(32).toString("hex");
  let writing = false;
  return {
    name: "local-editorial-review",
    hooks: {
      "astro:server:setup"({ server }) {
        server.middlewares.use(
          async (req: IncomingMessage, res: ServerResponse, next) => {
            const url = new URL(req.url ?? "/", "http://localhost");
            if (!/^\/(?:en\/)?review(?:\/|$)/.test(url.pathname)) return next();
            const host = req.headers.host ?? "";
            const hostName = host.replace(/:\d+$/, "");
            const local =
              ["localhost", "127.0.0.1", "[::1]"].includes(hostName) &&
              ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
                req.socket.remoteAddress ?? "",
              );
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader(
              "Content-Security-Policy",
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
            );
            const send = (status: number, value: unknown) => {
              res.statusCode = status;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify(value));
            };
            if (!local) return send(403, { error: "Local development only" });
            const lang = url.pathname.startsWith("/en/") ? "en" : "it";
            const t = useTranslations(lang);
            try {
              if (url.pathname.endsWith("/review.js") && req.method === "GET") {
                res.setHeader("Content-Type", "text/javascript; charset=utf-8");
                res.end(await readFile("scripts/review/client.js", "utf8"));
                return;
              }
              if (/\/review\/?$/.test(url.pathname) && req.method === "GET") {
                let html = await readFile("scripts/review/page.html", "utf8");
                html = html
                  .replace('<html lang="it">', `<html lang="${lang}">`)
                  .replaceAll(
                    "@OTHER@",
                    lang === "it" ? "/en/review/" : "/review/",
                  )
                  .replaceAll(
                    "@SCRIPT@",
                    `${lang === "en" ? "/en" : ""}/review/review.js`,
                  );
                html = html.replace(/@([a-zA-Z]+)@/g, (_whole, key) =>
                  t(`review.${key}` as Parameters<typeof t>[0]),
                );
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.end(html);
                return;
              }
              if (!url.pathname.endsWith("/api"))
                return send(404, { error: "Not found" });
              const raw = await readFile(mapPath, "utf8"),
                ledger = await readDecisions(decisionPath);
              const revision = sha256(
                Buffer.from(raw + JSON.stringify(ledger)),
              );
              const map = mapSchema.parse(
                applyDecisions(mapSchema.parse(JSON.parse(raw)), ledger),
              );
              if (req.method === "GET") {
                const filter = url.searchParams.get("state") ?? "all",
                  action = url.searchParams.get("action") ?? "";
                const priority = [
                  "work",
                  "split",
                  "merge",
                  "world",
                  "index",
                  "discard",
                  "attachment",
                ];
                const proposals = map.proposals
                  .filter(
                    (p) =>
                      (!action || p.action === action) &&
                      (filter === "all" ||
                        (filter === "pending"
                          ? p.review.by !== "owner"
                          : p.review.by === "owner" &&
                            p.review.state === filter)),
                  )
                  .sort(
                    (a, b) =>
                      priority.indexOf(a.action) - priority.indexOf(b.action) ||
                      a.id.localeCompare(b.id),
                  );
                const pages = Math.max(1, Math.ceil(proposals.length / 20)),
                  page = Math.max(
                    1,
                    Math.min(
                      pages,
                      Number.parseInt(
                        url.searchParams.get("page") ?? "1",
                        10,
                      ) || 1,
                    ),
                  );
                const authorsById = new Map(
                  map.authors.map((author) => [author.id, author.name]),
                );
                const itemsById = new Map(
                  map.items.map((item) => [item.id, item]),
                );
                const docsById = new Map(
                  map.documents.map((doc) => [doc.id, doc]),
                );
                send(200, {
                  token,
                  revision,
                  page,
                  pages,
                  total: proposals.length,
                  start: proposals.length ? (page - 1) * 20 + 1 : 0,
                  end: Math.min(page * 20, proposals.length),
                  labels: Object.fromEntries(
                    [
                      "saved",
                      "conflict",
                      "error",
                      "batch",
                      "source",
                      "proposal",
                      "metadata",
                      "reason",
                      "approve",
                      "defer",
                      "empty",
                    ].map((key) => [
                      key,
                      t(`review.${key}` as Parameters<typeof t>[0]),
                    ]),
                  ),
                  entries: proposals
                    .slice((page - 1) * 20, page * 20)
                    .map((p) => ({
                      id: p.id,
                      action: p.action,
                      level: p.level,
                      review: p.review,
                      fingerprint: proposalFingerprint(map, p.id),
                      documents: p.documents.map((id) => {
                        const doc = docsById.get(id);
                        if (!doc) throw Error("Missing proposal source");
                        return {
                          id,
                          url: redact(doc.url),
                          sha256: doc.sha256,
                          mediaType: doc.mediaType,
                        };
                      }),
                      items: p.targets.map((id) => {
                        const item = itemsById.get(id);
                        if (!item) throw Error("Missing proposal target");
                        return {
                          id,
                          title: item.title,
                          language: item.language,
                          classification: item.classification,
                          authors: item.authors.map(
                            (id) => authorsById.get(id) ?? id,
                          ),
                          composition: item.composition,
                          sources: item.sources,
                          contributions: item.contributions.length,
                        };
                      }),
                    })),
                });
                return;
              }
              if (req.method !== "POST")
                return send(405, { error: "Method not allowed" });
              if (
                req.headers.origin !== `http://${host}` ||
                req.headers["x-review-token"] !== token ||
                !req.headers["content-type"]?.startsWith("application/json")
              )
                return send(403, { error: "Invalid local review request" });
              if (writing)
                return send(409, {
                  error: "A review write is already in progress",
                });
              let rawBody = "";
              for await (const chunk of req) {
                rawBody += chunk;
                if (rawBody.length > 12000)
                  return send(413, { error: "Request too large" });
              }
              const body = JSON.parse(rawBody);
              if (body.revision !== revision)
                return send(409, { error: "Review state changed" });
              const decision = reviewDecisionSchema.parse({
                ...body,
                updatedAt: new Date().toISOString(),
              });
              if (
                proposalFingerprint(map, decision.proposalId) !==
                decision.fingerprint
              )
                return send(409, { error: "Proposal changed" });
              const updated = decisionFileSchema.parse({
                version: 1,
                decisions: [
                  ...ledger.decisions.filter(
                    (d) => d.proposalId !== decision.proposalId,
                  ),
                  decision,
                ].sort((a, b) => a.proposalId.localeCompare(b.proposalId)),
              });
              mapSchema.parse(applyDecisions(map, updated));
              writing = true;
              try {
                // Recheck immediately before atomic replacement: concurrent/stale decisions never overwrite one another.
                if (
                  sha256(
                    Buffer.from(
                      (await readFile(mapPath, "utf8")) +
                        JSON.stringify(await readDecisions(decisionPath)),
                    ),
                  ) !== revision
                )
                  return send(409, { error: "Review state changed" });
                await writeFile(
                  `${decisionPath}.tmp`,
                  `${JSON.stringify(updated, null, 2)}\n`,
                  { flag: "wx" },
                );
                await rename(`${decisionPath}.tmp`, decisionPath);
              } finally {
                writing = false;
              }
              send(200, { saved: true });
            } catch (error) {
              send(400, {
                error:
                  error instanceof Error
                    ? error.message
                    : "Review request failed",
              });
            }
          },
        );
      },
    },
  };
}
