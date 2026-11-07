/*
 * Box drawing and block elements, drawn by the stylesheet as a terminal draws them (cell-sized,
 * full row height), so block art meets across rows and box lines join. The character stays in
 * the DOM for copy; `code-surface.css` paints it.
 */

/** Arms (up, down, left, right), heavy, rounded and double box-drawing glyphs. */
const BOX: Record<string, string> = {
  "─": "eld-gx-l eld-gx-r",
  "━": "eld-gx-l eld-gx-r eld-gx-heavy",
  "│": "eld-gx-u eld-gx-d",
  "┃": "eld-gx-u eld-gx-d eld-gx-heavy",
  "┌": "eld-gx-d eld-gx-r",
  "┐": "eld-gx-d eld-gx-l",
  "└": "eld-gx-u eld-gx-r",
  "┘": "eld-gx-u eld-gx-l",
  "├": "eld-gx-u eld-gx-d eld-gx-r",
  "┤": "eld-gx-u eld-gx-d eld-gx-l",
  "┬": "eld-gx-d eld-gx-l eld-gx-r",
  "┴": "eld-gx-u eld-gx-l eld-gx-r",
  "┼": "eld-gx-u eld-gx-d eld-gx-l eld-gx-r",
  "╭": "eld-gx-arc eld-gx-arc-dr",
  "╮": "eld-gx-arc eld-gx-arc-dl",
  "╯": "eld-gx-arc eld-gx-arc-ul",
  "╰": "eld-gx-arc eld-gx-arc-ur",
  "═": "eld-gx-double eld-gx-double-lr",
  "║": "eld-gx-double eld-gx-double-ud",
  "╔": "eld-gx-double eld-gx-double-dr",
  "╗": "eld-gx-double eld-gx-double-dl",
  "╚": "eld-gx-double eld-gx-double-ur",
  "╝": "eld-gx-double eld-gx-double-ul",
};

/** Block elements: left bars, lower bars, halves and shades. */
const BLOCK: Record<string, string> = {
  "█": "eld-gb-full",
  "▉": "eld-gb-left eld-gb-7",
  "▊": "eld-gb-left eld-gb-6",
  "▋": "eld-gb-left eld-gb-5",
  "▌": "eld-gb-left eld-gb-4",
  "▍": "eld-gb-left eld-gb-3",
  "▎": "eld-gb-left eld-gb-2",
  "▏": "eld-gb-left eld-gb-1",
  "▐": "eld-gb-right eld-gb-4",
  "▕": "eld-gb-right eld-gb-1",
  "▁": "eld-gb-lower eld-gb-1",
  "▂": "eld-gb-lower eld-gb-2",
  "▃": "eld-gb-lower eld-gb-3",
  "▄": "eld-gb-lower eld-gb-4",
  "▅": "eld-gb-lower eld-gb-5",
  "▆": "eld-gb-lower eld-gb-6",
  "▇": "eld-gb-lower eld-gb-7",
  "▀": "eld-gb-upper eld-gb-4",
  "▔": "eld-gb-upper eld-gb-1",
  "░": "eld-gb-shade eld-gb-shade-1",
  "▒": "eld-gb-shade eld-gb-shade-2",
  "▓": "eld-gb-shade eld-gb-shade-3",
};

/** Characters a terminal draws itself rather than taking from the font. */
export const DRAWN = /[─-▟]/;

/** Classes that draw `ch`, or `undefined` for a character the font sets. */
export function glyphClass(ch: string): string | undefined {
  const drawn = BOX[ch] ?? BLOCK[ch];
  return drawn ? `eld-glyph ${drawn}` : undefined;
}
