import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ElideLogo, ElideMark, ElideWordmark } from "./elide-logo";

/** The single <svg> rendered in vector mode. */
function svg(container: HTMLElement): SVGSVGElement {
  const el = container.querySelector("svg");
  if (!el) throw new Error("expected an inline <svg>");
  return el;
}

const SQUARE_VIEWBOX = "0 0 102.700292 114.027098";
const FULL_VIEWBOX = "0 0 272.122583 90.385516";

describe("ElideLogo — form", () => {
  it("renders the full lockup by default", () => {
    const { container } = render(<ElideLogo />);
    expect(svg(container)).toHaveAttribute("viewBox", FULL_VIEWBOX);
    expect(container.querySelectorAll("path")).toHaveLength(2);
  });

  it("renders the square badge on form=square", () => {
    const { container } = render(<ElideLogo form="square" />);
    expect(svg(container)).toHaveAttribute("viewBox", SQUARE_VIEWBOX);
  });

  it("treats the deprecated markOnly prop as form=square", () => {
    const { container } = render(<ElideLogo markOnly />);
    expect(svg(container)).toHaveAttribute("viewBox", SQUARE_VIEWBOX);
  });

  it("lets an explicit form win over markOnly", () => {
    const { container } = render(<ElideLogo markOnly form="full" />);
    expect(svg(container)).toHaveAttribute("viewBox", FULL_VIEWBOX);
  });
});

