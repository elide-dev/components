import { describe, expect, it } from "vitest";
import { tokenizeShell } from "./shell-tokens";

/** [text, kind] pairs, whitespace dropped, for readable assertions. */
const kinds = (line: string, options?: Parameters<typeof tokenizeShell>[1]) =>
  tokenizeShell(line, options)
    .filter((token) => token.text.trim())
    .map((token) => [token.text.trim(), token.style?.className?.replace("sh-", "") ?? "arg"]);

describe("tokenizeShell", () => {
  it("never loses text", () => {
    const line = `sudo FOO=bar npm install -g --save-dev @elide/ui > out.log 2>&1 | grep -v "warn $USER" && elide run app.ts; ./build.sh $(git rev-parse HEAD) ~/app/*.ts # done`;
    expect(tokenizeShell(line).map((token) => token.text).join("")).toBe(line);
  });

  it("finds the command in every pipeline segment, after precommands and assignments", () => {
    expect(kinds("sudo FOO=bar npm install -g --save-dev @elide/ui")).toEqual([
      ["sudo", "precommand"],
      ["FOO", "assignment"],
      ["=", "operator"],
      ["bar", "arg"],
      ["npm", "command"],
      ["install", "subcommand"],
      ["-g", "flag"],
      ["--save-dev", "flag"],
      ["@elide/ui", "path"],
    ]);
    expect(kinds("cat a.txt | grep -v warn && elide run app.ts; ls")).toEqual([
      ["cat", "command"],
      ["a.txt", "path"],
      ["|", "operator"],
      ["grep", "command"],
      ["-v", "flag"],
      ["warn", "arg"],
      ["&&", "operator"],
      ["elide", "command"],
      ["run", "subcommand"],
      ["app.ts", "path"],
      [";", "operator"],
      ["ls", "command"],
    ]);
  });

  it("splits flags with values, redirects and their targets", () => {
    expect(kinds("elide build --out-dir=dist/ > build.log 2>&1")).toEqual([
      ["elide", "command"],
      ["build", "subcommand"],
      ["--out-dir", "flag"],
      ["=", "operator"],
      ["dist/", "path"],
      [">", "redirect"],
      ["build.log", "path"],
      ["2>&1", "redirect"],
    ]);
  });

  it("starts a new command after a descriptor duplication and an operator", () => {
    expect(kinds("make 2>&1 && echo ok")).toEqual([
      ["make", "command"],
      ["2>&1", "redirect"],
      ["&&", "operator"],
      ["echo", "builtin"],
      ["ok", "arg"],
    ]);
  });

  it("highlights strings, variables inside double quotes, and globs", () => {
    expect(kinds(`echo "hi $USER" 'raw $X' ~/app/*.ts \${HOME}`)).toEqual([
      ["echo", "builtin"],
      ['"hi', "string"],
      ["$USER", "variable"],
      ['"', "string"],
      ["'raw $X'", "string"],
      ["~/app/*.ts", "glob"],
      ["${HOME}", "variable"],
    ]);
  });

  it("treats command substitutions as new commands", () => {
    expect(kinds("echo $(git rev-parse HEAD) `date`")).toEqual([
      ["echo", "builtin"],
      ["$(", "substitution"],
      ["git", "command"],
      ["rev-parse", "subcommand"],
      ["HEAD", "arg"],
      [")", "substitution"],
      ["`", "substitution"],
      ["date", "command"],
      ["`", "substitution"],
    ]);
  });

  it("handles keywords, comments, continuations and continuation lines", () => {
    expect(kinds("if test -f x; then make; fi # build")).toEqual([
      ["if", "keyword"],
      ["test", "builtin"],
      ["-f", "flag"],
      ["x", "arg"],
      [";", "operator"],
      ["then", "keyword"],
      ["make", "command"],
      [";", "operator"],
      ["fi", "keyword"],
      ["# build", "comment"],
    ]);
    expect(kinds("elide run \\")).toEqual([["elide", "command"], ["run", "subcommand"], ["\\", "continuation"]]);
    expect(kinds("--flag app.ts", { continuation: true })).toEqual([["--flag", "flag"], ["app.ts", "path"]]);
  });

  it("links commands and accepts custom subcommands", () => {
    const tokens = tokenizeShell("mytool deploy now", {
      subcommands: { mytool: ["deploy"] },
      commandHref: (name) => (name === "mytool" ? "/cli/mytool" : undefined),
    });
    expect(tokens[0]).toEqual({ text: "mytool", style: { className: "sh-command" }, href: "/cli/mytool" });
    expect(tokens[2].style?.className).toBe("sh-subcommand");
  });
});
