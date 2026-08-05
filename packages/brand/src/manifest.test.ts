import { describe, it, expect } from "vitest";
import {
  assetPath,
  isThemed,
  resolveVariant,
  BASE_SIZE,
  DEFAULT_ASSET_BASE,
  artworkName,
  ARTWORKS,
} from "./manifest.js";

describe("resolveVariant", () => {
  it("collapses blend to gradient on the square form", () => {
    // The square artwork has no separate blend cut — gradient body plus a
    // knockout ribbon is what "blend" means there.
    expect(resolveVariant("square", "blend")).toBe("gradient");
  });

  it("leaves blend alone on the full form", () => {
    expect(resolveVariant("full", "blend")).toBe("blend");
  });

  it("passes through the other variants unchanged", () => {
    expect(resolveVariant("square", "mono")).toBe("mono");
    expect(resolveVariant("full", "gradient")).toBe("gradient");
  });
});

describe("isThemed", () => {
  it("treats gradient as theme-agnostic", () => {
    expect(isThemed("full", "gradient")).toBe(false);
    expect(isThemed("square", "gradient")).toBe(false);
  });

  it("treats mono and blend as theme-dependent", () => {
    expect(isThemed("full", "mono")).toBe(true);
    expect(isThemed("square", "mono")).toBe(true);
    expect(isThemed("full", "blend")).toBe(true);
  });

  it("follows the blend-to-gradient collapse on square", () => {
    expect(isThemed("square", "blend")).toBe(false);
  });
});

describe("artworkName", () => {
  it("omits the theme segment for gradient", () => {
    expect(artworkName("full", "gradient")).toBe("elide-full-gradient");
  });

  it("includes the theme segment for themed artwork", () => {
    expect(artworkName("full", "blend", "dark")).toBe("elide-full-blend-dark");
    expect(artworkName("square", "mono", "light")).toBe("elide-square-mono-light");
  });

  it("defaults themed artwork to the light cut", () => {
    expect(artworkName("square", "mono")).toBe("elide-square-mono-light");
  });

  it("enumerates exactly the eight artworks the build script emits", () => {
    expect(ARTWORKS).toHaveLength(8);
    expect(ARTWORKS.map((a) => a.name)).toEqual([
      "elide-square-gradient",
      "elide-square-mono-light",
      "elide-square-mono-dark",
      "elide-full-gradient",
      "elide-full-mono-light",
      "elide-full-mono-dark",
      "elide-full-blend-light",
      "elide-full-blend-dark",
    ]);
  });
});

describe("assetPath", () => {
  it("builds an svg path with no scale suffix", () => {
    expect(assetPath({ form: "full", variant: "gradient", format: "svg" })).toBe(
      "/brand/svg/elide-full-gradient.svg",
    );
  });

  it("ignores a scale on svg, which is resolution-independent", () => {
    expect(assetPath({ form: "full", variant: "gradient", format: "svg", scale: 3 })).toBe(
      "/brand/svg/elide-full-gradient.svg",
    );
  });

  it("omits the @1x suffix on raster", () => {
    expect(assetPath({ form: "square", variant: "gradient", format: "png" })).toBe(
      "/brand/png/elide-square-gradient.png",
    );
  });

  it("includes theme and scale for themed raster artwork", () => {
    expect(
      assetPath({ form: "full", variant: "blend", format: "webp", theme: "dark", scale: 2 }),
    ).toBe("/brand/webp/elide-full-blend-dark@2x.webp");
  });

  it("honors a custom base", () => {
    expect(
      assetPath({
        form: "square",
        variant: "mono",
        format: "avif",
        theme: "light",
        base: "/static/art",
      }),
    ).toBe("/static/art/avif/elide-square-mono-light.avif");
  });

  it("strips a trailing slash from the base", () => {
    expect(
      assetPath({ form: "full", variant: "gradient", format: "png", base: "/assets/" }),
    ).toBe("/assets/png/elide-full-gradient.png");
  });

  it("supports an absolute base", () => {
    expect(
      assetPath({ form: "full", variant: "gradient", format: "png", base: "https://cdn.elide.dev/b" }),
    ).toBe("https://cdn.elide.dev/b/png/elide-full-gradient.png");
  });

  it("resolves blend on square to the gradient artwork", () => {
    expect(assetPath({ form: "square", variant: "blend", format: "png", theme: "dark" })).toBe(
      "/brand/png/elide-square-gradient.png",
    );
  });

  it("defaults to /brand", () => {
    expect(DEFAULT_ASSET_BASE).toBe("/brand");
  });
});

describe("BASE_SIZE", () => {
  it("matches the delivered artwork's natural pixel size", () => {
    expect(BASE_SIZE.square).toEqual({ width: 104, height: 115 });
    expect(BASE_SIZE.full).toEqual({ width: 273, height: 92 });
  });
});
