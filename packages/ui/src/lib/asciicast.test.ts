import { describe, expect, it } from "vitest";
import { lineText } from "./code-model";
import {
  AsciicastError,
  CastRenderer,
  frameAt,
  normalizeCast,
  parseAsciicast,
  synthesizeCast,
  type Cast,
} from "./asciicast";

const v2 = [
  JSON.stringify({ version: 2, width: 20, height: 3, idle_time_limit: 1, title: "demo" }),
  JSON.stringify([0.5, "o", "$ elide run app.ts\r\n"]),
  JSON.stringify([0.5, "m", "run"]),
  JSON.stringify([1.2, "o", "Hello"]),
  JSON.stringify([4.2, "o", " from Elide!\r\n"]),
  JSON.stringify([4.3, "r", "30x4"]),
].join("\n");

const v3 = [
  JSON.stringify({ version: 3, term: { cols: 10, rows: 2, theme: { fg: "#fff", bg: "#000", palette: "#000:#f00" } } }),
  "# a comment line",
  JSON.stringify([0.25, "o", "a"]),
  JSON.stringify([0.25, "i", "x"]),
  JSON.stringify([1, "o", "b"]),
  JSON.stringify([0.5, "x", "0"]),
].join("\n");

/** Screen text at `time`; trailing blanks (incl. the cursor cell) trimmed. */
const textAt = (cast: Cast, time: number) => frameAt(cast, time).lines.map((line) => lineText(line).trimEnd());

describe("parseAsciicast", () => {
  it("parses v2 with absolute timestamps, markers and resizes", () => {
    const cast = parseAsciicast(v2);
    expect(cast).toMatchObject({ version: 2, cols: 20, rows: 3, idleTimeLimit: 1, title: "demo", duration: 4.3 });
    expect(cast.markers).toEqual([{ time: 0.5, label: "run" }]);
    expect(cast.events.map((event) => event.kind)).toEqual(["o", "m", "o", "o", "r"]);
  });

  it("parses v3 with relative intervals, comments and theme", () => {
    const cast = parseAsciicast(v3);
    expect(cast).toMatchObject({ version: 3, cols: 10, rows: 2 });
    expect(cast.events.map((event) => event.time)).toEqual([0.25, 0.5, 1.5, 2]);
    expect(cast.theme).toEqual({ foreground: "#fff", background: "#000", palette: ["#000", "#f00"] });
  });

  it("parses v1 documents and objects", () => {
    const doc = { version: 1, width: 8, height: 2, stdout: [[0.5, "hi"], [0.25, "!"]] };
    expect(parseAsciicast(JSON.stringify(doc)).events.map((event) => event.time)).toEqual([0.5, 0.75]);
    expect(parseAsciicast(doc).cols).toBe(8);
  });

  it("strips a BOM and rejects invalid input", () => {
    expect(parseAsciicast(`\uFEFF${v2}`).version).toBe(2);
    expect(() => parseAsciicast(JSON.stringify({ version: 9 }))).toThrow(AsciicastError);
    expect(() => parseAsciicast("{not json")).toThrow(AsciicastError);
  });
});

describe("normalizeCast", () => {
  it("caps idle gaps at the header's limit", () => {
    const cast = normalizeCast(parseAsciicast(v2));
    expect(cast.events.map((event) => event.time)).toEqual([0.5, 0.5, 1.2, 2.2, 2.3]);
    expect(cast.duration).toBeCloseTo(2.3);
    expect(cast.markers[0].time).toBe(0.5);
  });

  it("trims leading silence", () => {
    const cast = normalizeCast(parseAsciicast(v2), { trimStart: true, idleTimeLimit: 10 });
    expect(cast.events[0].time).toBe(0);
    expect(cast.duration).toBeCloseTo(3.8);
  });
});

describe("CastRenderer", () => {
  it("renders the screen at any time, including resize events", () => {
    const cast = parseAsciicast(v2);
    expect(textAt(cast, 0)).toEqual(["", "", ""]);
    expect(textAt(cast, 1.5)).toEqual(["$ elide run app.ts", "Hello", ""]);
    expect(textAt(cast, 99)).toEqual(["$ elide run app.ts", "Hello from Elide!", "", ""]);
  });

  it("seeks backwards via keyframes and matches a linear replay", () => {
    const events = Array.from({ length: 200 }, (_, i) => [i * 0.1, "o", `${i}\r\n`]);
    const text = [JSON.stringify({ version: 2, width: 10, height: 5 }), ...events.map((e) => JSON.stringify(e))].join("\n");
    const cast = parseAsciicast(text);
    const renderer = new CastRenderer(cast);
    renderer.screen(cast.duration); // records keyframes along the way
    for (const time of [15.05, 3.3, 0, 9.99, 19.9]) {
      expect(renderer.screen(time).lines.map((line) => lineText(line).trimEnd())).toEqual(textAt(cast, time));
    }
  });
});

describe("synthesizeCast", () => {
  const lines = [
    { kind: "command" as const, text: "elide run app.ts" },
    { kind: "output" as const, text: "\x1b[32mHello\x1b[0m from Elide!" },
    { kind: "command" as const, text: "elide install \\" },
    { kind: "command" as const, text: "--frozen", continuation: true },
    { kind: "comment" as const, text: "# done" },
  ];

  it("types commands after a prompt, prints output, and marks each command", () => {
    const cast = synthesizeCast(lines, { prompt: "$ " });
    expect(cast.markers.map((marker) => marker.label)).toEqual(["elide run app.ts", "elide install \\"]);
    expect(textAt(cast, cast.duration)).toEqual([
      "$ elide run app.ts",
      "Hello from Elide!",
      "$ elide install \\",
      "> --frozen",
      "# done",
      "$",
    ]);
    // Mid-typing, the command is partially visible.
    const typing = textAt(cast, cast.markers[0].time + 0.8)[0];
    expect(typing.startsWith("$ e")).toBe(true);
    expect(typing.length).toBeLessThan("$ elide run app.ts".length);
  });

  it("is deterministic for a seed and varies across seeds", () => {
    const a = synthesizeCast(lines, { seed: 7 });
    expect(synthesizeCast(lines, { seed: 7 }).events).toEqual(a.events);
    expect(synthesizeCast(lines, { seed: 8 }).duration).not.toBe(a.duration);
  });
});
