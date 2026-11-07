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
