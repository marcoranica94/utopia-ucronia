import { openCache } from "./build-cache.ts";
import { checkLinks, type PageFacts } from "./link-check.ts";

const cache = await openCache<PageFacts>("links");
const { errors, total } = await checkLinks("dist", cache);
if (errors.length)
  throw new Error(`Invalid links or content:\n${errors.join("\n")}`);
await cache.prune();
console.log(
  `${total} links and resources checked; no email or active content in the HTML pages`,
);
console.log(cache.summary());
