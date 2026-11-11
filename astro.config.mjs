import { satteri } from "@astrojs/markdown-satteri";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://utopia-ucronia.marcoranica.com",
  output: "static",
  markdown: { processor: satteri({ features: { smartPunctuation: false } }) },
});
