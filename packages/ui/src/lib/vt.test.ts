import { describe, expect, it } from "vitest";
import { lineText, type CodeLine } from "./code-model";
import { ansiColor, createTerminal, renderAnsi, stripAnsi } from "./vt";

const ESC = "\x1b";
const text = (lines: CodeLine[]) => lines.map(lineText);
const screenText = (data: string, cols = 20, rows = 4) => {
  const terminal = createTerminal({ cols, rows });
  terminal.write(data);
  return text(terminal.snapshot({ cursor: false }).lines);
};

describe("lite VT — text and cursor", () => {
  it("prints, carriage-returns and line-feeds like a PTY", () => {
    expect(screenText("hello\r\nworld")).toEqual(["hello", "world", "", ""]);
    // Bare LF keeps the column without convertEol.
    expect(screenText("ab\ncd")).toEqual(["ab", "  cd", "", ""]);
  });

  it("overwrites in place with CR (progress bars)", () => {
    expect(screenText("10%\r50%\r100%")).toEqual(["100%", "", "", ""]);
  });

  it("wraps at the right margin and scrolls into scrollback", () => {
    const terminal = createTerminal({ cols: 4, rows: 2 });
    terminal.write("abcdefgh\r\nij");
    expect(text(terminal.snapshot({ cursor: false }).lines)).toEqual(["abcd", "efgh", "ij"]);
    expect(text(terminal.snapshot({ cursor: false, scrollback: false }).lines)).toEqual(["efgh", "ij"]);
  });

  it("handles backspace and tabs", () => {
    expect(screenText("abc\bX\tY")).toEqual(["abX     Y", "", "", ""]);
  });

  it("moves the cursor with CUP/CUU/CUD/CUF/CUB/CHA", () => {
    expect(screenText(`${ESC}[2;3HX${ESC}[AY${ESC}[2BZ${ESC}[1;1H${ESC}[3CW${ESC}[5GV${ESC}[2DU`)).toEqual([
      "   UV",
      "  X",
      "    Z",
      "",
    ]);
  });

  it("erases lines and the display", () => {
    expect(screenText(`abcdef${ESC}[3D${ESC}[K`)).toEqual(["abc", "", "", ""]);
    expect(screenText(`abcdef${ESC}[3D${ESC}[1K`)).toEqual(["    ef", "", "", ""]);
    expect(screenText(`one\r\ntwo\r\nthree${ESC}[2;1H${ESC}[J`)).toEqual(["one", "", "", ""]);
    expect(screenText(`one\r\ntwo${ESC}[2J`)).toEqual(["", "", "", ""]);
  });

  it("inserts and deletes characters and lines", () => {
    expect(screenText(`abcdef${ESC}[1;3H${ESC}[2P`)).toEqual(["abef", "", "", ""]);
    expect(screenText(`abcdef${ESC}[1;3H${ESC}[2@`)).toEqual(["ab  cdef", "", "", ""]);
    expect(screenText(`1\r\n2\r\n3${ESC}[2;1H${ESC}[L`)).toEqual(["1", "", "2", "3"]);
    expect(screenText(`1\r\n2\r\n3${ESC}[1;1H${ESC}[M`)).toEqual(["2", "3", "", ""]);
  });

  it("scrolls only within the scroll region", () => {
    const lines = screenText(`${ESC}[2;3r${ESC}[1;1Htop${ESC}[2;1Ha\r\nb\r\nc${ESC}[4;1Hbottom`);
    expect(lines).toEqual(["top", "b", "c", "bottom"]);
  });

  it("restores the main screen after the alt screen (1049)", () => {
    const lines = screenText(`shell$ ${ESC}[?1049h${ESC}[Hfull screen app${ESC}[?1049l`);
    expect(lines).toEqual(["shell$ ", "", "", ""]);
  });

  it("saves and restores the cursor", () => {
    expect(screenText(`ab${ESC}7${ESC}[3;1Hx${ESC}8c`)).toEqual(["abc", "", "x", ""]);
  });

  it("captures the window title and swallows unknown sequences", () => {
    const terminal = createTerminal({ cols: 30, rows: 2 });
    terminal.write(`${ESC}]0;elide run${"\x07"}a${ESC}[?2004h${ESC}[>4;1m${ESC}P+q544e${ESC}\\b${ESC}[5 qc${ESC}]8;;https://elide.dev${ESC}\\d`);
    expect(terminal.title).toBe("elide run");
    expect(text(terminal.snapshot({ cursor: false }).lines)[0]).toBe("abcd");
  });

  it("survives sequences split across writes", () => {
    const terminal = createTerminal({ cols: 10, rows: 1 });
    terminal.write(`${ESC}[3`);
    terminal.write("1mred");
    terminal.write(`${ESC}`);
    terminal.write("[0m");
    const [line] = terminal.snapshot({ cursor: false }).lines;
    expect(line.tokens).toEqual([{ text: "red", style: { color: "var(--eld-ansi-red)" } }]);
  });

  it("renders DEC line drawing", () => {
    expect(screenText(`${ESC}(0lqqk${ESC}(B ok`)).toEqual(["┌──┐ ok", "", "", ""]);
  });

  it("keeps wide characters and combining marks in one cell", () => {
    const terminal = createTerminal({ cols: 6, rows: 2 });
    const acute = "e\u0301";
    terminal.write(`日本${acute}x`);
    expect(text(terminal.snapshot({ cursor: false }).lines)[0]).toBe(`日本${acute}x`);
    terminal.write("\r\n👍🏽ok");
    expect(text(terminal.snapshot({ cursor: false }).lines)[1]).toBe("👍🏽ok");
  });

  it("marks the cursor cell, padding past the end of the row", () => {
    const terminal = createTerminal({ cols: 10, rows: 1 });
    terminal.write(`ab${ESC}[5G`);
    const [line] = terminal.snapshot().lines;
    expect(line.tokens).toEqual([{ text: "ab  " }, { text: " ", cursor: true }]);
    terminal.write(`${ESC}[?25l`);
    expect(terminal.snapshot().lines[0].tokens).toEqual([{ text: "ab" }]);
  });

  it("clones independently", () => {
    const terminal = createTerminal({ cols: 10, rows: 1 });
    terminal.write("one");
    const copy = terminal.clone();
    terminal.write(" two");
    expect(text(copy.snapshot({ cursor: false }).lines)).toEqual(["one"]);
    expect(text(terminal.snapshot({ cursor: false }).lines)).toEqual(["one two"]);
  });

  it("resizes without losing the cursor line", () => {
    const terminal = createTerminal({ cols: 10, rows: 4 });
    terminal.write("1\r\n2\r\n3\r\n4");
    terminal.resize(5, 2);
    expect(text(terminal.snapshot({ cursor: false, scrollback: false }).lines)).toEqual(["3", "4"]);
    expect(text(terminal.snapshot({ cursor: false }).lines)).toEqual(["1", "2", "3", "4"]);
  });
});

