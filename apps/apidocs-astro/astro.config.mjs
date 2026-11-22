// The sample app for @elide/apidocs/astro: the Java sample in two versions (2.0, the latest release, and main,
// a development version), the Kotlin sample, and the Markdown sample suite, on the Cloudflare adapter. Pages
// render on request, as the Komodo docs Worker renders them; the version menu and notice are server islands.
import cloudflare from "@astrojs/cloudflare";
import { apidocs } from "@elide/apidocs/astro/integration";
import { defineConfig } from "astro/config";
import { guidesPlugin } from "./scripts/guides.mjs";

// Each site's top bar switches between the sample's documentation sites, with its own marked as current.
const theme = current => ({
  extends: "elide",
  links: {
    header: [
      { label: "User guide", url: "/guides/", current: current === "guides" },
      { label: "Java API", url: "/java/2.0/", current: current === "java" },
      { label: "Kotlin API", url: "/kotlin/", current: current === "kotlin" },
    ],
  },
});

export default defineConfig({
  adapter: cloudflare(),
  server: { host: "127.0.0.1", port: 5190 },
  devToolbar: { enabled: false },
  integrations: [
    apidocs({
      sites: [
        { base: "/java/2.0/", model: "./src/models/java.ts", theme: theme("java"), version: "2.0" },
        { base: "/java/main/", model: "./src/models/java.ts", theme: theme("java"), version: "main" },
        { base: "/kotlin/", model: "./src/models/kotlin.ts", theme: theme("kotlin") },
        { base: "/guides/", model: "./src/generated/guides.json", theme: theme("guides") },
      ],
      versions: "./src/versions.ts",
    }),
  ],
  vite: { plugins: [guidesPlugin()] },
});
