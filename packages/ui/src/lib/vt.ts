/**
 * Lite VT — a small ANSI/VT100 interpreter in pure TypeScript.
 *
 * Renders terminal output (static ANSI samples, asciicast recordings, live
 * streams) into the shared code model. It is deliberately not a full xterm:
 * it covers what CLI tools emit (SGR colors incl. 256/truecolor, cursor
 * movement, erase, insert/delete, scroll regions, alt screen, DEC line
 * drawing, titles) and silently consumes everything else so unknown
 * sequences never leak into the rendered text. No DOM, so it runs during SSR.
 */
import type { CodeLine, CodeToken, TokenStyle } from "./code-model";
import { DRAWN } from "./terminal-glyphs";

/** 0–255 palette index, or a `#rrggbb` truecolor. */
type Color = number | string;

interface Attr {
  readonly fg?: Color;
  readonly bg?: Color;
  readonly bold?: boolean;
  readonly dim?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly inverse?: boolean;
  readonly strike?: boolean;
  readonly hidden?: boolean;
  /** OSC 8 hyperlink target. */
  readonly href?: string;
}

/** Cells are immutable; rows are replaced/spliced, never mutated per cell. */
interface Cell {
  /** Grapheme text; "" marks the trailing half of a wide character. */
  readonly ch: string;
  readonly attr: Attr;
  readonly wide?: boolean;
}

type Row = Cell[];

export interface TerminalCursor {
  /** Index into `TerminalScreen.lines`. */
  row: number;
  col: number;
  visible: boolean;
}

export interface TerminalScreen {
  lines: CodeLine[];
  cursor: TerminalCursor;
  cols: number;
  rows: number;
  title?: string;
}

export interface SnapshotOptions {
  /** Include scrollback above the viewport (default true). */
  scrollback?: boolean;
  /** Drop empty rows after the last content/cursor row (default false). */
  trim?: boolean;
  /** Mark the cursor cell with `CodeToken.cursor` when visible (default true). */
  cursor?: boolean;
  /** Preserve exact VT columns and separate drawn cells for recording playback. */
  positioned?: boolean;
}

export interface TerminalOptions {
  cols?: number;
  rows?: number;
  /** Max scrollback lines retained above the viewport (default 1000). */
  scrollback?: number;
  /** Treat a bare LF as CR+LF, for text that was not produced by a PTY. */
  convertEol?: boolean;
}

export interface VirtualTerminal {
  readonly cols: number;
  readonly rows: number;
  readonly title: string | undefined;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  reset(): void;
  snapshot(options?: SnapshotOptions): TerminalScreen;
  /** Independent copy (used for seek keyframes). */
  clone(): VirtualTerminal;
}

const DEFAULT_ATTR: Attr = Object.freeze({});
const BLANK: Cell = Object.freeze({ ch: " ", attr: DEFAULT_ATTR });

const ANSI_NAMES = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "bright-black", "bright-red", "bright-green", "bright-yellow",
  "bright-blue", "bright-magenta", "bright-cyan", "bright-white",
] as const;

/** DEC Special Graphics (ESC ( 0) — box drawing used by TUIs and progress UIs. */
const DEC_GRAPHICS: Record<string, string> = {
  "`": "◆", a: "▒", b: "␉", c: "␌", d: "␍", e: "␊", f: "°", g: "±", h: "␤", i: "␋",
  j: "┘", k: "┐", l: "┌", m: "└", n: "┼", o: "⎺", p: "⎻", q: "─", r: "⎼", s: "⎽",
  t: "├", u: "┤", v: "┴", w: "┬", x: "│", y: "≤", z: "≥", "{": "π", "|": "≠", "}": "£", "~": "·",
};

const COMBINING_MARK = /^\p{M}$/u;

