#!/usr/bin/env node
/**
 * Runs the renderer bundle (render.js) over a model and writes the site. The
 * Javadoc doclet and the Dokka plugin ship this file, render.js and the assets
 * directory in their jars and start it with an external JavaScript runtime
 * (Bun or Node); it needs nothing else and never touches the network.
 *
 *   runner.mjs --bundle render.js --assets assets/ --model api.json [--theme theme.json] [--source-ref ref]
 *              [--last-modified 2026-11-21] --out site/
 *
 * --source-ref sets the theme's sourceRef: the {ref} in its source-link template. --last-modified sets the
 * theme's lastModified, sitemap.xml's lastmod: the build's date, which the renderer never reads from a clock.
 *
 * Input and output go through files, so output size is not limited by a pipe.
 * On success it prints one JSON line, {"files":N,"bytes":N,"renderMs":N}, and
 * exits 0; on failure it prints the error to stderr and exits 1.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key.startsWith("--") || i + 1 >= argv.length) throw new Error(`Expected --key value pairs, got ${key}`);
    out[key.slice(2)] = argv[i + 1];
  }
  for (const required of ["bundle", "assets", "model", "out"]) {
    if (!out[required]) throw new Error(`Missing --${required}`);
  }
  return out;
}

/** A path inside the output directory; refuses absolute paths and ".." segments. */
function inside(root, path) {
  const target = normalize(join(root, path));
  if (isAbsolute(path) || path.split("/").includes("..") || !(target + sep).startsWith(resolve(root) + sep)) {
    throw new Error(`Refusing to write outside the output directory: ${path}`);
  }
  return target;
}

try {
  const options = args(process.argv.slice(2));
  const out = resolve(options.out);
  // render.js is a classic script that defines the global ApiDocs; an indirect eval runs it at global scope.
  (0, eval)(readFileSync(options.bundle, "utf8"));
  const api = globalThis.ApiDocs;
  if (!api || typeof api.render !== "function") throw new Error(`${options.bundle} does not define ApiDocs.render`);
  const model = readFileSync(options.model, "utf8");
  const theme = options.theme ? JSON.parse(readFileSync(options.theme, "utf8")) : {};
  if (options["source-ref"]) theme.sourceRef = options["source-ref"];
  if (options["last-modified"]) theme.lastModified = options["last-modified"];
  const started = performance.now();
  const files = api.render(model, theme);
  const renderMs = Math.round(performance.now() - started);
  let count = 0;
  let bytes = 0;
  for (const [path, content] of Object.entries(files)) {
    const target = inside(out, path);
    mkdirSync(dirname(target), { recursive: true });
    if (typeof content === "string") {
      writeFileSync(target, content);
      bytes += Buffer.byteLength(content);
    } else {
      copyFileSync(inside(resolve(options.assets), content.asset), target);
    }
    count++;
  }
  process.stdout.write(JSON.stringify({ files: count, bytes, renderMs }) + "\n");
} catch (error) {
  process.stderr.write(`apidocs runner: ${error && error.message ? error.message : error}\n`);
  process.exit(1);
}
