import { load } from "cheerio";
import { blocks } from "./anatomy.ts";
import { redact } from "./editorial-core.ts";
/** Source views are inert text, never executable archived HTML. */
export function plainSourceBlocks(html: string) {
  const $ = load(html);
  $("script,style,iframe,object,embed,form,noscript").remove();
  return blocks($.html())
    .map((block) =>
      redact(block.text)
        .replace(/mailto:/gi, "")
        .trim(),
    )
    .filter(Boolean);
}