/** Code points that never take a cell: combining marks, ZW(N)J/ZWSP, variation selectors, skin tones, tag characters. */
function isZeroWidth(ch: string): boolean {
  const code = ch.codePointAt(0)!;
  return (
    COMBINING_MARK.test(ch) ||
    (code >= 0x200b && code <= 0x200d) ||
    code === 0xfe0e ||
    code === 0xfe0f ||
    (code >= 0x1f3fb && code <= 0x1f3ff) ||
    (code >= 0xe0020 && code <= 0xe007f)
  );
}
const WIDE =
  /^[\u1100-\u115f\u231a\u231b\u2329\u232a\u23e9-\u23ec\u23f0\u23f3\u25fd\u25fe\u2614\u2615\u2648-\u2653\u267f\u2693\u26a1\u26aa\u26ab\u26bd\u26be\u26c4\u26c5\u26ce\u26d4\u26ea\u26f2\u26f3\u26f5\u26fa\u26fd\u2705\u270a\u270b\u2728\u274c\u274e\u2753-\u2755\u2757\u2795-\u2797\u27b0\u27bf\u2b1b\u2b1c\u2b50\u2b55\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\ua960-\ua97f\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6\u{1f004}\u{1f0cf}\u{1f18e}\u{1f191}-\u{1f19a}\u{1f1e6}-\u{1f1ff}\u{1f200}-\u{1f251}\u{1f300}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{1f7e0}-\u{1f7eb}\u{1f90c}-\u{1f9ff}\u{1fa70}-\u{1faff}\u{20000}-\u{3fffd}]$/u;
const REGIONAL_INDICATOR = /^[\u{1f1e6}-\u{1f1ff}]$/u;

const enum State {
  Ground,
  Escape,
  /** ESC ( ) * + — the next byte designates a character set. */
  Charset,
  /** ESC followed by an intermediate we don't model (e.g. ESC # 8): swallow one byte. */
  EscapeSkip,
  Csi,
  Osc,
  OscEscape,
  /** DCS / APC / PM / SOS payloads, consumed until ST. */
  String,
  StringEscape,
}

/** Map a palette index or truecolor to a CSS color. */
export function ansiColor(color: Color): string {
  if (typeof color === "string") return color;
  if (color < 16) return `var(--eld-ansi-${ANSI_NAMES[color]})`;
  if (color < 232) {
    const levels = [0, 95, 135, 175, 215, 255];
    const i = color - 16;
    return hex(levels[Math.floor(i / 36)], levels[Math.floor(i / 6) % 6], levels[i % 6]);
  }
  const gray = 8 + (color - 232) * 10;
  return hex(gray, gray, gray);
}

