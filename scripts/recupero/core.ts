import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as pausa } from "node:timers/promises";
import { gunzipSync } from "node:zlib";
import { z } from "zod";

export const documentoSchema = z.object({
  url: z.url(),
  varianti: z.array(z.url()),
  esito: z.enum([
    "recuperato",
    "recuperato da copia precedente",
    "tentativo fallito",
    "mancante",
  ]),
  percorso: z.string().optional(),
  timestamp: z
    .string()
    .regex(/^\d{14}$/)
    .optional(),
  statoHttp: z.number().optional(),
  tipo: z.string().optional(),
  dimensione: z.number().int().nonnegative().optional(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  compresso: z.boolean().optional(),
  errore: z.string().optional(),
});
export const manifestSchema = z.object({
  versione: z.literal(1),
  documenti: z.array(documentoSchema),
});
export type Documento = z.infer<typeof documentoSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type Copia = { timestamp: string; original: string; mimetype: string };
export const agente =
  "UtopiaUcroniaArchivio/0.1 (archivio personale; recupero da Internet Archive)";
export const sha256 = (dati: Uint8Array) =>
  createHash("sha256").update(dati).digest("hex");

export function chiave(url: string): string {
  const u = new URL(url);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    !["www.fmboschetto.it", "fmboschetto.it"].includes(u.hostname)
  )
    throw new Error(`Origine non ammessa: ${url}`);
  if (u.search) throw new Error(`Query non supportata: ${url}`);
  return decodeURIComponent(u.pathname).toLowerCase();
}
export function percorsoOriginale(url: string): string {
  const p = chiave(url);
  if (!p.startsWith("/utopiaucronia/") && !p.startsWith("/racconti/"))
    throw new Error(`Percorso fuori archivio: ${p}`);
  if (
    p.includes("\\") ||
    p.includes("\0") ||
    p.split("/").some((v) => v === ".." || v === ".")
  )
    throw new Error("Percorso non sicuro");
  return p.slice(1) + (p.endsWith("/") ? "index.htm" : "");
}
export function percorsoSicuro(root: string, relativo: string): string {
  const dest = path.resolve(root, relativo);
  if (!dest.startsWith(`${path.resolve(root)}${path.sep}`))
    throw new Error(`Percorso non sicuro: ${relativo}`);
  return dest;
}
export async function leggiManifest(root = "archivio"): Promise<Manifest> {
  return manifestSchema.parse(
    JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")),
  );
}
export async function scriviJson(file: string, dati: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, `${JSON.stringify(dati, null, 2)}\n`);
  await rename(`${file}.tmp`, file);
}
export async function verificaDocumento(
  d: Documento,
  root = "archivio",
): Promise<boolean> {
  if (!d.percorso || !d.sha256 || !d.esito.startsWith("recuperato"))
    return false;
  try {
    const dati = await readFile(
      percorsoSicuro(path.join(root, "originale"), d.percorso),
    );
    return sha256(dati) === d.sha256 && dati.length === d.dimensione;
  } catch {
    return false;
  }
}
export function preparaDati(
  input: Uint8Array,
  url: string,
  tipo: string,
): { dati: Buffer; compresso: boolean } {
  const compresso = input[0] === 0x1f && input[1] === 0x8b;
  const dati = compresso ? gunzipSync(input) : Buffer.from(input);
  if (!dati.length) throw new Error("File vuoto");
  const testo = dati.toString("latin1");
  if (
    /bot blocked|AW Special Error|HTTP Error \d|IIS.*Detailed Error/i.test(
      testo.slice(0, 15000),
    )
  )
    throw new Error("Pagina di errore archiviata");
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  if (
    ext === ".pdf" &&
    (!testo.startsWith("%PDF-") || !testo.slice(-2048).includes("%%EOF"))
  )
    throw new Error("PDF non valido o troncato");
  if (
    [".htm", ".html", ""].includes(ext) &&
    (!/text\/html|application\/xhtml/i.test(tipo) ||
      !/<(?:html|frameset|body)[\s>]/i.test(testo) ||
      !/<\/(?:html|frameset|body)\s*>/i.test(testo))
  )
    throw new Error("HTML non valido, troncato o tipo incoerente");
  if (
    ext === ".png" &&
    !dati.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error("PNG non valido");
  if (
    [".jpg", ".jpeg"].includes(ext) &&
    !(
      dati[0] === 255 &&
      dati[1] === 216 &&
      dati.at(-2) === 255 &&
      dati.at(-1) === 217
    )
  )
    throw new Error("JPEG non valido o troncato");
  if (ext === ".gif" && !/^GIF8[79]a/.test(testo))
    throw new Error("GIF non valido");
  return { dati, compresso };
}
export function attesaRetry(
  header: string | null,
  tentativo: number,
  ora = Date.now(),
): number {
  const ms =
    header && /^\d+$/.test(header)
      ? Number(header) * 1000
      : header
        ? Date.parse(header) - ora
        : NaN;
  return Math.min(
    600000,
    Math.max(0, Number.isFinite(ms) ? ms : 2000 * 2 ** tentativo),
  );
}
export async function richiesta(url: string): Promise<Response> {
  if (new URL(url).hostname !== "web.archive.org")
    throw new Error("Il recupero ammette solo web.archive.org");
  for (let tentativo = 0; tentativo < 3; tentativo++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": agente },
        redirect: "manual",
        signal: AbortSignal.timeout(45000),
      });
      if (r.status >= 300 && r.status < 400)
        throw new Error(`Redirect non seguito: ${r.headers.get("location")}`);
      if (r.status !== 429 && r.status < 500) return r;
      if (tentativo === 2)
        throw new Error(`HTTP ${r.status} dopo tre tentativi`);
      const ms = attesaRetry(r.headers.get("retry-after"), tentativo);
      await r.body?.cancel();
      console.log(`HTTP ${r.status}; attesa ${Math.round(ms / 1000)} s`);
      await pausa(ms);
    } catch (error) {
      if (tentativo === 2) throw error;
      await pausa(attesaRetry(null, tentativo));
    }
  }
  throw new Error("Tentativi esauriti");
}
export async function copie(url: string): Promise<Copia[]> {
  percorsoOriginale(url);
  const query = new URLSearchParams({
    url,
    output: "json",
    fl: "timestamp,original,mimetype",
    filter: "statuscode:200",
  });
  const r = await richiesta(`https://web.archive.org/cdx/search/cdx?${query}`);
  if (!r.ok) throw new Error(`CDX HTTP ${r.status}`);
  const rows = (await r.json()) as string[][];
  return rows
    .slice(1)
    .map(([timestamp, original, mimetype]) => ({
      timestamp,
      original,
      mimetype,
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
