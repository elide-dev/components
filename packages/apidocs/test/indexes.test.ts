import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { samples } from "../samples";
import { compareNames } from "../src/index-data";
import type { Model } from "../src/model";
import { render } from "../src/render";
import { buildSite, DEPRECATED_PAGE, INDEX_ALL_PAGE, indexPages, PACKAGES_PAGE, TYPES_PAGE } from "../src/site";
import { checkSite } from "./check";

const fixture: Model = JSON.parse(readFileSync(new URL("fixtures/fixture-java.api.json", import.meta.url), "utf8"));
const PAGES = [PACKAGES_PAGE, TYPES_PAGE, INDEX_ALL_PAGE, DEPRECATED_PAGE];
const allowed = (model: Model) => [...(model.externals ?? []).map(e => e.url.split("{")[0]!), "https://example.com/", "https://en.wikipedia.org/", "https://kotlinlang.org/", "https://schema.org"];

describe("index pages", () => {
  for (const [name, model] of Object.entries(samples)) {
    const site = render(model, { extends: "elide" });
    test(`${name}: every index page and its Markdown twin`, () => {
      for (const page of PAGES) {
        expect(site[`${page}.html`]).toBeString();
        expect(site[`${page}.md`]).toBeString();
      }
      expect(indexPages(buildSite(model)).map(p => p.page)).toEqual(PAGES);
      expect(site["llms.txt"] as string).toContain("## Indexes");
    });
    test(`${name}: links resolve and the output stays portable`, () => {
      // Scoped to the index pages' own links: the page shell's skip link is checked with the shell's tests.
      const errors = checkSite(site, { allowed: allowed(model) }).filter(e => PAGES.some(p => e.startsWith(`${p}.html:`)) && !e.endsWith('"#content"'));
      expect(errors).toEqual([]);
    });
    test(`${name}: letters are sorted, each group links from the letter bar`, () => {
      const html = site[`${INDEX_ALL_PAGE}.html`] as string;
      const letters = [...html.matchAll(/<section id="index-([A-Z]|other)" class="section index-letter"/g)].map(m => m[1]!);
      const sorted = [...letters].sort((a, b) => (a === "other" ? 1 : b === "other" ? -1 : compareNames(a, b)));
      expect(letters).toEqual(sorted);
      for (const letter of letters) expect(html).toContain(`index-all.html#index-${letter}"`);
    });
  }
  test("overloads are listed separately by their parameter types", () => {
    const md = render(samples.java)[`${INDEX_ALL_PAGE}.md`] as string;
    expect(md).toContain("`area(Circle)`");
    expect(md).toContain("`area(Polygon)`");
  });
  test("deprecated: for removal first, with the deprecation text", () => {
    const md = render(samples.java)[`${DEPRECATED_PAGE}.md`] as string;
    const members = md.slice(md.indexOf("## Members"));
    expect(members.indexOf("for removal")).toBeLessThan(members.indexOf("(deprecated)"));
    expect(md).toContain("total(Shape...)");
  });
  test("guides come first on the A-Z page when the model has any", () => {
    const html = render(samples.java)[`${INDEX_ALL_PAGE}.html`] as string;
    if (samples.java.module.guides?.length) expect(html.indexOf('id="index-guides"')).toBeLessThan(html.indexOf('class="section index-letter"', html.indexOf('id="index-guides"') + 1));
  });
  test("a page without content is not written", () => {
    const clean = structuredClone(fixture);
    for (const pkg of clean.packages ?? []) {
      delete pkg.deprecated;
      for (const type of pkg.types ?? []) {
        delete type.deprecated;
        for (const member of type.members ?? []) delete member.deprecated;
      }
    }
    const site = render(clean);
    expect(site[`${DEPRECATED_PAGE}.html`]).toBeUndefined();
    expect(site[`${DEPRECATED_PAGE}.md`]).toBeUndefined();
    expect(site[`${PACKAGES_PAGE}.html`]).toBeString();
    const empty = render({ schema: "apidocs/1", module: { name: "empty" } });
    for (const page of PAGES) expect(empty[`${page}.html`]).toBeUndefined();
  });
  test("Markdown snapshots of the fixture's index pages", () => {
    const site = render(fixture);
    for (const page of PAGES) expect(site[`${page}.md`]).toMatchSnapshot(`${page}.md`);
  });
});
