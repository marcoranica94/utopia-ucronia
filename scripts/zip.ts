import { inflateRawSync } from "node:zlib";

/**
 * Minimal reader for the 2004–2026 zip attachments: central directory,
 * stored and deflated entries only. Zips are untrusted data: names are
 * returned as written (never used as paths here), sizes are checked against
 * a ceiling before inflating, and nothing is ever executed or written.
 */

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
  directory: boolean;
  encrypted: boolean;
}

/** IBM code page 437 upper half, the default for names without the UTF-8 flag. */
const CP437 =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";
const decodeName = (bytes: Buffer, utf8: boolean) =>
  utf8
    ? bytes.toString("utf8")
    : [...bytes]
        .map((b) => (b < 128 ? String.fromCharCode(b) : CP437[b - 128]))
        .join("");

export function zipEntries(data: Buffer): ZipEntry[] {
  // End of central directory: last 22 bytes plus an optional comment.
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65_557); i--)
    if (data.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error("Not a zip archive (no end of directory)");
  const count = data.readUInt16LE(eocd + 10);
  let at = data.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (data.readUInt32LE(at) !== 0x02014b50)
      throw new Error(`Broken central directory at entry ${n}`);
    const flags = data.readUInt16LE(at + 8);
    const nameLength = data.readUInt16LE(at + 28);
    const extraLength = data.readUInt16LE(at + 30);
    const commentLength = data.readUInt16LE(at + 32);
    const name = decodeName(
      data.subarray(at + 46, at + 46 + nameLength),
      (flags & 0x800) !== 0,
    );
    entries.push({
      name,
      method: data.readUInt16LE(at + 10),
      compressedSize: data.readUInt32LE(at + 20),
      size: data.readUInt32LE(at + 24),
      offset: data.readUInt32LE(at + 42),
      directory: name.endsWith("/"),
      encrypted: (flags & 1) !== 0,
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

const MAX_ENTRY = 64 * 1024 * 1024;

export function zipRead(data: Buffer, entry: ZipEntry): Buffer {
  if (entry.encrypted) throw new Error(`Encrypted entry: ${entry.name}`);
  if (entry.size > MAX_ENTRY) throw new Error(`Entry too large: ${entry.name}`);
  const at = entry.offset;
  if (data.readUInt32LE(at) !== 0x04034b50)
    throw new Error(`Broken local header: ${entry.name}`);
  const start =
    at + 30 + data.readUInt16LE(at + 26) + data.readUInt16LE(at + 28);
  const raw = data.subarray(start, start + entry.compressedSize);
  const out =
    entry.method === 0
      ? Buffer.from(raw)
      : entry.method === 8
        ? inflateRawSync(raw, { maxOutputLength: MAX_ENTRY })
        : undefined;
  if (!out)
    throw new Error(`Unsupported method ${entry.method}: ${entry.name}`);
  if (out.length !== entry.size)
    throw new Error(`Size mismatch: ${entry.name}`);
  return out;
}
