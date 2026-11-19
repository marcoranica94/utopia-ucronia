import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import type { OcrFile } from "./pdf.ts";
import { safePath, sha256, writeJson } from "./recovery/core.ts";

/**
 * S8: read a scanned PDF once with OCR and store the result in
 * data/ocr/<sha256 of the PDF>.json (lines with position and size, page
 * confidence, engine). The conversion then treats the stored lines as the
 * PDF's text layer; the build never runs OCR. Only scans whose every page
 * reaches MIN_CONFIDENCE are stored: picture books and low-resolution
 * magazine pages give fragments, not text.
 *
 *   pnpm attachments ocr [--columns 2] <archive path of a loose PDF> …
 *
 * `--columns N` reads each page as N side-by-side columns, left to right
 * (an encyclopedia page read across both columns would mix them).
 */
const MIN_CONFIDENCE = 80;
const ENGINE = "tesseract.js 7.0.0, ita 4.0.0_best_int";
const argv = process.argv.slice(3);
const columnsAt = argv.indexOf("--columns");
const columns = columnsAt >= 0 ? Number(argv[columnsAt + 1]) : 1;
const paths = argv.filter(
  (a, i) => !a.startsWith("--") && !(columnsAt >= 0 && i === columnsAt + 1),
);
if (!paths.length) throw new Error("Give the archive paths of scanned PDFs");
const { getDocumentProxy, extractImages } = await import("unpdf");
const worker = await createWorker("ita", 1, {
  langPath: "node_modules/@tesseract.js-data/ita/4.0.0_best_int",
  cacheMethod: "none",
  gzip: true,
});
try {
  for (const path of paths) {
    const data = await readFile(safePath("archive/original", path));
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const pages: OcrFile["pages"] = [];
    for (let page = 1; page <= pdf.numPages; page++) {
      const images = await extractImages(pdf, page);
      // A scanned page is its largest picture.
      const scan = images.sort(
        (a, b) => b.width * b.height - a.width * a.height,
      )[0];
      if (!scan) throw new Error(`${path}: page ${page} has no scan`);
      const png = await sharp(Buffer.from(scan.data), {
        raw: {
          width: scan.width,
          height: scan.height,
          channels: scan.channels,
        },
      })
        .png()
        .toBuffer();
      const lines: OcrFile["pages"][number]["lines"] = [];
      const confidences: number[] = [];
      const width = Math.floor(scan.width / columns);
      for (let column = 0; column < columns; column++) {
        const part =
          columns === 1
            ? png
            : await sharp(png)
                .extract({
                  left: column * width,
                  top: 0,
                  width,
                  height: scan.height,
                })
                .toBuffer();
        const { data: result } = await worker.recognize(
          part,
          {},
          { blocks: true, text: false },
        );
        confidences.push(result.confidence);
        // Columns follow one another: each starts below the previous one.
        const offset = column * scan.height;
        for (const block of result.blocks ?? [])
          for (const paragraph of block.paragraphs)
            for (const line of paragraph.lines) {
              const text = line.text.replace(/\s+/g, " ").trim();
              if (text)
                lines.push({
                  text,
                  x: line.bbox.x0,
                  bottom: offset + line.bbox.y1,
                  height: line.bbox.y1 - line.bbox.y0,
                });
            }
      }
      pages.push({
        page,
        confidence: Math.round(Math.min(...confidences)),
        lines,
      });
    }
    const worst = Math.min(...pages.map((p) => p.confidence));
    if (worst < MIN_CONFIDENCE) {
      console.log(`${path}: not stored, a page at ${worst}% confidence`);
      continue;
    }
    const hash = sha256(data);
    await writeJson(`data/ocr/${hash}.json`, {
      engine: ENGINE,
      sha256: hash,
      path,
      pages,
    });
    console.log(`${path}: ${pages.length} pages, lowest confidence ${worst}%`);
  }
} finally {
  await worker.terminate();
}
