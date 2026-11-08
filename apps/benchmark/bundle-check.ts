import { gzipSync } from "node:zlib";

// React remains a peer dependency. Guard leaf imports against heavyweight
// overlays or syntax highlighting accidentally entering their dependency graph.
for (const [name, exported] of [["button", "Button"], ["copy-command", "CopyCommand"]]) {
  const result = await Bun.build({
    entrypoints: [`./node_modules/@elide/ui/dist/components/${name}.js`],
    target: "browser", minify: true, external: ["react", "react/jsx-runtime", "react-dom"],
  });
  if (!result.success) throw new AggregateError(result.logs, `Failed to build ${exported}`);
  const source = await result.outputs[0].text();
  const gzipBytes = gzipSync(source).byteLength;
  if (gzipBytes > 14_000) throw new Error(`${exported} exceeds the 14 KB gzip budget: ${gzipBytes}`);
  if (/codeToTokensBase/.test(source)) throw new Error(`${exported} unexpectedly bundles Shiki`);
  console.log(`${exported}: ${source.length} bytes minified, ${gzipBytes} bytes gzip (React external).`);
}

// Code surfaces, built with code splitting as a consumer's bundler would, so
// lazy imports stay lazy. Budgets cover each entry chunk (gzip, React external).
// Markers survive minification: Shiki's `codeToTokensBase`, asciicast errors,
// the TypeScript compiler's path.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const splitDir = mkdtempSync(join(tmpdir(), "elide-bundle-"));
try {
  for (const [name, exported, budget, forbidden, label] of [
    ["code-block", "CodeBlock", 24_000, /codeToTokensBase|Unsupported asciicast version/, "Shiki or the terminal runtime (Shiki loads lazily)"],
    // 31.5 KB: fixed-cell playback, sparse-row reuse and lifecycle fixes.
    // Measured 31,431 B; the 400 B allowance buys tested playback CPU savings.
    ["terminal", "Terminal", 31_500, /codeToTokensBase/, "Shiki"],
    ["code-sample", "CodeSample", 25_000, /codeToTokensBase|Unsupported asciicast version/, "a code surface it does not render"],
    ["code-group", "CodeGroup", 25_000, /codeToTokensBase|Unsupported asciicast version/, "a code surface it does not render"],
    ["shiki", "Shiki runtime (lazy)", 64_000, /typescript\/lib/, "the TypeScript compiler (Twoslash stays a build-time peer)"],
  ] as const) {
    const outdir = join(splitDir, name);
    const result = await Bun.build({
      entrypoints: [`./node_modules/@elide/ui/dist/components/${name}.js`],
      target: "browser", minify: true, splitting: true, outdir,
      external: ["react", "react/jsx-runtime", "react-dom"],
    });
    if (!result.success) throw new AggregateError(result.logs, `Failed to build ${exported}`);
    const entry = result.outputs.find(output => output.kind === "entry-point")!;
    if (name === "shiki") {
      // Every lazy chunk a consumer's bundler emits for the built-in grammars.
      const lazy = result.outputs.filter(output => output !== entry).reduce((sum, output) => sum + gzipSync(readFileSync(output.path)).byteLength, 0);
      if (lazy > 130_000) throw new Error(`Built-in Shiki grammars exceed their 130 KB gzip budget: ${lazy}`);
      console.log(`Shiki grammars (lazy, all built-in): ${lazy} bytes gzip across ${result.outputs.length - 1} chunks.`);
    }
    const source = readFileSync(entry.path, "utf8");
    // The entry plus the chunks it imports statically (not lazily).
    const statics = [...source.matchAll(/(?:^|[;}])\s*import\s*(?:[^"';]*from\s*)?"(\.\/chunk-[\w-]+\.js)"/g)].map(match => readFileSync(join(outdir, match[1]), "utf8"));
    const eager = [source, ...statics].join("\n");
    const gzipBytes = gzipSync(eager).byteLength;
    if (gzipBytes > budget) throw new Error(`${exported} exceeds its ${budget / 1000} KB gzip budget: ${gzipBytes}`);
    if (forbidden.test(eager)) throw new Error(`${exported} unexpectedly bundles ${label}`);
    console.log(`${exported}: ${gzipBytes} bytes gzip eager (React external); excludes ${label}.`);
  }
} finally { rmSync(splitDir, { recursive: true, force: true }); }

// Catalogs are data-only ESM. A single locale must never pull React, other
// languages, or a runtime message compiler into a consumer's bundle.
const { supportedLocales } = await import("@elide/ui/i18n/locales");
for (const locale of supportedLocales) {
  const result = await Bun.build({
    entrypoints: [`./node_modules/@elide/ui/dist/i18n/locales/${locale}.js`],
    target: "browser", minify: true,
  });
  if (!result.success) throw new AggregateError(result.logs, `Failed to bundle ${locale}`);
  const source = await result.outputs[0].text();
  const bytes = gzipSync(source).byteLength;
  // 2 KB: catalogs now carry the code surfaces' strings (terminal, recordings,
  // scenes, decorations); Cyrillic compresses least (ru ≈ 1.7 KB).
  if (bytes > 2000) throw new Error(`${locale} catalog exceeds 2 KB gzip: ${bytes}`);
  if (/createContext|react|createElement/.test(source)) throw new Error(`${locale} imports UI runtime code`);
  console.log(`Locale ${locale}: ${bytes} bytes gzip, no runtime dependencies.`);
}

// Bundle a real consumer to prove an unused locale does not enter its graph.
const entry = new URL("./.locale-bundle-check.ts", import.meta.url);
try {
  await Bun.write(entry, 'export { I18nProvider } from "@elide/ui/i18n"; export { default as messages } from "@elide/ui/locales/he";');
  const result = await Bun.build({ entrypoints: [entry.pathname], target: "browser", minify: true,
    external: ["react", "react/jsx-runtime", "react-dom"] });
  if (!result.success) throw new AggregateError(result.logs, "Failed to bundle localized consumer");
  const source = await result.outputs[0].text();
  for (const other of ["zh-Hans", "zh-Hant", "ja", "ko", "fr"]) {
    const { default: messages } = await import(`@elide/ui/locales/${other}`);
    // Bun can emit Unicode literally or escaped; check both spellings.
    const label = messages.commandPalette.empty;
    const escaped = [...label].map(char => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`).join("");
    if (source.includes(label) || source.includes(escaped)) throw new Error(`Hebrew consumer also bundles ${other}`);
  }
  const bytes = gzipSync(source).byteLength;
  if (bytes > 6500) throw new Error(`Localized provider exceeds 6.5 KB gzip: ${bytes}`);
  console.log(`Hebrew provider + catalog: ${bytes} bytes gzip; unrelated catalogs excluded.`);
} finally { await Bun.file(entry).delete(); }
