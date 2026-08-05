# ElideLogo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Elide's logo as a catalog component covering light/dark, square/full form, and vector/raster (svg/png/webp/avif) modes, built from the official `creatives-v2` artwork.

**Architecture:** A new framework-agnostic `@elide/brand` package holds the four extracted path strings as the single source of truth (`src/paths.ts`), a typed asset manifest (`src/manifest.ts`), and a build script that emits 8 standalone SVGs plus 72 raster renditions into `assets/`. `@elide/ui`'s rewritten `ElideLogo` inlines the vector by default and falls back to `<img>` for raster formats, resolving light/dark through a CSS class swap rather than JavaScript.

**Tech Stack:** TypeScript, React 19, Tailwind v4, tsup, vitest + @testing-library/react (jsdom), Storybook 10, bun workspaces + turbo, sharp (asset generation only).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-05-elide-logo-design.md`. Every requirement there applies.
- Relative imports only — no `@/` path alias.
- Colors come from `@elide/tokens` CSS variables or Tailwind utilities that resolve to them. The two brand hexes `#662d91` and `#e7008c` are the sole exception: they are artwork, and they are already literal in `tokens.css` as `--eld-brand-purple` / `--eld-brand-magenta`.
- No new runtime dependencies. `sharp` is a `packages/brand` **devDependency** used only by the asset script.
- Geometry is copied verbatim from `creatives-v2`. Never retrace, round, or hand-edit a `d` string.
- Square artwork viewBox: `0 0 102.700292 114.027098`. Full artwork viewBox: `0 0 272.122583 90.385516`.
- Raster 1x sizes: square `104×115`, full `273×92`. Scales `@1x`, `@2x`, `@3x`.
- Generated assets are committed to git.
- Theme is a `.dark` class on `<html>`. Never key logo theming off `prefers-color-scheme`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/brand/package.json` | Package manifest; `build` runs the asset script |
| `packages/brand/tsconfig.json` | Mirrors `packages/tokens/tsconfig.json` |
| `packages/brand/vitest.config.ts` | Node-environment unit tests for the manifest |
| `packages/brand/src/paths.ts` | The 4 verbatim `d` strings, viewBoxes, aspect ratios, gradient stops |
| `packages/brand/src/manifest.ts` | Typed form × variant × theme × format × scale matrix + `assetPath()` |
| `packages/brand/src/manifest.test.ts` | Manifest resolution tests |
| `packages/brand/src/index.ts` | Public surface |
| `packages/brand/scripts/build-assets.mjs` | `paths.ts` → 8 SVGs → png/webp/avif @1–3x |
| `packages/brand/scripts/verify-fidelity.mjs` | Diffs regenerated rasters against the delivered PNGs |
| `packages/brand/assets/**` | Generated, committed |
| `packages/ui/src/components/elide-logo.tsx` | The component (rewritten) |
| `packages/ui/src/components/elide-logo.test.tsx` | Unit tests (rewritten) |
| `packages/ui/src/stories/ElideLogo.stories.tsx` | Catalog stories |
| `packages/ui/src/components/app-nav.tsx` | `defaultLogo` becomes an explicit legacy composition |
| `packages/ui/src/index.ts` | Export the new types |
| `.changeset/*.md` | Minor bump for `@elide/ui`, initial release for `@elide/brand` |

---

### Task 1: `@elide/brand` scaffold + geometry

**Files:**
- Create: `packages/brand/package.json`, `packages/brand/tsconfig.json`, `packages/brand/src/paths.ts`, `packages/brand/src/index.ts`

**Interfaces:**
- Produces: `SQUARE_VIEWBOX`, `FULL_VIEWBOX`, `SQUARE_ASPECT`, `FULL_ASPECT`, `BRAND_PURPLE`, `BRAND_MAGENTA`, and `paths = { squareBody, squareRibbon, fullGlyph, fullWordmark }`.

- [ ] **Step 1: Extract the four path strings verbatim**

Source them with a script, never by hand:

```bash
python3 -c "
import re, json
def d(f): return re.findall(r'<path[^>]*?d=\"([^\"]+)\"', open(f).read())
sq = d('$HOME/txfer/creatives-v2/elide-block-black.svg')
fu = d('$HOME/txfer/creatives-v2/elide-mark-black.svg')
print(json.dumps({'squareBody': sq[0], 'squareRibbon': sq[1], 'fullGlyph': fu[0], 'fullWordmark': fu[1]}))
"
```

Expected lengths: `squareBody` 429, `squareRibbon` 2741, `fullGlyph` 2732, `fullWordmark` 3429.

- [ ] **Step 2: Write `src/paths.ts`** with those strings and the constants above, documenting the `creatives-v2` provenance of each.

- [ ] **Step 3: Scaffold the package** — `package.json` (`@elide/brand`, `type: module`, exports `.` and `./assets/*`, `files: ["dist","src","assets"]`, build script `tsc -p tsconfig.json && node scripts/build-assets.mjs`), `tsconfig.json` copied from `packages/tokens`, `src/index.ts` re-exporting `paths.ts`.

- [ ] **Step 4: Verify it compiles**

Run: `bun install && bun run --filter @elide/brand build`
Expected: PASS (the asset script does not exist yet — add it in Task 2 and rerun; for this step run `bunx tsc -p packages/brand/tsconfig.json` alone).

- [ ] **Step 5: Commit** — `feat(brand): extract Elide logo geometry from creatives-v2`

---

### Task 2: Asset generation + fidelity gate

**Files:**
- Create: `packages/brand/scripts/build-assets.mjs`, `packages/brand/scripts/verify-fidelity.mjs`
- Create (generated): `packages/brand/assets/{svg,png,webp,avif}/**`

**Interfaces:**
- Consumes: `paths.ts` from Task 1.
- Produces: the 8 named artworks on disk under the naming scheme `elide-<form>-<variant>[-<theme>][@<n>x].<ext>`.

- [ ] **Step 1: Add `sharp` as a devDependency** — `bun add -D --cwd packages/brand sharp`. If it fails to install or render, fall back to ImageMagick per the spec's Risk section.

- [ ] **Step 2: Write `build-assets.mjs`** emitting the 8 SVGs from `paths.ts`:

| Artwork | Composition |
| --- | --- |
| `elide-square-gradient` | `squareBody` filled with the vertical gradient (`#662d91` at y=114.027098 → `#e7008c` at y=0); `squareRibbon` filled `#ffffff` |
| `elide-square-mono-light` | single path `squareBody + " " + squareRibbon`, `fill-rule="evenodd"`, `#000000` |
| `elide-square-mono-dark` | same, `#ffffff` |
| `elide-full-gradient` | `fullGlyph` with a vertical gradient over its bbox; `fullWordmark` with a horizontal gradient `x1=92.919817 → x2=272.344807` |
| `elide-full-mono-light` | both paths `#000000` |
| `elide-full-mono-dark` | both paths `#ffffff` |
| `elide-full-blend-light` | `fullGlyph` gradient; `fullWordmark` `#000000` |
| `elide-full-blend-dark` | `fullGlyph` gradient; `fullWordmark` `#ffffff` |

Then rasterize each to png/webp/avif at 1x/2x/3x off the base sizes.

- [ ] **Step 3: Write `verify-fidelity.mjs`** — render `elide-square-mono-light`, `elide-square-gradient`, and `elide-full-mono-light` at the delivered PNGs' exact dimensions and compare pixel-by-pixel against `~/txfer/creatives-v2/elide-block-black.png`, `elide-block-gradient.png`, and `elide-mark-black.png`. Report mean absolute error per channel.

- [ ] **Step 4: Run the fidelity gate**

Run: `node packages/brand/scripts/verify-fidelity.mjs`
Expected: mean absolute error within antialiasing noise on all three. A structural mismatch means the `evenodd` composition or a gradient geometry is wrong — fix before continuing. This gate is what justifies the whole rebuild-from-paths approach.

- [ ] **Step 5: Generate and commit** — `node packages/brand/scripts/build-assets.mjs`, then commit the script and `assets/`.

---

### Task 3: Typed asset manifest

**Files:**
- Create: `packages/brand/src/manifest.ts`, `packages/brand/src/manifest.test.ts`, `packages/brand/vitest.config.ts`
- Modify: `packages/brand/src/index.ts`

**Interfaces:**
- Produces:
  ```ts
  type BrandForm = "square" | "full";
  type BrandVariant = "gradient" | "mono" | "blend";
  type BrandFormat = "svg" | "png" | "webp" | "avif";
  type BrandTheme = "light" | "dark";
  function isThemed(form: BrandForm, variant: BrandVariant): boolean;
  function resolveVariant(form: BrandForm, variant: BrandVariant): BrandVariant;
  function assetPath(o: { form; variant; format; theme?; scale?; base? }): string;
  const BASE_SIZE: Record<BrandForm, { width: number; height: number }>;
  ```
  `resolveVariant` collapses `blend` → `gradient` on `square`. `isThemed` is false for `gradient`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { assetPath, isThemed, resolveVariant, BASE_SIZE } from "./manifest";

describe("manifest", () => {
  it("collapses blend to gradient on the square form", () => {
    expect(resolveVariant("square", "blend")).toBe("gradient");
    expect(resolveVariant("full", "blend")).toBe("blend");
  });

  it("treats gradient as theme-agnostic", () => {
    expect(isThemed("full", "gradient")).toBe(false);
    expect(isThemed("full", "mono")).toBe(true);
    expect(isThemed("full", "blend")).toBe(true);
    expect(isThemed("square", "blend")).toBe(false); // resolves to gradient
  });

  it("omits the theme segment for gradient and the scale suffix at 1x svg", () => {
    expect(assetPath({ form: "full", variant: "gradient", format: "svg" }))
      .toBe("/brand/svg/elide-full-gradient.svg");
  });

  it("includes theme and scale for raster themed artwork", () => {
    expect(assetPath({ form: "full", variant: "blend", format: "webp", theme: "dark", scale: 2 }))
      .toBe("/brand/webp/elide-full-blend-dark@2x.webp");
  });

  it("honors a custom base", () => {
    expect(assetPath({ form: "square", variant: "mono", format: "avif", theme: "light", base: "/static/art" }))
      .toBe("/static/art/avif/elide-square-mono-light.avif");
  });

  it("exposes 1x base sizes matching the delivered artwork", () => {
    expect(BASE_SIZE.square).toEqual({ width: 104, height: 115 });
    expect(BASE_SIZE.full).toEqual({ width: 273, height: 92 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run --filter @elide/brand test`
Expected: FAIL — `./manifest` does not exist.

- [ ] **Step 3: Implement `manifest.ts`** to satisfy exactly those cases; SVG never takes a scale suffix.

- [ ] **Step 4: Run to verify it passes** — Expected: 6 passing.

- [ ] **Step 5: Commit** — `feat(brand): typed asset manifest`

---

### Task 4: Rewrite `ElideLogo`

**Files:**
- Modify: `packages/ui/src/components/elide-logo.tsx`, `packages/ui/src/components/app-nav.tsx`, `packages/ui/src/index.ts`, `packages/ui/package.json`
- Test: `packages/ui/src/components/elide-logo.test.tsx`

**Interfaces:**
- Consumes: `@elide/brand` — `paths`, `assetPath`, `resolveVariant`, `isThemed`, `BASE_SIZE`, viewBox and aspect constants.
- Produces: `ElideLogo`, `ElideLogoProps`, `ElideLogoForm`, `ElideLogoVariant`, `ElideLogoFormat`; `ElideMark` and `ElideWordmark` unchanged in output.

- [ ] **Step 1: Add the workspace dependency** — `"@elide/brand": "workspace:*"` in `packages/ui/package.json`, then `bun install`.

- [ ] **Step 2: Write the failing tests** covering, at minimum:
  - default render is the full lockup, one inline `<svg>`, accessible name `Elide`
  - `form="square"` renders the square viewBox
  - `variant="mono"` uses `currentColor` and emits no `linearGradient`
  - `variant="blend"` on `full` emits a gradient glyph and a `currentColor` wordmark
  - `variant="blend"` on `square` renders identically to `variant="gradient"`
  - two instances get distinct gradient ids
  - `decorative` sets `aria-hidden` and removes the accessible name
  - `format="png" | "webp" | "avif"` renders `<img>` with the right extension in `src`, a `srcSet` carrying `2x` and `3x`, and intrinsic `width`/`height`
  - themed variants render a light/dark `<img>` pair (`dark:hidden`, `hidden dark:block`); `gradient` renders one `<img>`
  - `assetBase` overrides the URL prefix
  - `linked` renders `<img>` pointing at the `.svg`
  - `height` sets the height and derives the width from the aspect ratio
  - `markOnly` still yields the square form
  - `ElideMark` / `ElideWordmark` keep their current output and unique-id behavior

- [ ] **Step 3: Run to verify they fail**

Run: `bun run --filter @elide/ui test -- elide-logo`
Expected: FAIL.

- [ ] **Step 4: Implement the component** per the spec's API block. Inline vector for `format="svg"` unless `linked`; `<img>` otherwise; gradient ids from `React.useId()`; default classes `h-6 w-auto`; wrapper carries `text-foreground` so `mono`/`blend` invert with the theme.

- [ ] **Step 5: Keep `AppNav` visually unchanged** — replace `const defaultLogo = <ElideLogo />` with the explicit `ElideMark` + `ElideWordmark` span currently living in `elide-logo.tsx` (gap `9px`, mark `h-[23px]`, wordmark `h-[14px]` and `aria-hidden`).

- [ ] **Step 6: Run the full UI suite**

Run: `bun run --filter @elide/ui test`
Expected: PASS, including the untouched `app-nav.test.tsx`.

- [ ] **Step 7: Commit** — `feat(ui): ElideLogo with form, variant and format axes`

---

### Task 5: Stories, docs, changeset, verification

**Files:**
- Create: `packages/ui/src/stories/ElideLogo.stories.tsx`, `.changeset/<name>.md`
- Modify: `COMPONENTS.md`, `ARCHITECTURE.md`, `packages/brand/README.md`

- [ ] **Step 1: Write the stories** — one per `form × variant`, plus format, sizing, `decorative`, and an on-dark-surface story. Chromatic captures each in both themes automatically.

- [ ] **Step 2: Document** — add `ElideLogo` to the `COMPONENTS.md` Tier-2 table, add `@elide/brand` to the `ARCHITECTURE.md` layer diagram and repo layout, and write `packages/brand/README.md` covering the artwork matrix, the asset naming scheme, how to regenerate, and how consumers serve `assets/`.

- [ ] **Step 3: Add a changeset** — minor for `@elide/ui` (noting the breaking change to `<ElideLogo />`'s default render), initial minor for `@elide/brand`.

- [ ] **Step 4: Verify the whole repo**

Run: `bun run lint && bun run test && bun run build`
Expected: all PASS. Confirm coverage has not regressed below the catalog's 97% statement bar.

- [ ] **Step 5: Commit** — `docs: ElideLogo stories, brand README, changeset`

---

## Self-Review

**Spec coverage.** Source mapping → Task 1. Vector source of truth and the mono `evenodd` knockout → Tasks 1–2. Package layout → Tasks 1–3. Artwork matrix and raster ladder → Task 2. Manifest → Task 3. Component API, sizing, gradient ids, light/dark class swap → Task 4. Back-compat and `AppNav` → Task 4 Steps 5–6. Testing → Tasks 2–5. Risk (sharp vs ImageMagick) → Task 2 Step 1. Out-of-scope items are absent from every task, as intended.

**Type consistency.** `resolveVariant`, `isThemed`, `assetPath`, `BASE_SIZE` are defined in Task 3 and consumed under those exact names in Task 4. `paths.{squareBody,squareRibbon,fullGlyph,fullWordmark}` is defined in Task 1 and used under those names in Tasks 2 and 4.