describe("ElideLogo — variant", () => {
  it("fills the gradient variant from a gradient, not currentColor", () => {
    const { container } = render(<ElideLogo variant="gradient" />);
    expect(container.querySelectorAll("linearGradient").length).toBeGreaterThan(0);
    const fills = Array.from(container.querySelectorAll("path")).map((p) => p.getAttribute("fill"));
    expect(fills.every((f) => f?.startsWith("url(#"))).toBe(true);
  });

  it("fills the mono variant with currentColor and defines no gradient", () => {
    const { container } = render(<ElideLogo variant="mono" />);
    expect(container.querySelector("linearGradient")).not.toBeInTheDocument();
    const fills = Array.from(container.querySelectorAll("path")).map((p) => p.getAttribute("fill"));
    expect(fills).toEqual(["currentColor", "currentColor"]);
  });

  it("punches the square mono ribbon through with evenodd rather than painting it white", () => {
    const { container } = render(<ElideLogo form="square" variant="mono" />);
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(1);
    expect(paths[0]).toHaveAttribute("fill-rule", "evenodd");
    expect(paths[0].getAttribute("fill")).toBe("currentColor");
  });

  it("keeps the opaque white ribbon on the square gradient, as the artwork specifies", () => {
    const { container } = render(<ElideLogo form="square" variant="gradient" />);
    const fills = Array.from(container.querySelectorAll("path")).map((p) => p.getAttribute("fill"));
    expect(fills[1]).toBe("#ffffff");
  });

  it("gives blend a gradient glyph and a currentColor wordmark", () => {
    const { container } = render(<ElideLogo form="full" variant="blend" />);
    const fills = Array.from(container.querySelectorAll("path")).map((p) => p.getAttribute("fill"));
    expect(fills[0]).toMatch(/^url\(#/);
    expect(fills[1]).toBe("currentColor");
  });

  it("renders square blend identically to square gradient — the square has no separate blend cut", () => {
    const blend = render(<ElideLogo form="square" variant="blend" />);
    const gradient = render(<ElideLogo form="square" variant="gradient" />);
    const strip = (c: HTMLElement) => c.innerHTML.replace(/(id|fill)="[^"]*"/g, "");
    expect(strip(blend.container)).toBe(strip(gradient.container));
  });

  it("gives each instance a distinct gradient id so multiple logos never collide", () => {
    const { container } = render(
      <>
        <ElideLogo variant="gradient" />
        <ElideLogo variant="gradient" />
      </>,
    );
    const ids = Array.from(container.querySelectorAll("linearGradient")).map((g) => g.id);
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points every gradient fill at a gradient that exists in the same document", () => {
    const { container } = render(<ElideLogo variant="gradient" />);
    for (const path of container.querySelectorAll("path")) {
      const id = path.getAttribute("fill")?.match(/^url\(#(.+)\)$/)?.[1];
      expect(id).toBeTruthy();
      expect(container.querySelector(`linearGradient[id="${CSS.escape(id!)}"]`)).toBeInTheDocument();
    }
  });
});

describe("ElideLogo — accessibility", () => {
  it("exposes a single image named Elide", () => {
    render(<ElideLogo />);
    expect(screen.getByRole("img", { name: "Elide" })).toBeInTheDocument();
  });

  it("accepts a custom accessible name", () => {
    render(<ElideLogo title="Elide home" />);
    expect(screen.getByRole("img", { name: "Elide home" })).toBeInTheDocument();
  });

  it("hides the logo from assistive tech when decorative", () => {
    const { container } = render(<ElideLogo decorative />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(svg(container)).toHaveAttribute("aria-hidden");
  });

  it("gives raster output an empty alt when decorative", () => {
    const { container } = render(<ElideLogo format="png" decorative />);
    for (const img of container.querySelectorAll("img")) {
      expect(img).toHaveAttribute("alt", "");
    }
  });
});

describe("ElideLogo — raster mode", () => {
  it.each(["png", "webp", "avif"] as const)("renders an <img> for format=%s", (format) => {
    const { container } = render(<ElideLogo format={format} />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", `/brand/${format}/elide-full-gradient.${format}`);
  });

  it("offers 2x and 3x in srcSet", () => {
    const { container } = render(<ElideLogo format="webp" />);
    const srcSet = container.querySelector("img")?.getAttribute("srcset") ?? "";
    expect(srcSet).toContain("elide-full-gradient@2x.webp 2x");
    expect(srcSet).toContain("elide-full-gradient@3x.webp 3x");
  });

  it("sets intrinsic width and height so the box is known before the image loads", () => {
    const { container } = render(<ElideLogo form="square" format="png" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("width", "104");
    expect(img).toHaveAttribute("height", "115");
  });

  it("honors a custom assetBase", () => {
    const { container } = render(<ElideLogo format="png" assetBase="https://cdn.elide.dev/brand" />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.elide.dev/brand/png/elide-full-gradient.png",
    );
  });

  it("links the .svg file instead of inlining it when linked is set", () => {
    const { container } = render(<ElideLogo linked />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/brand/svg/elide-full-gradient.svg",
    );
  });

  it("omits srcSet for linked svg, which needs no density ladder", () => {
    const { container } = render(<ElideLogo linked />);
    expect(container.querySelector("img")).not.toHaveAttribute("srcset");
  });

  it("ignores linked in vector mode's raster formats — format wins", () => {
    const { container } = render(<ElideLogo format="png" linked />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/brand/png/elide-full-gradient.png",
    );
  });
});

describe("ElideLogo — raster light/dark", () => {
  it("renders one image for the theme-agnostic gradient", () => {
    const { container } = render(<ElideLogo variant="gradient" format="png" />);
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("renders a light/dark pair for mono, toggled by the .dark class", () => {
    const { container } = render(<ElideLogo variant="mono" format="png" />);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute("src", "/brand/png/elide-full-mono-light.png");
    expect(imgs[0].className).toContain("dark:hidden");
    expect(imgs[1]).toHaveAttribute("src", "/brand/png/elide-full-mono-dark.png");
    expect(imgs[1].className).toContain("hidden");
    expect(imgs[1].className).toContain("dark:block");
  });

  it("renders a light/dark pair for blend", () => {
    const { container } = render(<ElideLogo variant="blend" format="avif" />);
    const srcs = Array.from(container.querySelectorAll("img")).map((i) => i.getAttribute("src"));
    expect(srcs).toEqual([
      "/brand/avif/elide-full-blend-light.avif",
      "/brand/avif/elide-full-blend-dark.avif",
    ]);
  });

  it("renders one image for square blend, which resolves to the gradient artwork", () => {
    const { container } = render(<ElideLogo form="square" variant="blend" format="png" />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute("src", "/brand/png/elide-square-gradient.png");
  });

  it("names only one image of the pair so the logo is announced once", () => {
    render(<ElideLogo variant="mono" format="png" />);
    expect(screen.getAllByRole("img", { name: "Elide" })).toHaveLength(1);
  });
});

describe("ElideLogo — sizing", () => {
  it("derives width from the artwork aspect ratio when height is given", () => {
    const { container } = render(<ElideLogo form="square" height={100} />);
    const el = svg(container);
    // 102.700292 / 114.027098 * 100
    expect(el).toHaveStyle({ height: "100px", width: "90.07px" });
  });

  it("derives the intrinsic raster box from height too", () => {
    const { container } = render(<ElideLogo form="full" format="png" height={46} />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("height", "46");
    expect(img).toHaveAttribute("width", "138");
  });

  it("falls back to a utility class when height is omitted", () => {
    const { container } = render(<ElideLogo />);
    expect(svg(container).className.baseVal).toContain("h-6");
  });

  it("lets className override the default size", () => {
    const { container } = render(<ElideLogo className="h-10" />);
    expect(svg(container).className.baseVal).toContain("h-10");
    expect(svg(container).className.baseVal).not.toContain("h-6");
  });
});

describe("back-compat", () => {
  it("ElideMark still renders the gradient square at its original size", () => {
    const { container } = render(<ElideMark />);
    const el = svg(container);
    expect(el).toHaveAttribute("viewBox", SQUARE_VIEWBOX);
    expect(el.className.baseVal).toContain("h-[23px]");
    expect(screen.getByRole("img", { name: "Elide" })).toBeInTheDocument();
  });

  it("ElideMark still gives each instance a distinct gradient id", () => {
    const { container } = render(
      <>
        <ElideMark />
        <ElideMark />
      </>,
    );
    const ids = Array.from(container.querySelectorAll("linearGradient")).map((g) => g.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("ElideWordmark still draws in currentColor", () => {
    const { container } = render(<ElideWordmark />);
    expect(container.querySelector("path")).toHaveAttribute("fill", "currentColor");
  });
});
