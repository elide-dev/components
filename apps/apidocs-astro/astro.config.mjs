// The sample app for @elide/apidocs/astro: the Java sample in two versions (2.0, the latest release, and main,
// a development version), the Kotlin sample, and the Markdown sample suite, on the Cloudflare adapter. Pages
// render on request, as the Komodo docs Worker renders them; the version menu and notice are server islands.
import cloudflare from "@astrojs/cloudflare";
import { apidocs } from "@elide/apidocs/astro/integration";
import { defineConfig } from "astro/config";
import { guidesPlugin } from "./scripts/guides.mjs";

const theme = { extends: "elide" };

export default defineConfig({
  adapter: cloudflare(),
  server: { host: "127.0.0.1", port: 5190 },
  devToolbar: { enabled: false },
  integrations: [
    apidocs({
      sites: [
        { base: "/java/2.0/", model: "./src/models/java.ts", theme, version: "2.0" },
        { base: "/java/main/", model: "./src/models/java.ts", theme, version: "main" },
        { base: "/kotlin/", model: "./src/models/kotlin.ts", theme },
        { base: "/guides/", model: "./src/generated/guides.json", theme },
      ],
      versions: "./src/versions.ts",
    }),
  ],
  vite: { plugins: [guidesPlugin()] },
});
