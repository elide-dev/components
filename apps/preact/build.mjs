import { readFile, writeFile } from "node:fs/promises";
import { build } from "vite";

// Bundle the server with the same compat aliases as the client. Importing the
// unbundled source directly would resolve the installed React peers instead.
await build({ build: { ssr: "src/server.tsx", outDir: "dist/server" } });
const { prerender } = await import("./dist/server/server.js");
await build();
const template = await readFile("dist/client/index.html", "utf8");
for (const platform of [false, true]) {
  const name = platform ? "platform" : "index";
  await writeFile(`dist/client/${name}.html`, template.replace("<!--app-->", prerender(platform)));
  await writeFile(`dist/client/${name}-client.html`, template.replace("<!--app-->", ""));
}
