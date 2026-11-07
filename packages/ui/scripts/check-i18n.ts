import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import ts from "@typescript/typescript6";
import { supportedLocales } from "../src/i18n/locales";
import en from "../src/i18n/locales/en.json";

const root = new URL("../src/", import.meta.url);
const keys = (object: object) => Object.keys(object).sort();
const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
const catalogs = readdirSync(new URL("i18n/locales", root)).filter(name => name.endsWith(".json"));
assert.deepEqual(catalogs.sort(), supportedLocales.map(locale => `${locale}.json`).sort());
for (const locale of supportedLocales) {
  const catalog = JSON.parse(readFileSync(new URL(`i18n/locales/${locale}.json`, root), "utf8"));
  assert.deepEqual(keys(catalog), keys(en), `${locale}: message groups differ`);
  for (const [group, messages] of Object.entries(en)) {
    assert.deepEqual(keys(catalog[group]), keys(messages), `${locale}.${group}: keys differ`);
    for (const [key, original] of Object.entries(messages)) {
      const value = catalog[group][key];
      const id = `${locale}.${group}.${key}`;
      assert.equal(typeof value, "string", id);
      assert.ok(value.trim(), `${id}: empty translation`);
      assert.equal(value, value.normalize("NFC"), `${id}: use NFC Unicode`);
      assert.ok(!/[\u202a-\u202e\u2066-\u2069]/u.test(value), `${id}: bidi controls belong in interpolation, not catalogs`);
      assert.deepEqual(placeholders(value), placeholders(original), `${id}: interpolation mismatch`);
    }
  }
}

// Catch new visible JSX text and static accessible labels at their source.
// Brand names and conventional keyboard legends deliberately stay untranslated.
const exceptions = new Set(["Elide", "esc", "⌘K", "utf-8 ·"]);
for (const name of readdirSync(new URL("components", root))) {
  if (!name.endsWith(".tsx") || name.includes(".test.")) continue;
  const path = fileURLToPath(new URL(`components/${name}`, root));
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node: ts.Node) {
    let text: string | undefined;
    if (ts.isJsxText(node)) text = node.text.trim();
    if (ts.isJsxAttribute(node) && /^(aria-label|title|placeholder|alt)$/.test(node.name.getText(source))
      && node.initializer && ts.isStringLiteral(node.initializer)) text = node.initializer.text;
    if ((ts.isPropertyAssignment(node) || ts.isBindingElement(node))
      && /^(label|title|placeholder|emptyMessage|closeLabel|caption)$/.test(node.name.getText(source))
      && node.initializer && ts.isStringLiteral(node.initializer)) text = node.initializer.text;
    if (text && /\p{L}/u.test(text) && !exceptions.has(text)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      throw new Error(`${name}:${line + 1}: move UI text into the message catalog: ${text}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
console.log(`i18n: ${supportedLocales.length} complete catalogs; placeholders, Unicode and component literals verified.`);
