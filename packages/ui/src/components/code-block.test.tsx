import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CodeBlock } from "./code-block";

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
