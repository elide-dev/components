/**
 * sRGB hex colors as CSS oklch(), precisely enough that a browser draws the same 8-bit color: lightness to 0.001%,
 * chroma to 0.00001 and hue to 0.001 degree keep every channel within half a step (0.5/255) of the original, so it
 * rounds back to it (test/color.test.ts checks every color the stylesheet and the presets use, and a random sample).
 * A gray, with no chroma at that precision, is written with a hue of none. Björn Ottosson's OKLab matrices, as CSS
 * Color 4 uses them.
 */

/** [r, g, b] in 0..1 from #rgb, #rrggbb or #rrggbbaa (alpha is returned separately). */
export function parseHex(hex: string): { rgb: [number, number, number]; alpha: number } {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join("");
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) throw new Error(`Not a hex color: ${hex}`);
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { rgb: [n(0), n(2), n(4)], alpha: h.length === 8 ? n(6) : 1 };
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** OKLCH [L 0..1, C, H degrees] of an sRGB color. */
export function srgbToOklch([r, g, b]: [number, number, number]): [number, number, number] {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}

/** sRGB (0..1, unclamped) of an OKLCH color. */
export function oklchToSrgb([L, C, H]: [number, number, number]): [number, number, number] {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));

/** The oklch() for a hex color, with an optional alpha (0..1) written as "/ a". */
export function oklch(hex: string, alpha?: number): string {
  const parsed = parseHex(hex);
  const [L, C, H] = srgbToOklch(parsed.rgb);
  const c = Number(C.toFixed(5));
  const a = alpha ?? parsed.alpha;
  return `oklch(${trim(L * 100, 3)}% ${c === 0 ? "0" : trim(c, 5)} ${c === 0 ? "none" : trim(H, 3)}${a < 1 ? ` / ${trim(a, 3)}` : ""})`;
}

/** The sRGB channels (0..1) an oklch() string written by oklch() stands for, to check a conversion. */
export function parseOklch(css: string): { rgb: [number, number, number]; alpha: number } {
  const m = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+|none)(?:\s*\/\s*([\d.]+))?\s*\)$/.exec(css.trim());
  if (!m) throw new Error(`Not an oklch() color: ${css}`);
  const rgb = oklchToSrgb([Number(m[1]) / 100, Number(m[2]), m[3] === "none" ? 0 : Number(m[3])]);
  return { rgb, alpha: m[4] === undefined ? 1 : Number(m[4]) };
}

/** WCAG 2 relative luminance of an sRGB color (0..1 channels). */
export function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2 contrast ratio of two sRGB colors. */
export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
