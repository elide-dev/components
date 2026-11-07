import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

    // Each row carries its number for the CSS gutter (never part of the text).
    const rows = [...container.querySelectorAll<HTMLElement>(".eld-line")];
    expect(rows.map((row) => row.dataset.n)).toEqual(["1", "2", "3"]);
    expect(container.querySelector("pre")!.textContent).toBe(`${code}\n`);

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
    expect(container.querySelector("[data-n]")).toBeNull();
    expect(screen.queryByText("NORMAL")).not.toBeInTheDocument();
  });

  it("renders traffic lights", () => {
    const { container } = render(<CodeBlock code={"x"} filename="a.ts" />);
    expect(container.querySelector(".eld-chrome-mac")).not.toBeNull();
  });
});

describe("CodeBlock — deprecated terminal variant", () => {
  it("keeps the legacy rendering: terminal title, lang badge, shell highlighting, no gutter", () => {
    const { container } = render(<CodeBlock variant="terminal" lang="bash" code={"elide build"} />);
    expect(screen.getByText("Terminal")).toBeInTheDocument();
    expect(screen.getByText("bash")).toBeInTheDocument();
    expect(container.querySelector("[data-n]")).toBeNull();
    expect(screen.queryByText("NORMAL")).not.toBeInTheDocument();
    expect(container.querySelector(".sh-command")).toHaveTextContent("elide");
  });
});

describe("CodeBlock — body", () => {
  it("renders `children` in place of the highlighted body", () => {
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
    expect(container.querySelectorAll(".eld-line")).toHaveLength(3);
  });
});

describe("CodeBlock — Shiki highlighting", () => {
  it("renders plain text first (SSR-safe), then upgrades with Shiki", async () => {
    const { container } = render(<CodeBlock lang="java" filename="Main.java" code={'public final class Main {\n  String s = "hi";\n}'} />);
    const text = (sel: string) => [...container.querySelectorAll(sel)].map((el) => el.textContent);
    await waitFor(() => expect(text(".tk-keyword")).toContain("public"));
    expect(text(".tk-type").join(" ")).toContain("Main");
    expect(text(".tk-string").join("")).toContain("hi");
    // Text never changes when highlighting arrives, so layout doesn't either.
    expect(container.querySelector("pre")!.textContent).toBe('public final class Main {\n  String s = "hi";\n}\n');
  });

  it("highlights pkl through Shiki's grammar", async () => {
    const { container } = render(<CodeBlock lang="pkl" filename="elide.pkl" code={'amends "elide:project.pkl"\nname = "app"'} />);
    await waitFor(() => expect(container.querySelector(".tk-keyword")).toHaveTextContent("amends"));
  });

  it("uses provided lines without loading a highlighter", () => {
    const { container } = render(
      <CodeBlock code={"x"} lang="ts" lines={[{ tokens: [{ text: "x", style: { className: "tk-param" } }] }]} />,
    );
    expect(container.querySelector(".tk-param")).toHaveTextContent("x");
  });

  it("leaves unsupported languages as plain text", async () => {
    const { container } = render(<CodeBlock code={"hello"} lang="cobol" />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container.querySelector("[class^='tk-']")).toBeNull();
    expect(container.querySelector("pre")).toHaveTextContent("hello");
  });
});

