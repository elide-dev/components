---
"@elide/tokens": minor
"@elide/ui": minor
---

Add `Terminal` and `CodeSample`, and rebuild code surfaces on a row model.

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