describe("lite VT — SGR", () => {
  const tokens = (data: string) => {
    const terminal = createTerminal({ cols: 40, rows: 1 });
    terminal.write(data);
    return terminal.snapshot({ cursor: false }).lines[0].tokens;
  };

  it("maps the 16 colors to tokens and resets", () => {
    expect(tokens(`${ESC}[1;32mok${ESC}[0m ${ESC}[91;44merr${ESC}[39;49m.`)).toEqual([
      { text: "ok", style: { color: "var(--eld-ansi-green)", bold: true } },
      { text: " " },
      { text: "err", style: { color: "var(--eld-ansi-bright-red)", background: "var(--eld-ansi-blue)" } },
      { text: "." },
    ]);
  });

  it("supports 256-color and truecolor in both separator styles", () => {
    expect(tokens(`${ESC}[38;5;208ma${ESC}[38;2;10;20;30mb${ESC}[38:2::1:2:3mc${ESC}[48:5:232md`)).toEqual([
      { text: "a", style: { color: "#ff8700" } },
      { text: "b", style: { color: "#0a141e" } },
      { text: "c", style: { color: "#010203" } },
      { text: "d", style: { color: "#010203", background: "#080808" } },
    ]);
  });

  it("applies and clears attributes", () => {
    expect(tokens(`${ESC}[2;3;4;9mx${ESC}[22;23;24;29my`)).toEqual([
      { text: "x", style: { dim: true, italic: true, underline: true, strike: true } },
      { text: "y" },
    ]);
    expect(tokens(`${ESC}[4:0mz`)).toEqual([{ text: "z" }]);
  });

  it("swaps colors for inverse video", () => {
    expect(tokens(`${ESC}[7mx`)).toEqual([
      { text: "x", style: { color: "var(--code-background)", background: "var(--eld-syntax-default)" } },
    ]);
  });

  it("erases with the current background (BCE)", () => {
    const [first] = tokens(`${ESC}[41m${ESC}[K`);
    expect(first.style).toEqual({ background: "var(--eld-ansi-red)" });
    expect(first.text).toHaveLength(40);
  });

  it("maps the color cube and grayscale ramp", () => {
    expect(ansiColor(16)).toBe("#000000");
    expect(ansiColor(231)).toBe("#ffffff");
    expect(ansiColor(255)).toBe("#eeeeee");
    expect(ansiColor("#123456")).toBe("#123456");
  });
});

describe("renderAnsi / stripAnsi", () => {
  it("renders captured output without wrapping, trimming trailing blank lines", () => {
    const long = "x".repeat(300);
    const lines = renderAnsi(`${ESC}[32m✓${ESC}[0m built\n${long}\n\n`);
    expect(text(lines)).toEqual(["✓ built", long]);
    expect(lines[0].tokens[0]).toEqual({ text: "✓", style: { color: "var(--eld-ansi-green)" } });
  });

  it("keeps SGR state across lines, as a terminal does", () => {
    const lines = renderAnsi(`${ESC}[33mone\ntwo${ESC}[0m`);
    expect(lines[1].tokens).toEqual([{ text: "two", style: { color: "var(--eld-ansi-yellow)" } }]);
  });

  it("strips escape sequences", () => {
    expect(stripAnsi(`${ESC}[1;31mred${ESC}[0m ${ESC}]0;title\x07ok${ESC}(B`)).toBe("red ok");
  });
});
