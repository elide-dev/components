import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeLines } from "./code-lines";

const logo = [{ tokens: [{ text: "██╗ dull", style: { color: "#ff88f0" } }, { text: "─┐▀" }] }];

describe("CodeLines terminal glyphs", () => {
  it("preserves token links and focus across same-column text updates", () => {
    const makeLines = (text: string) => [{ tokens: [
      { text: "See " },
      { text, href: "/guide", style: { className: "tk-string" } },
      { text: " next", style: { color: "#ff0000", underline: true } },
    ] }];
    const { container, rerender } = render(<CodeLines lines={makeLines("guide")} />);
    const link = container.querySelector("a")!;
    link.focus();
    rerender(<CodeLines lines={makeLines("docs!")} />);
    expect(container.querySelector("a")).toBe(link);
    expect(document.activeElement).toBe(link);
    expect(link).toHaveAttribute("href", "/guide");
    expect(link).toHaveClass("tk-string", "eld-code-link");
    expect(container.textContent).toBe("See docs! next\n");
    expect(container.querySelector('span[style]')).toHaveStyle({ color: "#ff0000", textDecorationLine: "underline" });
    rerender(<CodeLines lines={makeLines("docs!")} links={false} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("See docs! next\n");
  });

  it("segments styled tokens without nesting token links inside decoration links", () => {
    const { container } = render(<CodeLines
      lines={[{ tokens: [{ text: "abcdef", href: "/token", style: { className: "tk-string" } }] }]}
      inline={[{ line: 1, start: 2, end: 4, kind: "link", payload: "/decoration" }]}
    />);
    expect(container.textContent).toBe("abcdef\n");
    expect(container.querySelector('a[href="/decoration"]')?.textContent).toBe("cd");
    expect(container.querySelector('a a')).toBeNull();
    expect(container.querySelectorAll('a[href="/token"]')).toHaveLength(2);
  });

  it("draws box-drawing and block characters as cells on a terminal, keeping the text", () => {
    const { container } = render(<CodeLines lines={logo} variant="terminal" />);
    const cells = [...container.querySelectorAll(".eld-glyph")];
    expect(cells.map((cell) => cell.textContent)).toEqual(["█", "█", "╗", "─", "┐", "▀"]);
    // The stylesheet paints each cell by its character.
    expect(cells.map((cell) => cell.getAttribute("data-glyph")).join("")).toBe("██╗─┐▀");
    expect(cells[0]?.parentElement?.textContent).toBe("██╗ dull");
    // Coloured runs keep their colour; drawn cells inherit it.
    expect(cells[0]?.parentElement?.getAttribute("style")).toContain("color");
    expect(container.textContent).toBe("██╗ dull─┐▀\n");
  });

  it("leaves editor code to the font", () => {
    const { container } = render(<CodeLines lines={logo} />);
    expect(container.querySelector(".eld-glyph")).toBeNull();
  });

  it("fills the row behind a terminal cell's background", () => {
    const lines = [{ tokens: [{ text: " code ", style: { background: "#222222" } }] }];
    const { container } = render(<CodeLines lines={lines} variant="terminal" />);
    expect(container.querySelector(".eld-cell-bg")?.textContent).toBe(" code ");
    const editor = render(<CodeLines lines={lines} />);
    expect(editor.container.querySelector(".eld-cell-bg")).toBeNull();
  });

  it("draws only the characters the stylesheet paints", async () => {
    const { DRAWN } = await import("../lib/terminal-glyphs");
    for (const ch of "━╰╝▍▆▐▒") expect(DRAWN.test(ch)).toBe(true);
    for (const ch of ["d", "a", "╳", "▖", "❯"]) expect(DRAWN.test(ch)).toBe(false);
  });
});
