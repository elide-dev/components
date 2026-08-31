import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Prism } from "prism-react-renderer";
import { CodeBlock } from "./code-block";
import { ensureGrammars } from "./prism-languages";

describe("CodeBlock — editor variant", () => {
  it("renders the filename, a line-number gutter, a vim status bar, and a copy button", () => {
    const code = "const a = 1;\nconst b = 2;\nconst c = 3;";
    const { container } = render(
      <CodeBlock variant="editor" filename="app.ts" lang="typescript" code={code} />,
    );

    // Filename shows in the title bar and again in the status bar.
    expect(screen.getAllByText("app.ts").length).toBeGreaterThanOrEqual(1);

    // The gutter is the aria-hidden div listing one number per code line.
    const gutter = container.querySelector("div[aria-hidden]");
    expect(gutter).not.toBeNull();
    expect(gutter!.textContent!.split("\n")).toEqual(["1", "2", "3"]);

    // Vim status bar.
    expect(screen.getByText("NORMAL")).toBeInTheDocument();
    expect(container).toHaveTextContent("utf-8 · typescript · 3L");

    // Icon-only copy button, named from the localized "Copy".
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("hides the gutter and status bar when lineNumbers/statusBar are false", () => {
    const { container } = render(
      <CodeBlock variant="editor" filename="app.ts" lang="ts" code={"a\nb"} lineNumbers={false} statusBar={false} />,
    );
    expect(container.querySelector("div[aria-hidden]")).toBeNull();
    expect(screen.queryByText("NORMAL")).not.toBeInTheDocument();
  });

  it("renders traffic lights", () => {
    const { container } = render(<CodeBlock code={"x"} filename="a.ts" />);
    expect(container.querySelector('[class*="ff5f56"]')).not.toBeNull();
  });
});

describe("CodeBlock — terminal variant", () => {
  it("renders the lang as the title row and no traffic lights", () => {
    const { container } = render(<CodeBlock variant="terminal" lang="bash" code={"echo hi"} />);
    expect(screen.getByText("bash")).toBeInTheDocument();
    expect(container.querySelector('[class*="ff5f56"]')).toBeNull();
  });

  it("falls back to the localized TERMINAL title when no lang is given", () => {
    render(<CodeBlock variant="terminal" code={"echo hi"} />);
    expect(screen.getByText("Terminal")).toBeInTheDocument();
  });
});

describe("CodeBlock — body", () => {
  it("renders `children` in place of the prism-highlighted body", () => {
    render(
      <CodeBlock code={"const ignored = true;"}>
        <span>custom pre-highlighted body</span>
      </CodeBlock>,
    );
    expect(screen.getByText("custom pre-highlighted body")).toBeInTheDocument();
  });

  it("renders one line span per code line even when lines are identical", () => {
    const { container } = render(<CodeBlock code={"dup\ndup\ndup"} />);
    // Each highlighted line is a `span.block`; keyed() keeps the React keys
    // unique across the duplicate content, so all three render.
    expect(container.querySelectorAll("span.block")).toHaveLength(3);
  });
});

describe("CodeBlock — registered grammars", () => {
  it("registers bash, java, and pkl on the vendored Prism instance", () => {
    ensureGrammars();
    for (const lang of ["bash", "sh", "shell", "java", "pkl"]) {
      expect(Prism.languages[lang], `grammar: ${lang}`).toBeDefined();
    }
  });

  it("highlights java keywords, class names, and strings", () => {
    const { container } = render(
      <CodeBlock lang="java" filename="Main.java" code={'public final class Main {\n  String s = "hi";\n}'} />,
    );
    const text = (sel: string) =>
      [...container.querySelectorAll(sel)].map((el) => el.textContent);
    expect(text(".token.keyword")).toContain("public");
    expect(text(".token.class-name")).toContain("Main");
    expect(text(".token.string")).toContain('"hi"');
  });

  it("highlights pkl keywords, properties, and strings", () => {
    const { container } = render(
      <CodeBlock lang="pkl" filename="elide.pkl" code={'amends "elide:project.pkl"\nname = "app"'} />,
    );
    const text = (sel: string) =>
      [...container.querySelectorAll(sel)].map((el) => el.textContent);
    expect(text(".token.keyword")).toContain("amends");
    expect(text(".token.property")).toContain("name");
    expect(text(".token.string")).toContain('"app"');
  });

  it("highlights bash commands in the terminal variant", () => {
    const { container } = render(<CodeBlock variant="terminal" code={"elide build"} />);
    expect(
      [...container.querySelectorAll(".token.function")].map((el) => el.textContent),
    ).toContain("elide");
  });
});
