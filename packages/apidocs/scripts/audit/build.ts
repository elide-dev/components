/**
 * Builds a site exactly as the doclet does (dist/runner.mjs running
 * dist/render.js), and picks the pages the audits read closely.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { RepresentativePages } from "./types";

export const packageRoot = fileURLToPath(new URL("../..", import.meta.url));

/** Runs `bun run build` in the package. Retries once, since another editor may be mid-change. */
export function buildDist(): void {
  for (let attempt = 1; ; attempt++) {
    const run = spawnSync("bun", ["run", "build"], { cwd: packageRoot, encoding: "utf8" });
    if (run.status === 0) return;
    if (attempt >= 3) throw new Error(`bun run build failed:\n${(run.stdout + run.stderr).slice(-4000)}`);
    console.error(`  build failed (attempt ${attempt}); retrying in 10 s, in case a file is mid-edit`);
    Bun.sleepSync(10_000);
  }
}

export interface BuildInput {
  /** A model as JSON text, or the path of one. */
  model: { json: string } | { path: string };
  theme: Record<string, unknown>;
  out: string;
  work: string;
}

/** Renders a model into out/ with the runner. Returns the runner's stats. */
export function renderSite(input: BuildInput): { files: number; bytes: number; renderMs: number } {
  mkdirSync(input.work, { recursive: true });
  const model = "path" in input.model ? input.model.path : join(input.work, "model.json");
  if ("json" in input.model) writeFileSync(model, input.model.json);
  const theme = join(input.work, "theme.json");
  writeFileSync(theme, JSON.stringify(input.theme));
  rmSync(input.out, { recursive: true, force: true });
  const run = spawnSync(process.execPath, [
    join(packageRoot, "dist/runner.mjs"), "--bundle", join(packageRoot, "dist/render.js"), "--assets", join(packageRoot, "dist/assets"),
    "--model", model, "--theme", theme, "--out", input.out,
  ], { encoding: "utf8", maxBuffer: 64 << 20 });
  if (run.status !== 0) throw new Error(`runner failed:\n${run.stderr}`);
  return JSON.parse(run.stdout);
}

/** Every file under dir, as paths relative to it. */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const path = join(d, entry.name);
      if (entry.isDirectory()) walk(path);
      else out.push(relative(dir, path));
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * The module overview, the package page with the most types, the smallest and
 * the largest type page by HTML size, and every page. `prefer` names a page
 * to use as the largest type page when it exists (dev/elide/kotlin/api/Ir.html
 * for the Komodo model).
 */
export function representativePages(dir: string, prefer?: string): RepresentativePages {
  const html = listFiles(dir).filter(f => f.endsWith(".html") && !f.startsWith("assets/") && f !== "404.html");
  const packages = html.filter(f => f.endsWith("/index.html"));
  const types = html.filter(f => !f.endsWith("index.html"));
  const size = (f: string) => statSync(join(dir, f)).size;
  const typeCount = (pkgPage: string) => {
    const prefix = pkgPage.slice(0, -"index.html".length);
    return types.filter(t => t.startsWith(prefix) && !t.slice(prefix.length).includes("/")).length;
  };
  const bySize = [...types].sort((a, b) => size(a) - size(b));
  const pkg = [...packages].sort((a, b) => typeCount(b) - typeCount(a))[0] ?? "index.html";
  const largest = prefer && types.includes(prefer) ? prefer : bySize.at(-1) ?? "index.html";
  // The smallest type page that still documents something: skip pages under 2 KB of text (empty annotation types).
  const small = bySize.find(f => readFileSync(join(dir, f), "utf8").length > 4000) ?? bySize[0] ?? "index.html";
  return { overview: "index.html", package: pkg, smallType: small, largestType: largest, all: html };
}
