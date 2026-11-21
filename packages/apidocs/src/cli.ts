#!/usr/bin/env bun
/**
 * The apidocs command line. One command so far:
 *
 *   apidocs guides --src <suite dir> --id <suite id> --title <site title> --out <output dir>
 *                  [--theme <theme.json>] [--version <string>] [--base-url <url with trailing slash>]
 *                  [--source-link <template with {path} and {line}>] [--source-root <repo-relative suite path>]
 *                  [--link <prefix>=<target> ...] [--include-drafts] [--warn-only] [--assets <dir>]
 *
 * It imports a Markdown suite (src/import/markdown.ts), renders it as a guides-only site and writes the site into
 * --out: HTML pages and their Markdown twins, llms.txt, llms-full.txt, api.json (the guides-only model), the search
 * index, the assets and the suite's images. Diagnostics go to stderr as file:line: message, with paths as given to
 * --src. It exits 1 when there is an error (unless --warn-only), 2 on bad arguments, and prints one JSON line of
 * counts on success. It writes into --out without deleting what is already there.
 *
 * The stylesheet and fonts come from the sources; the client script from dist/assets/apidocs.js, which is built
 * first when it is missing or older than src/client. --assets takes every asset from a directory instead.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { formatDiagnostic, type LinkMapping } from "./import/markdown";
import { suiteSite } from "./import/suite";
import type { Theme } from "./theme";

const USAGE = `usage: apidocs guides --src <suite dir> --id <suite id> --title <site title> --out <output dir>
         [--theme <theme.json>] [--version <string>] [--base-url <url/>] [--source-link <template>]
         [--source-root <path>] [--link <prefix>=<target> ...] [--include-drafts] [--warn-only] [--assets <dir>]`;

const pkg = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);

class UsageError extends Error {}

interface Args {
  values: Map<string, string>;
  links: LinkMapping[];
  flags: Set<string>;
}

const VALUED = new Set(["src", "id", "title", "out", "theme", "version", "base-url", "source-link", "source-root", "assets"]);
const FLAGS = new Set(["include-drafts", "warn-only"]);

function parseArgs(argv: string[]): Args {
  const args: Args = { values: new Map(), links: [], flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const [key, inline] = arg.startsWith("--") ? (arg.includes("=") && !arg.startsWith("--link") ? [arg.slice(2, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg.slice(2), undefined]) : [arg, undefined];
    if (FLAGS.has(key)) {
      args.flags.add(key);
      continue;
    }
    if (key !== "link" && !VALUED.has(key)) throw new UsageError(`unknown argument ${arg}`);
    const value = inline ?? argv[++i];
    if (value === undefined) throw new UsageError(`${arg} needs a value`);
    if (key === "link") {
      const at = value.indexOf("=");
      if (at <= 0) throw new UsageError(`--link takes <prefix>=<target>, got ${value}`);
      args.links.push({ prefix: value.slice(0, at), target: value.slice(at + 1) });
    } else args.values.set(key, value);
  }
  for (const required of ["src", "id", "title", "out"]) if (!args.values.get(required)) throw new UsageError(`missing --${required}`);
  return args;
}

/** A path inside the output directory; refuses absolute paths and ".." segments. */
function inside(root: string, path: string): string {
  const target = normalize(join(root, path));
  if (isAbsolute(path) || path.split("/").includes("..") || !(target + sep).startsWith(resolve(root) + sep)) {
    throw new Error(`refusing to write outside the output directory: ${path}`);
  }
  return target;
}

/** The client bundle, built when it is missing or older than its sources. */
function clientBundle(): string {
  const bundle = join(pkg, "dist/assets/apidocs.js");
  const newest = Math.max(...readdirSync(join(pkg, "src/client")).map(f => statSync(join(pkg, "src/client", f)).mtimeMs));
  if (!existsSync(bundle) || statSync(bundle).mtimeMs < newest) {
    process.stderr.write("apidocs: building the client script (dist/assets/apidocs.js)\n");
    const run = spawnSync("bunx", ["vite", "build", "--config", "vite.client.config.ts"], { cwd: pkg, stdio: ["ignore", "ignore", "inherit"] });
    if (run.status !== 0) throw new Error("could not build the client script; run `bun run build` in packages/apidocs");
  }
  return bundle;
}