describe("CodeBlock — editor features", () => {
  it("turns notation comments into decorations and strips them from text and copy", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CodeBlock code={"a(); // [!code ++]\nb(); // [!code --]\n// [!code highlight]\nc();\nuse(Database); // [!code word:Database]"} />,
    );
    const rows = [...container.querySelectorAll<HTMLElement>(".eld-line")];
    expect(rows.map((row) => row.dataset.decor)).toEqual(["add", "remove", "highlight", undefined]);
    expect(container.querySelector("mark.eld-mark")).toHaveTextContent("Database");
    expect(container.querySelector("pre")!.textContent).toBe("a();\nb();\nc();\nuse(Database);\n");
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await navigator.clipboard.readText()).toBe("a();\nb();\nc();\nuse(Database);");
  });

  it("highlights line ranges from a meta string", () => {
    const { container } = render(<CodeBlock code={"1\n2\n3\n4"} highlight="1,3-4" />);
    expect([...container.querySelectorAll<HTMLElement>(".eld-line")].map((row) => row.dataset.decor)).toEqual(["highlight", undefined, "highlight", "highlight"]);
  });

  it("makes line numbers permalinks", () => {
    const { container } = render(<CodeBlock filename="app.ts" code={"a\nb"} lineLinks />);
    const link = screen.getByRole("link", { name: "Line 2" });
    expect(link).toHaveAttribute("href", "#app-ts-L2");
    expect(link).toHaveAttribute("id", "app-ts-L2");
    expect(link.textContent).toBe("");
    expect(container.querySelector("pre")!.textContent).toBe("a\nb\n");
  });

  it("collapses to maxLines and expands", async () => {
    const user = userEvent.setup();
    const { container } = render(<CodeBlock code={Array.from({ length: 10 }, (_, i) => `line ${i}`).join("\n")} maxLines={4} />);
    const toggle = screen.getByRole("button", { name: "Show 6 more lines" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector("pre")).toHaveClass("eld-collapsed");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Show fewer lines" })).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelector("pre")).not.toHaveClass("eld-collapsed");
  });

  it("folds ranges behind an expand button", async () => {
    const user = userEvent.setup();
    const { container } = render(<CodeBlock code={"a\nb\nc\nd"} decorations={[{ line: { start: 2, end: 3 }, kind: "fold" }]} />);
    expect(container.querySelectorAll(".eld-line:not(.eld-fold-row)")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "2 lines hidden" }));
    expect(container.querySelectorAll(".eld-line")).toHaveLength(4);
  });

  it("links annotated lines to numbered notes", () => {
    render(<CodeBlock filename="app.ts" code={"a\nb"} annotations={[{ line: 2, content: "Opens the database." }]} />);
    const badge = screen.getByRole("link", { name: "Note 1" });
    expect(badge).toHaveAttribute("href", "#app-ts-note-1");
    expect(screen.getByText("Opens the database.").closest("li")).toHaveAttribute("id", "app-ts-note-1");
  });

  it("renders type hovers with descriptions outside the code", () => {
    const { container } = render(
      <CodeBlock filename="a.ts" code={"const db = 1;"} inline={[{ line: 1, start: 6, end: 8, kind: "hover", payload: "const db: 1" }]} />,
    );
    const hover = screen.getByRole("button", { name: "db" });
    expect(hover).toHaveClass("eld-hover");
    expect(hover).toHaveAccessibleDescription("const db: 1");
    expect(container.querySelector("pre")!.textContent).toBe("const db = 1;\n");
  });

  it("shows files as tabs with arrow-key navigation and copies the active file", async () => {
    const user = userEvent.setup();
    render(
      <CodeBlock
        files={[
          { name: "app.ts", lang: "ts", code: "export const a = 1;" },
          { name: "app.py", lang: "py", code: "a = 1" },
        ]}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false"]);
    tabs[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "app.py" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "app.py" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("a = 1");
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await navigator.clipboard.readText()).toBe("a = 1");
  });

  it("shows a single file as a titled block, not a one-tab tab bar", () => {
    render(<CodeBlock files={[{ name: "only.ts", lang: "ts", code: "x" }]} />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getAllByText("only.ts").length).toBeGreaterThan(0);
  });

  it("wraps in a figure with a caption and renders extra actions", () => {
    const { container } = render(<CodeBlock code={"x"} caption="Figure 1" actions={<a href="/play">Open</a>} />);
    expect(container.querySelector("figure > figcaption")).toHaveTextContent("Figure 1");
    expect(screen.getByRole("link", { name: "Open" })).toBeInTheDocument();
  });
});

describe("CodeBlock — rows, decorations, wrapping and chrome", () => {
  it("marks decorated rows with kinds and localized names, and enables the marks column", () => {
    const { container } = render(
      <CodeBlock
        code={"a\nb\nc\nd"}
        startLine={10}
        decorations={[
          { line: 10, kind: "highlight" },
          { line: { start: 11, end: 12 }, kind: "add" },
          { line: 13, kind: "breakpoint", label: "Pause here" },
        ]}
      />,
    );
    const rows = [...container.querySelectorAll<HTMLElement>(".eld-line")];
    expect(rows.map((row) => row.dataset.n)).toEqual(["10", "11", "12", "13"]);
    expect(rows.map((row) => row.dataset.decor)).toEqual(["highlight", "add", "add", "breakpoint"]);
    expect(rows[1].dataset.sr).toBe("Added");
    expect(rows[3].dataset.sr).toBe("Pause here");
    expect(container.querySelector(".eld-lines")).toHaveAttribute("data-marks");
  });

  it("scrolls unwrapped code as a named, focusable group, and wraps on request", async () => {
    const user = userEvent.setup();
    const { container } = render(<CodeBlock filename="app.ts" code={"x"} wrap="toggle" />);
    const pre = container.querySelector("pre")!;
    expect(pre).toHaveAttribute("tabindex", "0");
    expect(pre).toHaveAccessibleName("app.ts");
    const toggle = screen.getByRole("button", { name: "Wrap lines" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector(".eld-lines")).toHaveAttribute("data-wrap");
    expect(pre).not.toHaveAttribute("tabindex");
  });

  it("exposes the language for tools and renders only the requested chrome", () => {
    const { container } = render(<CodeBlock code={"x"} lang="ts" chrome="windows" />);
    expect(container.querySelector("code.language-ts")).not.toBeNull();
    expect(container.querySelector(".eld-chrome-windows")).not.toBeNull();
    expect(container.querySelector(".eld-chrome-mac")).toBeNull();
    const auto = render(<CodeBlock code={"x"} />).container;
    expect(auto.querySelector('[data-chrome="auto"] .eld-chrome-mac')).not.toBeNull();
    expect(auto.querySelector(".eld-chrome-windows")).not.toBeNull();
  });

  it("highlights shell code with the shell tokenizer", () => {
    const { container } = render(<CodeBlock lang="bash" code={"elide run --watch app.ts"} />);
    expect(container.querySelector(".sh-command")).toHaveTextContent("elide");
    expect(container.querySelector(".sh-flag")).toHaveTextContent("--watch");
  });
});
