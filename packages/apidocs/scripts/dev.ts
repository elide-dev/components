/**
 * The development loop: a Vite server that renders the sample models (or a
 * real api.json) with the production render() and reloads the page when a
 * component, the stylesheet, a theme, a sample or the model file changes.
 *
 *   bun run dev [--port 5180] [--model path/to/api.json] [--guides path/to/suite] [--no-open]
 *
 * --guides serves a Markdown suite through the importer (src/import/markdown.ts) as a guides-only site; editing a
 * .md file or an image in it reloads the page. The Markdown sample suite (samples/guides) is always available.
 *
 * Pages are served under /site/<model>/<preset>/; / is a dev-only shell with
 * controls for the theme preset, light or dark, the model and the viewport
 * width. The shell and the module script that runs the islands in dev are not
 * part of any output: `bun run sample` builds what the doclet writes.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at < 0 ? undefined : args[at + 1];
};
const port = Number(flag("port") ?? 5180);
const host = flag("host") ?? "127.0.0.1";
const modelPath = flag("model") ? resolve(process.env.INIT_CWD ?? process.cwd(), flag("model")!) : undefined;
const guidesPath = flag("guides") ? resolve(process.env.INIT_CWD ?? process.cwd(), flag("guides")!) : undefined;
const open = !args.includes("--no-open");

const root = fileURLToPath(new URL("..", import.meta.url));
const sampleSuite = resolve(root, "samples/guides");
/** The Markdown suites the dev bar offers: the sample, and the --guides directory. */
const suites: Record<string, string> = { markdown: sampleSuite, ...(guidesPath ? { guides: guidesPath } : {}) };
/** Files a suite's pages show (images), by model and path in the site: copied from the suite, not rendered. */
const suiteFiles = new Map<string, Map<string, Uint8Array>>();
const require = createRequire(import.meta.url);
type Output = Record<string, string | { asset: string }>;
const cache = new Map<string, Output>();

async function site(server: ViteDevServer, model: string, preset: string): Promise<Output> {
  const key = `${model}/${preset}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { render } = await server.ssrLoadModule("/src/render.tsx");
  const theme = { extends: preset === "elide" ? "elide" : "neutral" };
  if (suites[model]) {
    const { suiteSite } = await server.ssrLoadModule("/src/import/suite.ts");
    const { formatDiagnostic } = await server.ssrLoadModule("/src/import/markdown.ts");
    const started = performance.now();
    const built = suiteSite(suites[model], {
      id: model,
      title: model === "markdown" ? "Geo user guide" : (guidesPath!.split("/").filter(Boolean).pop() ?? "Guides"),
      theme,
      includeDrafts: args.includes("--include-drafts"),
      // The sample suite links to a sibling suite and an API reference; both live on example.com.
      links: [{ prefix: "../developer/", target: "https://example.com/developer/" }, { prefix: "../api/", target: "https://example.com/api/" }],
    });
    for (const d of built.diagnostics) console.log(`  ${formatDiagnostic(d, `${suites[model]}/`)}`);
    suiteFiles.set(key, new Map(built.copies.map((c: { to: string; data: Uint8Array }) => [c.to, c.data])));
    console.log(`  rendered ${model} with ${preset}: ${Object.keys(built.output).length} files in ${Math.round(performance.now() - started)} ms`);
    cache.set(key, built.output);
    return built.output;
  }
  let input: unknown;
  if (model === "model") {
    if (!modelPath) throw new Error("Start the server with --model <api.json> to browse a real model");
    input = readFileSync(modelPath, "utf8");
  } else {
    const { samples } = await server.ssrLoadModule("/samples/index.ts");
    input = samples[model];
    if (!input) throw new Error(`No sample named ${model}`);
  }
  const started = performance.now();
  const out = render(input, theme) as Output;
  console.log(`  rendered ${model} with ${preset}: ${Object.keys(out).length} files in ${Math.round(performance.now() - started)} ms`);
  cache.set(key, out);
  return out;
}

/** The dev-only replacement for the deferred client bundle: the islands as a module, plus Vite's reload client. */
const DEV_SCRIPTS = '<script type="module" src="/@vite/client"></script><script type="module" src="/src/client/islands.tsx"></script>';

function asset(name: string): { body: Buffer | string; type: string } {
  if (name === "apidocs.css") return { body: readFileSync(resolve(root, "src/styles/apidocs.css"), "utf8"), type: "text/css" };
  if (name.startsWith("fonts/")) {
    const file = name.slice("fonts/".length);
    return { body: readFileSync(require.resolve(`@fontsource-variable/${file.replace(/-latin-.*$/, "")}/files/${file}`)), type: "font/woff2" };
  }
  throw new Error(`No asset ${name}`);
}

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", md: "text/markdown; charset=utf-8", txt: "text/plain; charset=utf-8",
  js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", json: "application/json",
  svg: "image/svg+xml", xml: "application/xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp",
};

function shell(): string {
  const models = ["java", "kotlin", "markdown", ...(guidesPath ? ["guides"] : []), ...(modelPath ? ["model"] : [])];
  const label = (m: string) => (m === "model" ? modelPath : m === "guides" ? `${guidesPath} (Markdown)` : m === "markdown" ? "Markdown sample suite" : `${m} sample`);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>apidocs dev</title>
<style>
  body{margin:0;font:13px/1.4 system-ui,sans-serif;background:#e9ecf1;color:#1b1f27;display:flex;flex-direction:column;height:100vh}
  .bar{display:flex;flex-wrap:wrap;gap:14px;align-items:center;padding:8px 14px;background:#1b1f27;color:#e9ecf1}
  .bar label{display:flex;gap:6px;align-items:center}
  .bar select,.bar input{font:inherit}
  .bar a{color:#9fd8e0}
  .stage{flex:1;display:flex;justify-content:center;overflow:auto;padding:12px}
  iframe{border:0;background:#fff;box-shadow:0 2px 16px rgb(0 0 0/.18);height:100%;width:100%;transition:width .15s}
</style></head><body>
<div class="bar">
  <strong>@elide/apidocs dev</strong>
  <label>Model <select id="model">${models.map(m => `<option value="${m}">${label(m)}</option>`).join("")}</select></label>
  <label>Theme <select id="preset"><option value="neutral">neutral (default)</option><option value="elide">elide</option></select></label>
  <label>Mode <select id="mode"><option value="system">system</option><option value="light">light</option><option value="dark">dark</option></select></label>
  <label>Width <select id="width"><option value="100%">full</option><option value="1440px">1440</option><option value="1180px">1180</option><option value="1024px">1024</option><option value="820px">820</option><option value="390px">390 (phone)</option></select></label>
  <label><input type="checkbox" id="nojs"> JavaScript off</label>
  <a id="direct" target="_blank">open page</a>
</div>
<div class="stage"><iframe id="frame" title="Rendered page"></iframe></div>
<script>
  const $ = id => document.getElementById(id);
  const state = Object.assign({ model: "java", preset: "neutral", mode: "system", width: "100%", page: "index.html", nojs: false },
    JSON.parse(sessionStorage.getItem("apidocs-dev") || "{}"));
  const frame = $("frame");
  const src = () => "/site/" + state.model + "/" + state.preset + "/" + state.page + (state.nojs ? "?nojs" : "");
  function save() { sessionStorage.setItem("apidocs-dev", JSON.stringify(state)); }
  function load() { frame.src = src(); $("direct").href = src(); save(); }
  function applyMode() {
    try {
      const html = frame.contentDocument.documentElement;
      if (state.mode === "system") html.removeAttribute("data-theme"); else html.setAttribute("data-theme", state.mode);
    } catch (e) {}
  }
  for (const key of ["model", "preset", "mode", "width"]) {
    $(key).value = state[key];
    $(key).addEventListener("change", () => {
      state[key] = $(key).value;
      if (key === "model") state.page = "index.html";
      if (key === "mode") { applyMode(); save(); }
      else if (key === "width") { frame.style.width = state.width; save(); }
      else load();
    });
  }
  $("nojs").checked = state.nojs;
  $("nojs").addEventListener("change", () => { state.nojs = $("nojs").checked; load(); });
  frame.style.width = state.width;
  frame.addEventListener("load", () => {
    try {
      const path = frame.contentWindow.location.pathname;
      const prefix = "/site/" + state.model + "/" + state.preset + "/";
      if (path.startsWith(prefix)) { state.page = path.slice(prefix.length); $("direct").href = src(); save(); }
    } catch (e) {}
    applyMode();
  });
  load();
</script>
</body></html>`;
}

