---
"@elide/tokens": minor
"@elide/ui": minor
---

Light code surfaces, assistant icons, leaner grammars, and a scene engine.

- Editor code surfaces follow the theme: a soft warm white in light theme
  (`--eld-code-light-*`, `--eld-syntax-light-*`, all AA) and the dark panel in
  dark; terminals stay dark. Components read semantic `--code-syntax-*` and
  `--code-mark-*` tokens; `CodeSurface` takes `tone="adaptive" | "dark"`.
- `AiActions` items take `assistant: "claude" | "chatgpt"` to show the
  assistant's mark; `ClaudeIcon` and `OpenAIIcon` are exported.
- Built-in Shiki grammars are limited to the languages Elide needs; JavaScript
  and JSX reuse the TypeScript grammars (lazy grammar weight 168 → 105 KB gzip).
  `registerLanguage()` adds others without loading Shiki eagerly.
- `sceneStateAt()` / `sceneTimeline()` reduce scripted code walkthroughs
  (focus, flash, breakpoints, frames, coverage, profile samples, terminal
  output) to a deterministic state per step.
