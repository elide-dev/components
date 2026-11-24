/**
 * Guide glyphs (theme.guideIcons) are symbols from whatever font the reader has, and their ink differs in size and
 * sits off center in the em box: "≈" fills a third of what "⧉" does, and most sit high. In a 17px tile that shows.
 * This measures each glyph's ink in the font it is drawn in and moves and scales it to the tile's center at one size.
 * The tile and the layout do not change, only a transform on the symbol inside the tile, so nothing moves around it.
 */

/** The ink's larger side, as a share of the font size, that every glyph is scaled toward. */
const TARGET = 0.9;
/** How far a glyph may be scaled: enough to even them out, not enough to blur a small one. */
const MIN = 0.8;
const MAX = 1.4;

const fitted = new Map<string, string>();

function transform(context: CanvasRenderingContext2D, text: string, font: string, size: number): string {
  const key = `${font}\u0000${text}`;
  const known = fitted.get(key);
  if (known !== undefined) return known;
  context.font = font;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const m = context.measureText(text);
  const width = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const height = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  let value = "";
  if (width > 0 && height > 0) {
    // The ink's center, from the em box's center; the tile centers the em box.
    const dx = (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
    const dy = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    const scale = Math.min(MAX, Math.max(MIN, (TARGET * size) / Math.max(width, height)));
    const round = (n: number) => Math.round(n * 100) / 100;
    value = `scale(${round(scale)}) translate(${round(dx)}px, ${round(dy)}px)`;
  }
  fitted.set(key, value);
  return value;
}

export function fitGlyphs(root: ParentNode = document) {
  const fit = () => {
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return;
    for (const glyph of root.querySelectorAll<HTMLElement>('.glyph[data-tone="guide"]')) {
      const text = glyph.textContent?.trim();
      if (!text) continue;
      const style = getComputedStyle(glyph);
      const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const value = transform(context, text, font, parseFloat(style.fontSize));
      if (!value) continue;
      // The symbol moves inside its tile, so it is wrapped once in an element of its own.
      let ink = glyph.firstElementChild as HTMLElement | null;
      if (!ink) {
        ink = document.createElement("span");
        ink.className = "glyph-ink";
        ink.textContent = glyph.textContent;
        glyph.replaceChildren(ink);
      }
      ink.style.transform = value;
    }
  };
  // Measured in the page's own fonts, once they have loaded.
  if (document.fonts?.status === "loaded") fit();
  else void document.fonts?.ready.then(fit);
}
