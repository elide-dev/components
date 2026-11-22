// Imports the Markdown sample suite (packages/apidocs/samples/guides) into a guides-only model at
// src/generated/guides.json, and copies its images to public/guides/, when Astro starts and whenever a file in
// the suite changes. Both outputs are generated and ignored by git.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { guidesModel, importMarkdown, readSuite } from "@elide/apidocs/import";

const app = fileURLToPath(new URL("..", import.meta.url));
const suite = resolve(app, "../../packages/apidocs/samples/guides");

export function generateGuides() {
  const { files, assets } = readSuite(suite);
  const result = importMarkdown(files, {
    suite: "markdown",
    assets,
    links: [{ prefix: "../developer/", target: "https://example.com/developer/" }, { prefix: "../api/", target: "/java/2.0/" }],
  });
  const model = guidesModel(result, { name: "Geo user guide", version: "2.0" });
  mkdirSync(resolve(app, "src/generated"), { recursive: true });
  writeFileSync(resolve(app, "src/generated/guides.json"), JSON.stringify(model));
  rmSync(resolve(app, "public/guides"), { recursive: true, force: true });
  for (const copy of result.files) {
    const to = resolve(app, "public/guides", copy.to);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, copy.data);
  }
}

export function guidesPlugin() {
  generateGuides();
  return {
    name: "sample-guides",
    configureServer(server) {
      server.watcher.add(suite);
      server.watcher.on("change", file => file.startsWith(suite) && generateGuides());
    },
  };
}
