/**
 * Builds a static site exactly as the doclet does: dist/runner.mjs runs
 * dist/render.js over a model in an external runtime and writes the files.
 * Then it serves the site, opens it from file://, or both.
 *
 *   bun run sample [--sample java|kotlin] [--model api.json] [--preset neutral|elide] [--theme theme.json]
 *                  [--out dir] [--runtime bun|node|<path>] [--serve] [--port 5181] [--open] [--no-build]
 *
 * Without --out it writes to dist/sample/<name>-<preset>/. It rebuilds dist/
 * first unless --no-build is given.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { samples } from "../samples";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at < 0 ? undefined : args[at + 1];
};
const cwd = process.env.INIT_CWD ?? process.cwd();
const root = fileURLToPath(new URL("..", import.meta.url));
const preset = flag("preset") ?? "neutral";
const modelArg = flag("model");
const sample = (flag("sample") ?? "java") as keyof typeof samples;
const name = modelArg ? "model" : sample;
const out = resolve(cwd, flag("out") ?? resolve(root, `dist/sample/${name}-${preset}`));
const runtime = flag("runtime") ?? (process.versions.bun ? process.execPath : "node");

if (!args.includes("--no-build")) {
  const build = spawnSync("bun", ["run", "build"], { cwd: root, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const work = mkdtempSync(join(tmpdir(), "apidocs-sample-"));
try {
  let model = modelArg ? resolve(cwd, modelArg) : join(work, "api.json");
  if (!modelArg) {
    if (!samples[sample]) throw new Error(`No sample named ${sample}; use java or kotlin`);
    writeFileSync(model, JSON.stringify(samples[sample]));
  }
  if (!existsSync(model)) throw new Error(`No model at ${model}`);
  const theme = flag("theme") ? resolve(cwd, flag("theme")!) : join(work, "theme.json");
  if (!flag("theme")) writeFileSync(theme, JSON.stringify({ extends: preset }));
  rmSync(out, { recursive: true, force: true });
  const run = spawnSync(runtime, [
    resolve(root, "dist/runner.mjs"), "--bundle", resolve(root, "dist/render.js"), "--assets", resolve(root, "dist/assets"),
    "--model", model, "--theme", theme, "--out", out,
  ], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`runner failed (${runtime}):\n${run.stderr}`);
  const stats = JSON.parse(run.stdout);
  console.log(`\n  ${stats.files} files, ${(stats.bytes / 1e6).toFixed(1)} MB, rendered in ${stats.renderMs} ms with ${runtime}`);
  console.log(`  ${out}`);
  console.log(`  file: ${pathToFileURL(join(out, "index.html")).href}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (args.includes("--open")) {
  const url = pathToFileURL(join(out, "index.html")).href;
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  spawnSync(opener, [url], { stdio: "ignore" });
}

if (args.includes("--serve")) {
  const port = Number(flag("port") ?? 5181);
  const types: Record<string, string> = { html: "text/html; charset=utf-8", css: "text/css", js: "text/javascript", svg: "image/svg+xml", json: "application/json", md: "text/markdown; charset=utf-8", txt: "text/plain; charset=utf-8", woff2: "font/woff2", xml: "application/xml" };
  Bun.serve({
    port,
    hostname: "127.0.0.1",
    fetch(request) {
      const path = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, "") || "index.html";
      const file = resolve(out, path);
      if (!file.startsWith(out) || !existsSync(file)) return new Response("Not found", { status: 404 });
      const ext = file.slice(file.lastIndexOf(".") + 1);
      return new Response(readFileSync(file), { headers: { "content-type": types[ext] ?? "application/octet-stream" } });
    },
  });
  console.log(`  serving at http://127.0.0.1:${port}/index.html (Ctrl-C to stop)\n`);
}
