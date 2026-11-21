import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { samples } from "../samples";
import type { Model } from "../src/model";
import { render } from "../src/render";

const fixture: Model = JSON.parse(readFileSync(new URL("fixtures/fixture-java.api.json", import.meta.url), "utf8"));

test("Markdown snapshots of the fixture", () => {
  const out = render(fixture);
  for (const page of ["fixture/java/Geometry.md", "fixture/java/Circle.md", "fixture/java/io/ShapeReader.md", "index.md", "llms.txt"]) {
    expect(out[page]).toMatchSnapshot(page);
  }
});

test("Markdown sections come in a fixed order", () => {
  const md = render(samples.java)["com/example/geo/Shapes.md"] as string;
  const parse = md.slice(md.indexOf("### parse(String)"), md.indexOf("### sum("));
  const order = ["```java", "Parses a shape", "**Parameters**", "**Returns**", "**Throws**", "> **API note**", "> **Implementation note**", "**See also**"];
  const at = order.map(marker => parse.indexOf(marker));
  expect(at.every(i => i >= 0)).toBe(true);
  expect([...at].sort((a, b) => a - b)).toEqual(at);
});

test("Kotlin features in Markdown: receivers, default arguments, type aliases", () => {
  const md = render(samples.kotlin)["org/example/kgeo/index.md"] as string;
  expect(md).toContain("### Shape.scaled(Double)");
  expect(md).toContain("**Receiver** ");
  expect(md).toContain("`by` [`Double`]");
  expect(md).toContain("= `1.0`");
  expect(md).toContain("## Type aliases");
});
