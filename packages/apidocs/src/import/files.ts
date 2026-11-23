/**
 * Reads a Markdown suite from disk for the importer: every .md and .mdx file as text, every other file as bytes,
 * with paths relative to the suite's root. Hidden files and directories (a leading dot) and node_modules are
 * skipped, and so are symbolic links, so a suite cannot pull in files from outside its directory.
 */
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SuiteAsset, SuiteFile } from "./markdown";

export interface Suite {
  files: SuiteFile[];
  assets: SuiteAsset[];
}

/** Files larger than this are left out of the assets: a page cannot sensibly show or link to them. */
const MAX_ASSET_BYTES = 25 * 1024 * 1024;

export function readSuite(dir: string): Suite {
  const files: SuiteFile[] = [];
  const assets: SuiteAsset[] = [];
  const walk = (rel: string) => {
    for (const name of readdirSync(join(dir, rel)).sort()) {
      if (name.startsWith(".") || name === "node_modules") continue;
      // A folder's README.md is GitHub's landing page for it, not a page of the suite.
      if (/^readme\.md$/i.test(name)) continue;
      const path = rel ? `${rel}/${name}` : name;
      const stat = lstatSync(join(dir, path));
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) walk(path);
      else if (/\.mdx?$/i.test(name)) files.push({ path, text: readFileSync(join(dir, path), "utf8") });
      else if (stat.isFile() && stat.size <= MAX_ASSET_BYTES) assets.push({ path, data: readFileSync(join(dir, path)) });
    }
  };
  walk("");
  return { files, assets };
}
