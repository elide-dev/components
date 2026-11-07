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
  if (/Prism|prism-react-renderer/.test(source)) throw new Error(`${exported} unexpectedly bundles Prism`);
  console.log(`${exported}: ${source.length} bytes minified, ${gzipBytes} bytes gzip (React external).`);
}

// Code surfaces. Terminal carries the VT, shell tokenizer and recording player
// (tailwind-merge, shared by every component, is ~8.7 KB of it) but never Prism;
// CodeBlock never carries the terminal/recording runtime. Markers are strings
// that survive minification (Prism grammars' `lookbehind` key, asciicast errors).
for (const [name, exported, budget, forbidden, label] of [
  ["terminal", "Terminal", 30_000, /\blookbehind\b/, "Prism"],
  ["code-block", "CodeBlock", 48_000, /Unsupported asciicast version|eld-terminal-screen/, "the terminal recording runtime"],
  ["code-sample", "CodeSample", 25_000, /\blookbehind\b|Unsupported asciicast version/, "a code surface it does not render"],
] as const) {
  const result = await Bun.build({
    entrypoints: [`./node_modules/@elide/ui/dist/components/${name}.js`],
    target: "browser", minify: true, external: ["react", "react/jsx-runtime", "react-dom"],
  });
  if (!result.success) throw new AggregateError(result.logs, `Failed to build ${exported}`);
  const source = await result.outputs[0].text();
  const gzipBytes = gzipSync(source).byteLength;
  if (gzipBytes > budget) throw new Error(`${exported} exceeds its ${budget / 1000} KB gzip budget: ${gzipBytes}`);
  if (forbidden.test(source)) throw new Error(`${exported} unexpectedly bundles ${label}`);
  console.log(`${exported}: ${gzipBytes} bytes gzip (React external); excludes ${label}.`);
}

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
  if (bytes > 1600) throw new Error(`${locale} catalog exceeds 1.6 KB gzip: ${bytes}`);
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
