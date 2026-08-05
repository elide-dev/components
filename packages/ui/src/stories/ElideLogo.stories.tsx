import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ElideLogo } from "../components/elide-logo";
import { AppNav } from "../components/app-nav";

const meta = {
  title: "Brand/ElideLogo",
  component: ElideLogo,
  parameters: { layout: "centered" },
  argTypes: {
    form: { control: "inline-radio", options: ["full", "square"] },
    variant: { control: "inline-radio", options: ["gradient", "mono", "blend"] },
    format: { control: "inline-radio", options: ["svg", "png", "webp", "avif"] },
    height: { control: { type: "range", min: 16, max: 160, step: 2 } },
    linked: { control: "boolean" },
    decorative: { control: "boolean" },
  },
  args: { form: "full", variant: "gradient", format: "svg", height: 48 },
} satisfies Meta<typeof ElideLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Grid cell with a caption, so a story reads as a labeled matrix. */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ display: "grid", placeItems: "center", minHeight: 72 }}>{children}</div>
      <code style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--eld-font-mono)" }}>
        {label}
      </code>
    </div>
  );
}

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: 40,
  flexWrap: "wrap",
  justifyContent: "center",
};

export const Playground: Story = {};

/**
 * The two forms across all three variants. `blend` is only distinct on the full
 * lockup — on the square it resolves to `gradient`, which is what blend means
 * there. Toggle the theme in the toolbar: `mono` and `blend` follow the text
 * color, so they invert with no asset swap.
 */
export const Matrix: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      <div style={row}>
        <Cell label='form="full" variant="gradient"'>
          <ElideLogo form="full" variant="gradient" height={44} />
        </Cell>
        <Cell label='form="full" variant="blend"'>
          <ElideLogo form="full" variant="blend" height={44} />
        </Cell>
        <Cell label='form="full" variant="mono"'>
          <ElideLogo form="full" variant="mono" height={44} />
        </Cell>
      </div>
      <div style={row}>
        <Cell label='form="square" variant="gradient"'>
          <ElideLogo form="square" variant="gradient" height={72} />
        </Cell>
        <Cell label='form="square" variant="blend" (→ gradient)'>
          <ElideLogo form="square" variant="blend" height={72} />
        </Cell>
        <Cell label='form="square" variant="mono"'>
          <ElideLogo form="square" variant="mono" height={72} />
        </Cell>
      </div>
    </div>
  ),
};

/**
 * The square mono ribbon is punched through rather than painted white, so the
 * surface behind it shows through. These sit on tinted panels to make that
 * visible — on a plain background it is indistinguishable from the original.
 */
export const MonoOnSurfaces: Story = {
  render: () => (
    <div style={row}>
      {[
        { bg: "var(--eld-magenta-500, #e7008c)", fg: "#ffffff", label: "on brand" },
        { bg: "var(--muted)", fg: "var(--foreground)", label: "on muted" },
        { bg: "var(--card)", fg: "var(--foreground)", label: "on card" },
      ].map(({ bg, fg, label }) => (
        <Cell key={label} label={label}>
          <div
            style={{
              background: bg,
              color: fg,
              padding: 20,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
            }}
          >
            <ElideLogo form="square" variant="mono" height={64} />
          </div>
        </Cell>
      ))}
    </div>
  ),
};

/**
 * Vector versus raster. All four render the same artwork; `svg` inlines it with
 * no request, the rest load from `@elide/brand/assets` at `assetBase`
 * (`/brand` by default, served here by Storybook's staticDirs).
 */
export const Formats: Story = {
  render: () => (
    <div style={row}>
      {(["svg", "png", "webp", "avif"] as const).map((format) => (
        <Cell key={format} label={`format="${format}"`}>
          <ElideLogo form="full" variant="blend" format={format} height={40} />
        </Cell>
      ))}
      <Cell label="linked (external .svg)">
        <ElideLogo form="full" variant="blend" linked height={40} />
      </Cell>
    </div>
  ),
};

/**
 * Raster `mono` and `blend` ship a light and a dark cut, swapped by the `.dark`
 * class rather than by JavaScript. Flip the theme in the toolbar — the wordmark
 * inverts while the gradient glyph stays put.
 */
export const RasterThemeSwap: Story = {
  render: () => (
    <div style={row}>
      <Cell label='variant="blend" format="webp"'>
        <ElideLogo form="full" variant="blend" format="webp" height={40} />
      </Cell>
      <Cell label='variant="mono" format="webp"'>
        <ElideLogo form="full" variant="mono" format="webp" height={40} />
      </Cell>
      <Cell label='variant="gradient" (one asset)'>
        <ElideLogo form="full" variant="gradient" format="webp" height={40} />
      </Cell>
    </div>
  ),
  /**
   * Asserts the swap in real CSS, which is the only place it can be checked:
   * jsdom sees the `dark:hidden` / `hidden dark:block` class names but never
   * evaluates them, so a unit test passes even when the variant is misconfigured
   * and both themes show the light cut. That exact bug shipped once — Tailwind
   * v4's default `dark:` is a `prefers-color-scheme` media query, so it ignored
   * the `.dark` class until `styles.css` bound it with `@custom-variant`.
   */
  play: async ({ canvasElement }) => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    // Queried by selector, not by role: the dark cut carries alt="" so the pair
    // is announced once, which also makes it presentational and invisible to
    // getAllByRole("img").
    const shown = (src: string) => {
      const img = canvasElement.querySelector<HTMLImageElement>(`img[src$="${src}"]`);
      if (!img) throw new Error(`no <img> for ${src}`);
      return getComputedStyle(img).display !== "none";
    };

    try {
      root.classList.remove("dark");
      await expect(shown("elide-full-blend-light.webp")).toBe(true);
      await expect(shown("elide-full-blend-dark.webp")).toBe(false);

      root.classList.add("dark");
      await expect(shown("elide-full-blend-light.webp")).toBe(false);
      await expect(shown("elide-full-blend-dark.webp")).toBe(true);

      // The theme-agnostic gradient stays visible either way.
      await expect(shown("elide-full-gradient.webp")).toBe(true);
    } finally {
      root.classList.toggle("dark", wasDark);
    }
  },
};

/** Width always follows the artwork's aspect ratio; nothing is ever stretched. */
export const Sizes: Story = {
  render: () => (
    <div style={row}>
      {[16, 24, 32, 48, 72, 112].map((height) => (
        <Cell key={height} label={`height={${height}}`}>
          <ElideLogo form="full" variant="blend" height={height} />
        </Cell>
      ))}
    </div>
  ),
};

/**
 * The nav keeps its own lockup — the filled badge beside the wider wordmark
 * cut — which is different artwork from `<ElideLogo form="full" />`. Pass
 * `logo` to adopt the official lockup instead.
 */
export const InAppNav: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <AppNav links={[{ label: "Docs", href: "#", active: true }, { label: "Blog", href: "#" }]} />
      <AppNav
        links={[{ label: "Docs", href: "#", active: true }, { label: "Blog", href: "#" }]}
        logo={<ElideLogo variant="blend" height={24} />}
      />
    </div>
  ),
};