function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("")}`;
}

const styleCache = new WeakMap<Attr, TokenStyle | undefined>();

function toStyle(attr: Attr): TokenStyle | undefined {
  if (styleCache.has(attr)) return styleCache.get(attr);
  let fg = attr.fg === undefined ? undefined : ansiColor(attr.fg);
  let bg = attr.bg === undefined ? undefined : ansiColor(attr.bg);
  if (attr.inverse) {
    [fg, bg] = [bg ?? "var(--code-background)", fg ?? "var(--eld-syntax-default)"];
  }
  const style: TokenStyle = {};
  if (fg) style.color = fg;
  if (bg) style.background = bg;
  if (attr.bold) style.bold = true;
  if (attr.dim) style.dim = true;
  if (attr.italic) style.italic = true;
  if (attr.underline) style.underline = true;
  if (attr.strike) style.strike = true;
  if (attr.hidden) style.hidden = true;
  const result = Object.keys(style).length ? style : undefined;
  styleCache.set(attr, result);
  return result;
}

type Param = number | undefined | (number | undefined)[];

function parseParams(raw: string): Param[] {
  if (raw === "") return [];
  return raw.split(";").map((part) => {
    if (part.includes(":")) return part.split(":").map((sub) => (sub === "" ? undefined : Number(sub)));
    return part === "" ? undefined : Number(part);
  });
}

function first(param: Param): number | undefined {
  return Array.isArray(param) ? param[0] : param;
}

interface TerminalState {
  cols: number;
  rows: number;
  scrollbackLimit: number;
  convertEol: boolean;
  main: Row[];
  alt: Row[];
  usingAlt: boolean;
  scrollback: Row[];
  x: number;
  y: number;
  wrapPending: boolean;
  attr: Attr;
  saved: { x: number; y: number; attr: Attr; charsets: [string, string]; active: 0 | 1 } | undefined;
  savedMain: { x: number; y: number; attr: Attr } | undefined;
  top: number;
  bottom: number;
  cursorVisible: boolean;
  autowrap: boolean;
  charsets: [string, string];
  activeCharset: 0 | 1;
  pendingCharset: 0 | 1;
  title: string | undefined;
  state: State;
  buffer: string;
  lastPrinted: string | undefined;
  /** A ZWJ was printed: the next code point joins the previous cell. */
  joinNext: boolean;
}

function blankRows(count: number): Row[] {
  return Array.from({ length: count }, () => []);
}

export function createTerminal(options: TerminalOptions = {}): VirtualTerminal {
  const cols = Math.max(1, Math.floor(options.cols ?? 80));
  const rows = Math.max(1, Math.floor(options.rows ?? 24));
  return fromState({
    cols,
    rows,
    scrollbackLimit: options.scrollback ?? 1000,
    convertEol: options.convertEol ?? false,
    main: blankRows(rows),
    alt: blankRows(rows),
    usingAlt: false,
    scrollback: [],
    x: 0,
    y: 0,
    wrapPending: false,
    attr: DEFAULT_ATTR,
    saved: undefined,
    savedMain: undefined,
    top: 0,
    bottom: rows - 1,
    cursorVisible: true,
    autowrap: true,
    charsets: ["B", "B"],
    activeCharset: 0,
    pendingCharset: 0,
    title: undefined,
    state: State.Ground,
    buffer: "",
    lastPrinted: undefined,
    joinNext: false,
  });
}

function fromState(s: TerminalState): VirtualTerminal {
  const screen = () => (s.usingAlt ? s.alt : s.main);

  // ---- cell helpers -------------------------------------------------------
  /** The attribute erased cells take: current background only (BCE). */
  const eraseAttr = (): Attr => (s.attr.bg === undefined ? DEFAULT_ATTR : { bg: s.attr.bg });

  function eraseCells(row: Row, from: number, to: number) {
    const attr = eraseAttr();
    const end = Math.min(to, s.cols);
    if (attr === DEFAULT_ATTR && end >= row.length) {
      if (from < row.length) row.length = Math.max(0, from);
      return;
    }
    const cell: Cell = attr === DEFAULT_ATTR ? BLANK : { ch: " ", attr };
    while (row.length < end) row.push(BLANK);
    for (let i = Math.max(0, from); i < end; i++) row[i] = cell;
  }

  function blankRow(): Row {
    const attr = eraseAttr();
    if (attr === DEFAULT_ATTR) return [];
    const cell: Cell = { ch: " ", attr };
    return Array.from({ length: s.cols }, () => cell);
  }

  function setCell(row: Row, x: number, cell: Cell) {
    while (row.length < x) row.push(BLANK);
    // Overwriting half of a wide character clears its other half.
    const existing = row[x];
    if (existing?.wide && row[x + 1]?.ch === "") row[x + 1] = BLANK;
    if (existing && existing.ch === "" && x > 0 && row[x - 1]?.wide) row[x - 1] = BLANK;
    row[x] = cell;
  }

  // ---- scrolling ----------------------------------------------------------
  function scrollUp(count: number) {
    const rows = screen();
    for (let n = 0; n < count; n++) {
      const [removed] = rows.splice(s.top, 1);
      if (!s.usingAlt && s.top === 0) {
        s.scrollback.push(removed);
        if (s.scrollback.length > s.scrollbackLimit) s.scrollback.shift();
      }
      rows.splice(s.bottom, 0, blankRow());
    }
  }

  function scrollDown(count: number) {
    const rows = screen();
    for (let n = 0; n < count; n++) {
      rows.splice(s.bottom, 1);
      rows.splice(s.top, 0, blankRow());
    }
  }

  function lineFeed() {
    s.wrapPending = false;
    if (s.y === s.bottom) scrollUp(1);
    else if (s.y < s.rows - 1) s.y++;
  }

  function reverseIndex() {
    s.wrapPending = false;
    if (s.y === s.top) scrollDown(1);
    else if (s.y > 0) s.y--;
  }

  // ---- printing -----------------------------------------------------------
  function print(input: string) {
    let ch = input;
    if (s.charsets[s.activeCharset] === "0") ch = DEC_GRAPHICS[ch] ?? ch;
    const rows = screen();

    // Combining marks, variation selectors, ZWJ sequences and flag pairs extend
    // the previous cell instead of taking a new one.
    const prevX = s.wrapPending ? s.x : s.x - 1;
    const prev = prevX >= 0 ? rows[s.y][prevX] : undefined;
    const target = prev?.ch === "" && prevX > 0 ? prevX - 1 : prevX;
    const targetCell = rows[s.y][target];
    const joins =
      targetCell &&
      targetCell.ch !== "" &&
      (s.joinNext ||
        isZeroWidth(ch) ||
        (REGIONAL_INDICATOR.test(ch) && [...targetCell.ch].length === 1 && REGIONAL_INDICATOR.test(targetCell.ch)));
    if (joins) {
      rows[s.y][target] = { ...targetCell, ch: targetCell.ch + ch };
      s.joinNext = ch === "\u200d";
      return;
    }
    s.joinNext = false;
    if (isZeroWidth(ch)) return; // nothing to attach to

    const width = WIDE.test(ch) ? 2 : 1;
    if (s.wrapPending) {
      if (s.autowrap) {
        s.x = 0;
        lineFeed();
      }
      s.wrapPending = false;
    }
    if (width === 2 && s.x === s.cols - 1) {
      // A wide char never splits across lines.
      if (s.autowrap) {
        setCell(rows[s.y], s.x, BLANK);
        s.x = 0;
        lineFeed();
      } else return;
    }
    const row = screen()[s.y];
    setCell(row, s.x, { ch, attr: s.attr, wide: width === 2 || undefined });
    if (width === 2) setCell(row, s.x + 1, { ch: "", attr: s.attr });
    s.lastPrinted = ch;
    if (s.x + width >= s.cols) {
      s.x = s.cols - 1;
      s.wrapPending = true;
    } else {
      s.x += width;
    }
  }

  // ---- cursor -------------------------------------------------------------
  function moveTo(x: number, y: number) {
    s.wrapPending = false;
    s.x = Math.max(0, Math.min(s.cols - 1, x));
    s.y = Math.max(0, Math.min(s.rows - 1, y));
  }

  function saveCursor() {
    s.saved = { x: s.x, y: s.y, attr: s.attr, charsets: [...s.charsets], active: s.activeCharset };
  }

  function restoreCursor() {
    const saved = s.saved;
    if (!saved) {
      moveTo(0, 0);
      return;
    }
    s.attr = saved.attr;
    s.charsets = [...saved.charsets];
    s.activeCharset = saved.active;
    moveTo(saved.x, saved.y);
  }

  // ---- control characters --------------------------------------------------
  function control(code: number) {
    switch (code) {
      case 0x08: // BS
        if (s.wrapPending) s.wrapPending = false;
        else if (s.x > 0) s.x--;
        break;
      case 0x09: { // HT
        s.wrapPending = false;
        s.x = Math.min(s.cols - 1, (Math.floor(s.x / 8) + 1) * 8);
        break;
      }
      case 0x0a: case 0x0b: case 0x0c: // LF VT FF
        if (s.convertEol) s.x = 0;
        lineFeed();
        break;
      case 0x0d: // CR
        s.x = 0;
        s.wrapPending = false;
        break;
      case 0x0e: s.activeCharset = 1; break; // SO
      case 0x0f: s.activeCharset = 0; break; // SI
      default: break; // BEL, NUL and the rest are ignored
    }
  }

  // ---- SGR ----------------------------------------------------------------
  function extendedColor(params: Param[], index: number): { color?: Color; consumed: number } {
    const param = params[index];
    if (Array.isArray(param)) {
      // Colon form: 38:5:n or 38:2:[colorspace]:r:g:b
      const [, mode, ...rest] = param;
      if (mode === 5) return { color: rest[0], consumed: 0 };
      if (mode === 2) {
        const rgb = rest.length >= 4 ? rest.slice(1, 4) : rest.slice(0, 3);
        return { color: hex(rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0), consumed: 0 };
      }
      return { consumed: 0 };
    }
    const mode = first(params[index + 1]);
    if (mode === 5) return { color: first(params[index + 2]), consumed: 2 };
    if (mode === 2) {
      return {
        color: hex(first(params[index + 2]) ?? 0, first(params[index + 3]) ?? 0, first(params[index + 4]) ?? 0),
        consumed: 4,
      };
    }
    return { consumed: 1 };
  }

  function sgr(params: Param[]) {
    if (params.length === 0) params = [0];
    let next: { -readonly [K in keyof Attr]: Attr[K] } = { ...s.attr };
    for (let i = 0; i < params.length; i++) {
      const code = first(params[i]) ?? 0;
      if (code === 0) next = {};
      else if (code === 1) next.bold = true;
      else if (code === 2) next.dim = true;
      else if (code === 3) next.italic = true;
      else if (code === 4) {
        const style = Array.isArray(params[i]) ? (params[i] as (number | undefined)[])[1] : undefined;
        next.underline = style !== 0;
      } else if (code === 7) next.inverse = true;
      else if (code === 8) next.hidden = true;
      else if (code === 9) next.strike = true;
      else if (code === 21) next.underline = true;
      else if (code === 22) { next.bold = false; next.dim = false; }
      else if (code === 23) next.italic = false;
      else if (code === 24) next.underline = false;
      else if (code === 27) next.inverse = false;
      else if (code === 28) next.hidden = false;
      else if (code === 29) next.strike = false;
      else if (code >= 30 && code <= 37) next.fg = code - 30;
      else if (code === 38) {
        const { color, consumed } = extendedColor(params, i);
        if (color !== undefined) next.fg = color;
        i += consumed;
      } else if (code === 39) next.fg = undefined;
      else if (code >= 40 && code <= 47) next.bg = code - 40;
      else if (code === 48) {
        const { color, consumed } = extendedColor(params, i);
        if (color !== undefined) next.bg = color;
        i += consumed;
      } else if (code === 49) next.bg = undefined;
      else if (code >= 90 && code <= 97) next.fg = code - 90 + 8;
      else if (code >= 100 && code <= 107) next.bg = code - 100 + 8;
      // 5/6 blink, 10–20 fonts, 50+ and the rest: ignored.
    }
    // Normalize: drop false/undefined so equal styles share structure.
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(next)) if (value !== undefined && value !== false) clean[key] = value;
    s.attr = Object.keys(clean).length ? (Object.freeze(clean) as Attr) : DEFAULT_ATTR;
  }

  // ---- modes ---------------------------------------------------------------
  function setMode(params: Param[], privateMarker: string, enable: boolean) {
    if (privateMarker !== "?") return;
    for (const param of params) {
      const mode = first(param);
      if (mode === 25) s.cursorVisible = enable;
      else if (mode === 7) s.autowrap = enable;
      else if (mode === 1049 || mode === 1047 || mode === 47) {
        if (enable === s.usingAlt) continue;
        if (enable) {
          if (mode === 1049) s.savedMain = { x: s.x, y: s.y, attr: s.attr };
          s.alt = blankRows(s.rows);
          s.usingAlt = true;
        } else {
          s.usingAlt = false;
          if (mode === 1049 && s.savedMain) {
            s.attr = s.savedMain.attr;
            moveTo(s.savedMain.x, s.savedMain.y);
          }
        }
        s.top = 0;
        s.bottom = s.rows - 1;
      }
      // Mouse tracking, bracketed paste, focus events, synchronized output…: ignored.
    }
  }

  // ---- CSI dispatch ----------------------------------------------------------
  function csi(raw: string, final: string) {
    let privateMarker = "";
    let body = raw;
    if (body && "<=>?".includes(body[0])) {
      privateMarker = body[0];
      body = body.slice(1);
    }
    const intermediates = body.match(/[\x20-\x2f]+$/)?.[0] ?? "";
    if (intermediates) body = body.slice(0, -intermediates.length);
    // Sequences with intermediates (DECSCUSR `q`, DECSTR `!p`, …) don't affect rendering.
    if (intermediates) return;
    const params = parseParams(body);
    /** Count-like parameter: missing or 0 means 1. */
    const n = (i: number) => Math.max(1, first(params[i]) ?? 1);
    const raw0 = first(params[0]) ?? 0;

    if (privateMarker && final !== "h" && final !== "l") return;
    const rows = screen();
    switch (final) {
      case "A": moveTo(s.x, Math.max(s.y >= s.top ? s.top : 0, s.y - n(0))); break;
      case "B": moveTo(s.x, Math.min(s.y <= s.bottom ? s.bottom : s.rows - 1, s.y + n(0))); break;
      case "C": case "a": moveTo(s.x + n(0), s.y); break;
      case "D": moveTo(s.x - n(0), s.y); break;
      case "E": moveTo(0, s.y + n(0)); break;
      case "F": moveTo(0, s.y - n(0)); break;
      case "G": case "`": moveTo(n(0) - 1, s.y); break;
      case "d": moveTo(s.x, n(0) - 1); break;
      case "H": case "f": moveTo(n(1) - 1, n(0) - 1); break;
      case "J": {
        s.wrapPending = false;
        if (raw0 === 0) {
          eraseCells(rows[s.y], s.x, s.cols);
          for (let y = s.y + 1; y < s.rows; y++) rows[y] = blankRow();
        } else if (raw0 === 1) {
          for (let y = 0; y < s.y; y++) rows[y] = blankRow();
          eraseCells(rows[s.y], 0, s.x + 1);
        } else if (raw0 === 2) {
          for (let y = 0; y < s.rows; y++) rows[y] = blankRow();
        } else if (raw0 === 3) {
          s.scrollback = [];
        }
        break;
      }
      case "K": {
        s.wrapPending = false;
        if (raw0 === 0) eraseCells(rows[s.y], s.x, s.cols);
        else if (raw0 === 1) eraseCells(rows[s.y], 0, s.x + 1);
        else if (raw0 === 2) rows[s.y] = blankRow();
        break;
      }
      case "X": eraseCells(rows[s.y], s.x, s.x + n(0)); break;
      case "@": {
        const row = rows[s.y];
        if (s.x < row.length) {
          row.splice(s.x, 0, ...Array.from({ length: n(0) }, () => BLANK));
          if (row.length > s.cols) row.length = s.cols;
        }
        break;
      }
      case "P": {
        const row = rows[s.y];
        if (s.x < row.length) row.splice(s.x, n(0));
        break;
      }
      case "L":
        if (s.y >= s.top && s.y <= s.bottom) {
          for (let i = 0; i < n(0); i++) {
            rows.splice(s.bottom, 1);
            rows.splice(s.y, 0, blankRow());
          }
          s.x = 0;
        }
        break;
      case "M":
        if (s.y >= s.top && s.y <= s.bottom) {
          for (let i = 0; i < n(0); i++) {
            rows.splice(s.y, 1);
            rows.splice(s.bottom, 0, blankRow());
          }
          s.x = 0;
        }
        break;
      case "S": scrollUp(n(0)); break;
      case "T": scrollDown(n(0)); break;
      case "b":
        if (s.lastPrinted) for (let i = 0; i < n(0); i++) print(s.lastPrinted);
        break;
      case "m": sgr(params); break;
      case "r": {
        const top = (first(params[0]) ?? 1) - 1;
        const bottom = (first(params[1]) ?? s.rows) - 1;
        if (top < bottom && bottom < s.rows) {
          s.top = Math.max(0, top);
          s.bottom = bottom;
          moveTo(0, 0);
        }
        break;
      }
      case "s": saveCursor(); break;
      case "u": restoreCursor(); break;
      case "h": setMode(params, privateMarker, true); break;
      case "l": setMode(params, privateMarker, false); break;
      default: break; // DSR, DA, window ops, …: no rendering effect
    }
  }

  function osc(payload: string) {
    const split = payload.indexOf(";");
    const code = split === -1 ? payload : payload.slice(0, split);
    if (code === "0" || code === "2") s.title = payload.slice(split + 1);
    else if (code === "8") {
      // OSC 8 ; params ; URI — an empty URI closes the link. Only web links are kept.
      const uri = payload.slice(payload.indexOf(";", split + 1) + 1);
      const { href: _closed, ...rest } = s.attr;
      void _closed;
      const next = /^https?:\/\//i.test(uri) ? { ...rest, href: uri } : rest;
      s.attr = Object.keys(next).length ? (Object.freeze(next) as Attr) : DEFAULT_ATTR;
    }
  }

  function escape(ch: string) {
    s.state = State.Ground;
    switch (ch) {
      case "[": s.state = State.Csi; s.buffer = ""; break;
      case "]": s.state = State.Osc; s.buffer = ""; break;
      case "P": case "_": case "^": case "X": s.state = State.String; break;
      case "(": s.state = State.Charset; s.pendingCharset = 0; break;
      case ")": s.state = State.Charset; s.pendingCharset = 1; break;
      case "*": case "+": case "-": case ".": case "/": s.state = State.EscapeSkip; break;
      case "#": case " ": case "%": s.state = State.EscapeSkip; break;
      case "7": saveCursor(); break;
      case "8": restoreCursor(); break;
      case "D": lineFeed(); break;
      case "E": s.x = 0; lineFeed(); break;
      case "M": reverseIndex(); break;
      case "c": reset(); break;
      default: break; // ESC = / ESC > / ESC \ (stray ST) …
    }
  }

  function reset() {
    const fresh = createTerminal({
      cols: s.cols,
      rows: s.rows,
      scrollback: s.scrollbackLimit,
      convertEol: s.convertEol,
    }) as VirtualTerminal & { [STATE]: TerminalState };
    const scrollback = s.scrollback;
    Object.assign(s, fresh[STATE]);
    s.scrollback = scrollback;
  }

  function write(data: string) {
    for (const ch of data) {
      const code = ch.codePointAt(0)!;
      switch (s.state) {
        case State.Ground:
          if (code === 0x1b) s.state = State.Escape;
          else if (code < 0x20 || code === 0x7f) control(code);
          else if (code === 0x9b) { s.state = State.Csi; s.buffer = ""; } // 8-bit CSI
          else print(ch);
          break;
        case State.Escape:
          escape(ch);
          break;
        case State.Charset:
          s.charsets[s.pendingCharset] = ch;
          s.state = State.Ground;
          break;
        case State.EscapeSkip:
          s.state = State.Ground;
          break;
        case State.Csi:
          if (code >= 0x40 && code <= 0x7e) {
            s.state = State.Ground;
            csi(s.buffer, ch);
          } else if (code === 0x1b) {
            s.state = State.Escape; // aborted sequence
          } else if (code < 0x20) {
            control(code); // C0 controls execute mid-sequence
          } else {
            s.buffer += ch;
            if (s.buffer.length > 256) s.state = State.Ground; // malformed
          }
          break;
        case State.Osc:
          if (code === 0x07) {
            s.state = State.Ground;
            osc(s.buffer);
          } else if (code === 0x1b) {
            s.state = State.OscEscape;
          } else if (s.buffer.length < 4096) {
            s.buffer += ch;
          }
          break;
        case State.OscEscape:
          s.state = State.Ground;
          osc(s.buffer);
          if (ch !== "\\") escape(ch);
          break;
        case State.String:
          if (code === 0x1b) s.state = State.StringEscape;
          else if (code === 0x07) s.state = State.Ground;
          break;
        case State.StringEscape:
          s.state = ch === "\\" ? State.Ground : State.String;
          break;
      }
    }
  }

  function resize(cols: number, rows: number) {
    const nextCols = Math.max(1, Math.floor(cols));
    const nextRows = Math.max(1, Math.floor(rows));
    for (const buffer of [s.main, s.alt]) {
      for (const row of buffer) if (row.length > nextCols) row.length = nextCols;
    }
    if (nextRows < s.rows) {
      // Push rows above the cursor into scrollback so the cursor stays visible.
      const excess = s.rows - nextRows;
      const fromTop = Math.max(0, Math.min(excess, s.y - (nextRows - 1)));
      const removed = s.main.splice(0, fromTop);
      if (!s.usingAlt) s.scrollback.push(...removed);
      s.main.length = nextRows;
      s.alt.splice(0, fromTop);
      s.alt.length = nextRows;
      s.y -= fromTop;
    }
    for (const buffer of [s.main, s.alt]) {
      for (let i = 0; i < nextRows; i++) buffer[i] ??= [];
    }
    s.cols = nextCols;
    s.rows = nextRows;
    s.top = 0;
    s.bottom = nextRows - 1;
    moveTo(s.x, s.y);
  }

  function rowToLine(row: Row, cursorCol: number | undefined, positioned = false): CodeLine {
    const tokens: CodeToken[] = [];
    let text = "";
    let attr: Attr | undefined;
    let start = 0;
    let end = 0;
    const flush = () => {
      if (text) {
        const token: CodeToken = attr === undefined || attr === DEFAULT_ATTR ? { text } : withStyle({ text }, toStyle(attr));
        if (positioned) { token.column = start; token.columns = end - start; }
        if (attr?.href) token.href = attr.href;
        tokens.push(token);
      }
      text = "";
    };
    const cells = row;
    let col = cursorCol;
    if (col !== undefined && cells[col]?.ch === "" && col > 0) col--;
    const length = Math.max(cells.length, col === undefined ? 0 : col + 1);
    for (let x = 0; x < length; x++) {
      const cell = cells[x] ?? BLANK;
      if (cell.ch === "") continue;
      if (x === col || (positioned && cell.ch.length === 1 && DRAWN.test(cell.ch))) {
        flush();
        const token: CodeToken = { text: cell.ch };
        if (x === col) token.cursor = true;
        if (positioned) { token.column = x; token.columns = cell.wide ? 2 : 1; }
        tokens.push(withStyle(token, toStyle(cell.attr)));
        attr = undefined;
        continue;
      }
      if (cell.attr !== attr) {
        flush();
        attr = cell.attr;
      }
      if (!text) start = x;
      end = x + (cell.wide ? 2 : 1);
      text += cell.ch;
    }
    flush();
    return { tokens };
  }

  function snapshot(options: SnapshotOptions = {}): TerminalScreen {
    const includeScrollback = (options.scrollback ?? true) && !s.usingAlt;
    const above = includeScrollback ? s.scrollback : [];
    const showCursor = (options.cursor ?? true) && s.cursorVisible;
    const viewport = screen();
    const lines = [
      ...above.map((row) => rowToLine(row, undefined, options.positioned)),
      ...viewport.map((row, y) => rowToLine(row, showCursor && y === s.y ? s.x : undefined, options.positioned)),
    ];
    const cursorRow = above.length + s.y;
    if (options.trim) {
      let last = lines.length - 1;
      while (last > cursorRow && lines[last].tokens.length === 0) last--;
      // Without a visible cursor, trailing empty rows up to the cursor go too.
      if (!showCursor) while (last >= 0 && lines[last].tokens.length === 0) last--;
      lines.length = last + 1;
    }
    return {
      lines,
      cursor: { row: cursorRow, col: s.x, visible: s.cursorVisible },
      cols: s.cols,
      rows: s.rows,
      title: s.title,
    };
  }

  function clone(): VirtualTerminal {
    return fromState({
      ...s,
      main: s.main.map((row) => row.slice()),
      alt: s.alt.map((row) => row.slice()),
      scrollback: s.scrollback.slice(),
      charsets: [...s.charsets],
      saved: s.saved && { ...s.saved, charsets: [...s.saved.charsets] },
      savedMain: s.savedMain && { ...s.savedMain },
    });
  }

  const terminal = {
    get cols() { return s.cols; },
    get rows() { return s.rows; },
    get title() { return s.title; },
    write,
    resize,
    reset,
    snapshot,
    clone,
    [STATE]: s,
  };
  return terminal;
}

const STATE = Symbol("state");

function withStyle(token: CodeToken, style: TokenStyle | undefined): CodeToken {
  if (style) token.style = style;
  return token;
}

/**
 * Render a static ANSI string (e.g. captured CLI output) into code lines.
 * Bare `\n` is treated as a newline; lines are never wrapped.
 */
export function renderAnsi(text: string, options: { cols?: number } = {}): CodeLine[] {
  const source = text.replace(/\r\n/g, "\n");
  const lineCount = source.split("\n").length;
  const longest = source.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
  const terminal = createTerminal({
    cols: options.cols ?? Math.max(1, longest * 2 + 1),
    rows: Math.min(lineCount, 10_000),
    scrollback: 10_000,
    convertEol: true,
  });
  terminal.write(source);
  return terminal.snapshot({ trim: true, cursor: false }).lines;
}

const ANSI_SEQUENCE =
  // eslint-disable-next-line no-control-regex
  /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[PX^_][^\x1b]*\x1b\\|[()*+][\s\S]|[\s\S])|\x9b[0-?]*[ -/]*[@-~]/g;

/** Remove escape sequences, leaving printable text (for copy and transcripts). */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_SEQUENCE, "");
}
