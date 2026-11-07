# @elide/tokens

## 0.2.0

### Minor Changes

- e17e4f7: Meet WCAG AA for every semantic text/surface pairing in both themes.
  
  `@elide/tokens` adds AA text steps per hue: `--eld-{info,success,warning,danger}-deep`
  for light surfaces, `--eld-{info,danger}-strong` to complete the dark-surface set,
  `--eld-neutral-550` and `--eld-magenta-750`. New theme-aware semantic tokens
  `--{info,success,warning,danger}-emphasis` (text and icons) and `--*-soft` (tints)
  pick the right step per theme, with Tailwind colors to match
  (`text-success-emphasis`, `bg-success-soft`, …). Light `--subtle-foreground` moves
  to neutral-550, light `--primary-emphasis` to magenta-750, and `--destructive` to
  the deep red so white text on it passes. `bun test` gates the pairings.
  
  `@elide/ui` reads status text from the emphasis tokens: Badge, SupportMatrix,
  SectionTabs, Callout labels (rules keep the base hue) and destructive
  DropdownMenu items.
- de132a4: Light code surfaces, assistant icons, leaner grammars, and a scene engine.
  
  - Editor code surfaces follow the theme: a soft warm white in light theme
    (`--eld-code-light-*`, `--eld-syntax-light-*`, all AA) and the dark panel in
    dark; terminals stay dark. Components read semantic `--code-syntax-*` and
    `--code-mark-*` tokens; `CodeSurface` takes `tone="adaptive" | "dark"`.
  - `AiActions` items take `assistant: "claude" | "chatgpt"` to show the
    assistant's mark; `ClaudeIcon` and `OpenAIIcon` are exported.
  - Built-in Shiki grammars are limited to the languages Elide needs; JavaScript
    and JSX reuse the TypeScript grammars (lazy grammar weight 168 → 105 KB gzip).
    `registerLanguage()` adds others without loading Shiki eagerly.
  - `CodeScene` plays scripted code walkthroughs: step a debugger across files
    and languages (locals, call stack, breakpoints that pause playback), flash
    lines as hooks fire, fill in coverage (edge strip, line %), and heat up
    profile hotspots (tint + share of samples), with output in a paired dark
    terminal. `sceneStateAt()` reduces steps to state deterministically.
  - `CodeBlock` takes `insights` (coverage/profile overlays) and a controlled
    `activeFile`; a single file renders as a titled block, not a one-tab bar.
  - Focus outlines on code surfaces are 1px.
  - Review fixes: selected file tabs use a plain border; hovering or focusing an
    annotation note highlights its line (animated); focus rings across Tabs,
    Accordion, Switch, Select, ScrollArea, NavigationMenu and Button are a
    single 1px ring; line numbers sit right-aligned with extra right padding;
    the status bar drops the vim `NORMAL` badge and reads `Lines: 9`; the
    focus notation keeps diff and status rows in color; breakpoint and
    current-line colors follow the light surface.
- 3e6e95e: Add `Terminal` and `CodeSample`, and rebuild code surfaces on a row model.
  
  `@elide/ui` adds `Terminal`: prompt-aware shell samples with zsh-style
  command highlighting (a positional tokenizer: the command in each pipeline
  segment stands out from flags, paths, strings, variables and operators;
  optional `commandHref` links), ANSI-colored output with linked URLs and OSC 8
  hyperlinks, exit-status dots, soft wrapping with hanging indents, copy that
  yields only the runnable commands (plus per-command buttons), and an optional
  `recording` that replays an asciicast (v1–v3, inline or fetched lazily) or a
  synthesized typing session in place: SSR poster, fit-to-width grid, marker
  navigation, speed control, keyboard shortcuts, offscreen pausing, zero layout
  shift, and a transcript for assistive tech. `CodeSample` pairs a `CodeBlock`
  with its `Terminal` below, beside (container query) or as tabs.
  
  Both surfaces render one CSS-grid row per line: line numbers, prompts and
  gutter glyphs never enter a selection or the clipboard. `CodeBlock` gains
  `decorations` (highlight, diff, breakpoints, current line, warnings, focus,
  flash), `startLine` and `wrap`; shell languages use the new tokenizer, and
  token colors move from inline styles to classes. Every code surface takes
  `chrome="auto" | "mac" | "windows" | "linux" | "none"`; inline the exported
  `codeChromeScript` to match the viewer's OS without hydration mismatches.
  Scrollable bodies are focusable, ligatures are off, and hard-coded colors
  are now tokens. `CodeBlock variant="terminal"` is deprecated (legacy
  rendering kept) in favour of `Terminal`.
  
  `@elide/tokens` adds the `--eld-ansi-*` 16-color palette (AA on both code
  backgrounds), `--code-line-height`, chrome and control colors
  (`--code-chrome-*`, `--code-title-foreground`, `--code-control-*`), prompt and
  cursor colors, and line decoration colors (`--code-line-*`,
  `--code-breakpoint`, `--code-current-line`).
- 4817c3f: Refresh primary UI accents with purple-to-muted-rose gradients in both themes.
  Use OKLCH stops, Oklab interpolation, balanced stop lightness, and relative-color
  hover shading with sRGB fallbacks. Tighten the shared radius scale and use 6px
  corners on buttons. Simplify catalog copy and use plain JetBrains Mono labels.
  Add a typed purple scale, primary hover and soft Tailwind colors, and themed
  button shadows while preserving the original brand artwork palette.
  
  Refine all button variants with 1px borders, darker aligned gradient edges on
  filled actions, and restrained depth. Crossfade hover surfaces and shadows with
  opacity; add responsive press scaling and eased release using shared motion
  tokens. Preserve stable hover targets, immediate keyboard focus, and
  reduced-motion support. Add a large size
  and catalog examples for product context, sizes, disabled states, and links.
  
  Carry the treatment through badges, tabs, switches, menus, sheets, dialogs,
  accordions, cards, and navigation. Use shared motion timing, restrained overlay
  scale, explicit transition properties, reduced-motion overrides, and system
  colors for forced-color controls. Suppress selection on controls while retaining
  selectable prose and code. Fix vertical tab keyboard behavior and horizontal tab
  layout, align navigation accessible names with visible labels, and report copy
  success only after the clipboard write succeeds.
  
  Ship self-hosted variable fonts, component-level ESM exports targeting ES2022,
  a lightweight CopyButton entry point, and separate catalog-only CSS. Add a
  prerendered production consumer, Lighthouse audits, leaf bundle budgets, and
  browser regression checks. Make catalog accessibility violations fail tests.

### Patch Changes

- f054380: Adopt color-scheme, light-dark(), relative alpha(), and border-area clipping with
  feature-detected fallbacks that preserve the existing palette. Make CardGrid,
  StatStrip, and dialog footers adapt to their container, with optional compact
  density. Share interruptible opacity/scale overlay transitions with starting
  styles, discrete transitions, and reduced-motion support for CommandPalette.
  
  Add opt-in AnchoredPopover with native CSS positioning, Base UI focus/dismissal,
  and a floating fallback. Add DeferredContent for offscreen document bodies and a
  decorative CSS scroll-timeline ReadingProgress. Preserve print, reduced-motion,
  and unsupported-browser behavior. Export platform.css for custom Tailwind builds.
  
  Add a prerendered platform example and local cross-browser checks for theme
  parity, CSS fallbacks, container layouts, nested focus, anchor collisions, scroll
  progress, and print. CI uses Chromium; Firefox and WebKit can be checked locally.
