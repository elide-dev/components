import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeLines } from "./code-lines";

const logo = [{ tokens: [{ text: "██╗ ab", style: { color: "#ff88f0" } }, { text: "─┐▀" }] }];

describe("CodeLines terminal glyphs", () => {
  it("draws box-drawing and block characters as cells on a terminal, keeping the text", () => {
    const { container } = render(<CodeLines lines={logo} variant="terminal" />);
    const cells = [...container.querySelectorAll(".eld-glyph")];
    expect(cells.map((cell) => cell.textContent)).toEqual(["█", "█", "╗", "─", "┐", "▀"]);
    expect(cells[0]).toHaveClass("eld-gb-full");
    expect(cells[2]).toHaveClass("eld-gx-double", "eld-gx-double-dl");
    expect(cells[4]).toHaveClass("eld-gx-d", "eld-gx-l");
    expect(cells[5]).toHaveClass("eld-gb-upper", "eld-gb-4");
    // Coloured runs keep their colour; drawn cells inherit it.
    expect(cells[0]?.parentElement?.getAttribute("style")).toContain("color");
    expect(container.textContent).toBe("██╗ ab─┐▀\n");
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
});