const server = await createServer({
  root,
  configFile: false,
  appType: "custom",
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  resolve: { dedupe: ["preact"] },
  server: { port, host, strictPort: true, open: open ? "/" : false },
  plugins: [{
    name: "apidocs-dev",
    configureServer(dev) {
      if (modelPath) dev.watcher.add(modelPath);
      if (guidesPath) dev.watcher.add(guidesPath);
      const reload = (file: string) => {
        if (file === modelPath || /\/(src|samples)\//.test(file) || (guidesPath && file.startsWith(`${guidesPath}/`))) {
          cache.clear();
          dev.moduleGraph.invalidateAll();
          dev.ws.send({ type: "full-reload" });
        }
      };
      // A new or removed page changes the navigator of every page, so they reload too.
      for (const event of ["change", "add", "unlink"] as const) dev.watcher.on(event, reload);
      dev.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname === "/") {
          res.setHeader("content-type", TYPES.html!);
          res.end(shell());
          return;
        }
        const match = /^\/site\/([^/]+)\/([^/]+)\/(.*)$/.exec(url.pathname);
        if (!match) return next();
        const [, model, preset, rawPath] = match;
        const path = decodeURIComponent(rawPath || "index.html");
        try {
          const out = await site(dev, model!, preset!);
          const file = out[path];
          const copied = suiteFiles.get(`${model}/${preset}`)?.get(path);
          if (file === undefined && copied) {
            res.setHeader("content-type", TYPES[path.slice(path.lastIndexOf(".") + 1).toLowerCase()] ?? "application/octet-stream");
            res.setHeader("x-content-type-options", "nosniff");
            res.end(copied);
            return;
          }
          if (file === undefined) {
            res.statusCode = 404;
            res.end(`Not in the rendered site: ${path}`);
            return;
          }
          const ext = path.slice(path.lastIndexOf(".") + 1);
          if (typeof file === "string") {
            let body = file;
            if (ext === "html") {
              body = url.searchParams.has("nojs")
                ? body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, m => (m.includes("ld+json") ? m : ""))
                : body.replace(/<script defer src="[^"]*assets\/apidocs\.js"><\/script>/, DEV_SCRIPTS);
            }
            res.setHeader("content-type", TYPES[ext] ?? "text/plain; charset=utf-8");
            res.end(body);
          } else {
            const { body, type } = asset(file.asset);
            res.setHeader("content-type", type);
            res.end(body);
          }
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end(String((error as Error).stack ?? error));
        }
      });
    },
  }],
});
await server.listen();
console.log(`\n  @elide/apidocs dev server: http://${host}:${port}/`);
console.log(`  pages: http://${host}:${port}/site/java/neutral/index.html${modelPath ? ` (model: /site/model/elide/index.html)` : ""}\n`);
