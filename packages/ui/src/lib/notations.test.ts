import { describe, expect, it } from "vitest";
import { parseLineRanges, parseNotations } from "./notations";

describe("parseNotations", () => {
  it("strips markers and maps them to decorations", () => {
    const result = parseNotations("a // [!code ++]\nb # [!code --]\nc /* [!code hl] */\nd <!-- [!code error] -->\ne -- [!code warning]");
    expect(result.code).toBe("a\nb\nc\nd\ne");
    expect(result.decorations).toEqual([
      { line: 1, kind: "add" },
      { line: 2, kind: "remove" },
      { line: 3, kind: "highlight" },
      { line: 4, kind: "error" },
      { line: 5, kind: "warning" },
    ]);
  });

  it("applies marker-only lines to the following lines, with counts", () => {
    const result = parseNotations("// [!code focus:2]\nx\ny\nz");
    expect(result.code).toBe("x\ny\nz");
    expect(result.decorations).toEqual([{ line: { start: 1, end: 2 }, kind: "focus" }]);
    expect(result.lineMap(1)).toBeUndefined();
    expect(result.lineMap(2)).toBe(1);
  });

  it("marks words", () => {
    const result = parseNotations("// [!code word:db]\nconst db = open(db);");
    expect(result.inline).toEqual([
      { line: 1, start: 6, end: 8, kind: "mark" },
      { line: 1, start: 16, end: 18, kind: "mark" },
    ]);
  });

  it("leaves ordinary comments alone", () => {
    expect(parseNotations("a // a comment [code]").code).toBe("a // a comment [code]");
  });
});

describe("parseLineRanges", () => {
  it("parses meta strings", () => {
    expect(parseLineRanges("{1,3-5}")).toEqual([1, 3, 4, 5]);
    expect(parseLineRanges([2, 4])).toEqual([2, 4]);
    expect(parseLineRanges(undefined)).toEqual([]);
  });
});
