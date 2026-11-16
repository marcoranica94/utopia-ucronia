import { satteri } from "@astrojs/markdown-satteri";
import { defineConfig } from "astro/config";
import { localReviewPlugin } from "./scripts/review/server.ts";

export default defineConfig({
  site: "https://utopia-ucronia.marcoranica.com",
  output: "static",
  integrations: [localReviewPlugin()],
  markdown: { processor: satteri({ features: { smartPunctuation: false } }) },
});
