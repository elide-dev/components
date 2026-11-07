import { describe, expect, it } from "vitest";
import { commandText, parseTranscript, transcriptText } from "./terminal-transcript";

describe("parseTranscript", () => {
  it("splits prompts, output and comments", () => {
    expect(parseTranscript("# build it\n$ elide build\nok\n\n❯ elide run app.ts\nHello")).toEqual([
      { kind: "comment", text: "# build it" },
      { kind: "command", text: "elide build" },
      { kind: "output", text: "ok" },
      { kind: "output", text: "" },
      { kind: "command", text: "elide run app.ts" },
      { kind: "output", text: "Hello" },
    ]);
  });

  it("treats a prompt-less sample as a command listing", () => {
    expect(parseTranscript("elide install\n# then\nelide build\n")).toEqual([
      { kind: "command", text: "elide install" },
      { kind: "comment", text: "# then" },
      { kind: "command", text: "elide build" },
    ]);
  });

  it("follows backslash continuations", () => {
    expect(parseTranscript("$ elide run \\\n  --flag \\\n  app.ts\ndone")).toEqual([
      { kind: "command", text: "elide run \\" },
      { kind: "command", text: "  --flag \\", continuation: true },
      { kind: "command", text: "  app.ts", continuation: true },
      { kind: "output", text: "done" },
    ]);
  });

  it("keeps `#` lines that directly follow output as output", () => {
    expect(parseTranscript("$ cat README.md\n# Elide\nFast polyglot runtime\n\n# next step\n$ ls")).toEqual([
      { kind: "command", text: "cat README.md" },
      { kind: "output", text: "# Elide" },
      { kind: "output", text: "Fast polyglot runtime" },
      { kind: "output", text: "" },
      { kind: "comment", text: "# next step" },
      { kind: "command", text: "ls" },
    ]);
  });

  it("honors explicit modes and custom prompts", () => {
    expect(parseTranscript("$ not a command", { mode: "output" })).toEqual([{ kind: "output", text: "$ not a command" }]);
    expect(parseTranscript("PS> dir\nfile", { prompts: ["PS>"] })).toEqual([
      { kind: "command", text: "dir" },
      { kind: "output", text: "file" },
    ]);
    // A bare glyph without a following space is still a (blank) prompt.
    expect(parseTranscript("$")).toEqual([{ kind: "command", text: "" }]);
    // "$5" is not a prompt.
    expect(parseTranscript("$ a\n$5 off")[1]).toEqual({ kind: "output", text: "$5 off" });
  });
});

describe("commandText / transcriptText", () => {
  const lines = parseTranscript("$ elide run \\\n  app.ts\n\x1b[32mok\x1b[0m");

  it("copies only commands, keeping continuations", () => {
    expect(commandText(lines)).toBe("elide run \\\n  app.ts");
  });

  it("renders a plain transcript with prompts and no escape codes", () => {
    expect(transcriptText(lines)).toBe("$ elide run \\\n>   app.ts\nok");
  });
});