/** Where a renderer asset comes from: --assets, or the package's sources and its client bundle. */
function assetSource(name: string, assets: string | undefined): string {
  if (assets) return inside(assets, name);
  if (name === "apidocs.css") return join(pkg, "src/styles/apidocs.css");
  if (name === "apidocs.js") return clientBundle();
  if (name.startsWith("fonts/")) {
    const file = name.slice("fonts/".length);
    return require.resolve(`@fontsource-variable/${file.replace(/-latin-.*$/, "")}/files/${file}`);
  }
  throw new Error(`no source for the asset ${name}`);
}

function guides(argv: string[]): number {
  const args = parseArgs(argv);
  // Relative paths are the caller's: the directory a package script started in, else this process's.
  const cwd = process.env.npm_lifecycle_event && process.env.INIT_CWD ? process.env.INIT_CWD : process.cwd();
  const src = resolve(cwd, args.values.get("src")!);
  const out = resolve(cwd, args.values.get("out")!);
  if (!existsSync(src) || !statSync(src).isDirectory()) throw new UsageError(`--src ${args.values.get("src")} is not a directory`);
  const themePath = args.values.get("theme");
  const theme: Theme = themePath ? JSON.parse(readFileSync(resolve(cwd, themePath), "utf8")) : {};
  const assetsDir = args.values.get("assets") ? resolve(cwd, args.values.get("assets")!) : undefined;
  const warnOnly = args.flags.has("warn-only");
  const opt = (key: string) => args.values.get(key);

  const site = suiteSite(src, {
    id: opt("id")!,
    title: opt("title")!,
    ...(opt("version") ? { version: opt("version")! } : {}),
    theme,
    ...(opt("base-url") ? { baseUrl: opt("base-url")! } : {}),
    ...(opt("source-link") ? { sourceLink: opt("source-link")! } : {}),
    ...(opt("source-root") ? { sourceRoot: opt("source-root")! } : {}),
    ...(args.links.length ? { links: args.links } : {}),
    ...(args.flags.has("include-drafts") ? { includeDrafts: true } : {}),
  });

  const prefix = args.values.get("src")!.replace(/\/*$/, "/");
  let errors = 0;
  let warnings = 0;
  for (const d of site.diagnostics) {
    const shown = warnOnly ? { ...d, severity: "warning" as const } : d;
    if (shown.severity === "error") errors++;
    else warnings++;
    process.stderr.write(formatDiagnostic(shown, prefix) + "\n");
  }
  if (errors) {
    process.stderr.write(`apidocs: ${errors} error${errors === 1 ? "" : "s"}; nothing written (--warn-only writes anyway)\n`);
    return 1;
  }

  let count = 0;
  let bytes = 0;
  for (const [path, content] of Object.entries(site.output)) {
    const target = inside(out, path);
    mkdirSync(dirname(target), { recursive: true });
    if (typeof content === "string") {
      writeFileSync(target, content);
      bytes += Buffer.byteLength(content);
    } else {
      copyFileSync(assetSource(content.asset, assetsDir), target);
      bytes += statSync(target).size;
    }
    count++;
  }
  for (const file of site.copies) {
    const target = inside(out, file.to);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(inside(src, file.from), target);
    bytes += statSync(target).size;
    count++;
  }
  const pages = Object.keys(site.output).filter(p => p.endsWith(".html")).length;
  process.stdout.write(JSON.stringify({ files: count, bytes, pages, guides: site.model.module.guides?.length ?? 0, drafts: site.result.drafts.length, errors: 0, warnings }) + "\n");
  return 0;
}

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  try {
    if (command === "guides") return guides(rest);
    if (command === "--help" || command === "-h" || command === "help") {
      process.stdout.write(USAGE + "\n");
      return 0;
    }
    throw new UsageError(command ? `unknown command ${command}` : "no command");
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`apidocs: ${error.message}\n${USAGE}\n`);
      return 2;
    }
    process.stderr.write(`apidocs: ${(error as Error).message ?? error}\n`);
    return 1;
  }
}

process.exit(main(process.argv.slice(2)));
