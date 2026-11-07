/*
 * Box drawing and block elements, drawn by the stylesheet as a terminal draws them (cell-sized,
 * full row height), so block art meets across rows and box lines join. The character stays in
 * the DOM for copy; `code-surface.css` paints it.
 */

/** Box drawing by arm (up, down, left, right; `h` heavy), and the rounded and double corners. */
const ARMS: Record<string, string> = {
  "─": "lr", "━": "lrh", "│": "ud", "┃": "udh",
  "┌": "dr", "┐": "dl", "└": "ur", "┘": "ul",
  "├": "udr", "┤": "udl", "┬": "dlr", "┴": "ulr", "┼": "udlr",
};
const ARC = "╭dr╮dl╯ul╰ur";
const DOUBLE = "═lr║ud╔dr╗dl╚ur╝ul";

/** Block elements: each string lists a bar's eighths in order (1/8 first). */
const BARS: [string, string][] = [
  ["left", "▏▎▍▌▋▊▉"],
  ["lower", "▁▂▃▄▅▆▇"],
];

/** Characters a terminal draws itself rather than taking from the font. */
export const DRAWN = /[─-▟]/;

const pair = (table: string, ch: string) => {
  const at = table.indexOf(ch);
  return at < 0 ? undefined : table.slice(at + 1, at + 3);
};

function drawn(ch: string): string | undefined {
  if (!DRAWN.test(ch)) return undefined;
  if (ch === "█") return "eld-gb-full";
  const arms = ARMS[ch];
  if (arms) return [...arms].map((arm) => `eld-gx-${arm}`).join(" ");
  const arc = pair(ARC, ch);
  if (arc) return `eld-gx-arc eld-gx-arc-${arc}`;
  const double = pair(DOUBLE, ch);
  if (double) return `eld-gx-double eld-gx-double-${double}`;
  for (const [side, eighths] of BARS) {
    const at = eighths.indexOf(ch);
    if (at >= 0) return `eld-gb-${side} eld-gb-${at + 1}`;
  }
  const edge = { "▀": "upper 4", "▔": "upper 1", "▐": "right 4", "▕": "right 1" }[ch];
  if (edge) return `eld-gb-${edge.replace(" ", " eld-gb-")}`;
  const shade = "░▒▓".indexOf(ch);
  return shade < 0 ? undefined : `eld-gb-shade eld-gb-shade-${shade + 1}`;
}

/** Classes that draw `ch`, or `undefined` for a character the font sets. */
export function glyphClass(ch: string): string | undefined {
  const classes = drawn(ch);
  return classes && `eld-glyph ${classes}`;
}
