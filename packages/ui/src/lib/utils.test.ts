import { describe, it, expect } from "vitest";
import { cn, keyed } from "./utils";

describe("cn", () => {
  it("merges conditional classes, dropping falsy ones", () => {
    const active: boolean = [].length > 0;
    expect(cn("a", active && "b", null, undefined, "c")).toBe("a c");
  });

  it("lets tailwind-merge resolve conflicting utilities (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });
});

describe("keyed", () => {
  it("returns content-derived keys via the base function", () => {
    const result = keyed(["a", "b", "c"], (x) => x);
    expect(result).toEqual([
      { item: "a", key: "a" },
      { item: "b", key: "b" },
      { item: "c", key: "c" },
    ]);
  });

  it("suffixes duplicate bases with an occurrence counter so keys stay unique", () => {
    const result = keyed(["dup", "dup", "dup"], (x) => x);
    expect(result.map((r) => r.key)).toEqual(["dup", "dup~1", "dup~2"]);
    // Still unique.
    expect(new Set(result.map((r) => r.key)).size).toBe(3);
  });

  it("keeps keys stable across a reorder of distinct items", () => {
    const base = (x: string) => x;
    const forward = keyed(["a", "b", "c"], base);
    const reordered = keyed(["c", "a", "b"], base);
    const keyFor = (rs: { item: string; key: string }[], item: string) =>
      rs.find((r) => r.item === item)!.key;
    for (const item of ["a", "b", "c"]) {
      expect(keyFor(reordered, item)).toBe(keyFor(forward, item));
    }
  });

  it("returns an empty array for an empty input", () => {
    expect(keyed([], (x) => String(x))).toEqual([]);
  });
});
