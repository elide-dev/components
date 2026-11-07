import { describe, expect, it } from "vitest";
import { getSyncHighlighter, registerLanguage } from "./highlight-registry";
import { highlightCode, preloadHighlighter, resolveLanguage, supportedLanguages, tokensToLines } from "./shiki";

describe("shiki", () => {
  it("resolves aliases and rejects unsupported languages", () => {
    expect(resolveLanguage("ts")).toBe("typescript");
    expect(resolveLanguage("KT")).toBe("kotlin");
    expect(resolveLanguage("cobol")).toBeUndefined();
  });

  it("ships only the languages Elide needs, and accepts registered ones", async () => {
    expect(supportedLanguages()).toEqual(
      expect.arrayContaining(["typescript", "python", "kotlin", "java", "pkl", "json", "yaml", "toml", "sql", "xml"]),
    );
    expect(resolveLanguage("go")).toBeUndefined();
    registerLanguage("go", () => import("shiki/langs/go.mjs"), ["golang"]);
    expect(resolveLanguage("golang")).toBe("go");
    const result = await highlightCode("package main", "golang");
    expect(result.lines[0].tokens[0]).toEqual({ text: "package", style: { className: "tk-keyword" } });
  });

  it("maps theme colors and font styles to classes", () => {
    expect(
      tokensToLines([[{ content: "x", offset: 0, color: "var(--eld-syntax-keyword)", fontStyle: 2 }, { content: " ", offset: 1 }]]),
    ).toEqual([{ tokens: [{ text: "x", style: { className: "tk-keyword tk-bold" } }, { text: " " }] }]);
  });

  it("highlights with notations, as a serializable result", async () => {
    const result = await highlightCode('const name = "elide"; // [!code ++]', "ts");
    expect(result.code).toBe('const name = "elide";');
    expect(result.decorations).toEqual([{ line: 1, kind: "add" }]);
    const classes = result.lines[0].tokens.map((token) => token.style?.className);
    expect(classes).toContain("tk-keyword");
    expect(classes).toContain("tk-string");
    // Serializable, so a build step can hand it to the client as data.
    const serialized = JSON.stringify(result);
    expect(JSON.parse(serialized)).toEqual(result);
  });

  it("registers a synchronous highlighter once languages are preloaded", async () => {
    await preloadHighlighter(["python"]);
    const lines = getSyncHighlighter()!.highlight("def f(): pass", "py");
    expect(lines?.[0].tokens.some((token) => token.style?.className === "tk-keyword")).toBe(true);
    expect(getSyncHighlighter()!.highlight("x", "rust")).toBeUndefined();
  });

  it("adds Twoslash type hovers and errors, remapped through notations", async () => {
    const code = ["// [!code highlight]", "const answer = 42;", "answer.toFixed(1);"].join("\n");
    const result = await highlightCode(code, "ts", { twoslash: true });
    expect(result.code).toBe("const answer = 42;\nanswer.toFixed(1);");
    const hover = result.inline.find((d) => d.kind === "hover" && d.line === 1 && d.start === 6);
    expect(hover?.payload).toMatch(/const answer: 42/);
    expect(result.decorations).toContainEqual({ line: 1, kind: "highlight" });
  }, 30_000);
});
