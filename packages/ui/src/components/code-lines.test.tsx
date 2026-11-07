import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeLines } from "./code-lines";

const logo = [{ tokens: [{ text: "██╗ dull", style: { color: "#ff88f0" } }, { text: "─┐▀" }] }];

describe("CodeLines terminal glyphs", () => {
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
