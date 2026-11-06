import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { supportedLocales } from "../src/i18n/locales";

for (const locale of supportedLocales) {
  const base = fileURLToPath(new URL(`../src/i18n/locales/${locale}`, import.meta.url));
  const source = JSON.parse(readFileSync(`${base}.json`, "utf8"));
  const generated = `// Generated from ${locale}.json. Run bun run i18n:generate; do not edit.\n`
    + (locale === "en" ? "" : 'import type { Messages } from "../messages";\n')
    + `const messages${locale === "en" ? "" : ": Messages"} = ${JSON.stringify(source, null, 2)}${locale === "en" ? " as const" : ""};\nexport default messages;\n`;
  const target = `${base}.ts`;
  if (process.argv.includes("--write")) writeFileSync(target, generated);
  else if (readFileSync(target, "utf8") !== generated) throw new Error(`${locale}: generated catalog is stale; run bun run i18n:generate`);
}
