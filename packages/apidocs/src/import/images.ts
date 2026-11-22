/**
 * The intrinsic size of an image from the first bytes of its file, so a page can give the image a width and a height
 * and reserve its box before it loads. Reads PNG, GIF, JPEG, WebP and SVG (its width and height attributes, else its
 * viewBox); anything else, or a file it cannot read, has no known size.
 */
export interface ImageSize {
  width: number;
  height: number;
}

export function imageSize(data: Uint8Array): ImageSize | undefined {
  const size = png(data) ?? gif(data) ?? jpeg(data) ?? webp(data) ?? svg(data);
  return size && size.width > 0 && size.height > 0 && size.width < 1e5 && size.height < 1e5 ? size : undefined;
}

const u16be = (d: Uint8Array, i: number) => (d[i]! << 8) | d[i + 1]!;
const u16le = (d: Uint8Array, i: number) => d[i]! | (d[i + 1]! << 8);
const u24le = (d: Uint8Array, i: number) => d[i]! | (d[i + 1]! << 8) | (d[i + 2]! << 16);
const u32be = (d: Uint8Array, i: number) => ((d[i]! << 24) >>> 0) + ((d[i + 1]! << 16) | (d[i + 2]! << 8) | d[i + 3]!);
const ascii = (d: Uint8Array, i: number, n: number) => String.fromCharCode(...d.subarray(i, i + n));

function png(d: Uint8Array): ImageSize | undefined {
  if (d.length < 24 || ascii(d, 1, 3) !== "PNG" || ascii(d, 12, 4) !== "IHDR") return undefined;
  return { width: u32be(d, 16), height: u32be(d, 20) };
}

function gif(d: Uint8Array): ImageSize | undefined {
  if (d.length < 10 || ascii(d, 0, 4) !== "GIF8") return undefined;
  return { width: u16le(d, 6), height: u16le(d, 8) };
}

function jpeg(d: Uint8Array): ImageSize | undefined {
  if (d.length < 4 || d[0] !== 0xff || d[1] !== 0xd8) return undefined;
  let i = 2;
  while (i + 9 < d.length) {
    if (d[i] !== 0xff) return undefined;
    const marker = d[i + 1]!;
    if (marker === 0xff) {
      i++;
      continue;
    }
    // Start-of-frame markers carry the size; DHT (c4), JPG (c8) and DAC (cc) share the range but do not.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: u16be(d, i + 7), height: u16be(d, i + 5) };
    }
    i += 2 + u16be(d, i + 2);
  }
  return undefined;
}

function webp(d: Uint8Array): ImageSize | undefined {
  if (d.length < 30 || ascii(d, 0, 4) !== "RIFF" || ascii(d, 8, 4) !== "WEBP") return undefined;
  const chunk = ascii(d, 12, 4);
  if (chunk === "VP8X") return { width: u24le(d, 24) + 1, height: u24le(d, 27) + 1 };
  if (chunk === "VP8 ") return { width: u16le(d, 26) & 0x3fff, height: u16le(d, 28) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = d[21]! | (d[22]! << 8) | (d[23]! << 16) | (d[24]! << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return undefined;
}

function svg(d: Uint8Array): ImageSize | undefined {
  const text = new TextDecoder().decode(d.subarray(0, 4096));
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (!tag) return undefined;
  const attr = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1];
  // Only plain pixel lengths count; a percentage or an em says nothing about the drawing's size.
  const px = (value: string | undefined) => (value && /^\s*\d+(\.\d+)?\s*(px)?\s*$/.test(value) ? Math.round(parseFloat(value)) : undefined);
  const width = px(attr("width"));
  const height = px(attr("height"));
  if (width && height) return { width, height };
  const box = attr("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (box && box.length === 4 && box.every(Number.isFinite)) return { width: Math.round(box[2]!), height: Math.round(box[3]!) };
  return undefined;
}
