---
"@elide/ui": minor
---

Highlight code with Shiki and add IDE-grade editor features.

`CodeBlock` now highlights with Shiki (JavaScript regex engine, fine-grained
grammars, a theme built from the `--eld-syntax-*` tokens and emitted as `tk-*`
classes) and drops `prism-react-renderer`. Call `highlightCode()` from
`@elide/ui/components/shiki` at build time and spread its serializable result
into `<CodeBlock>` so the client never loads a highlighter, optionally with
Twoslash type hovers and errors (`twoslash` is an optional, build-time peer).
Without pre-highlighted lines, blocks render plain text that matches the
server exactly and upgrade from a lazily imported, idle-scheduled chunk;
`preloadHighlighter()` lets cached grammars apply before first paint.

New `CodeBlock` features: Shiki-compatible `[!code ++]` / `--` / `highlight` /
`focus` / `error` / `warning` / `word:` notation comments (stripped from text
and copy), `highlight` line ranges, collapsible `fold` ranges, `maxLines`
with show more/less, line-number permalinks with `:target` highlighting,
numbered `annotations` (a code tour), type-hover tooltips that never enter a
selection, multi-file `files` tabs with arrow-key navigation, `caption`
(figure) and an `actions` slot. New `CodeGroup` shows one code surface at a
time behind tabs and, with `syncKey`, keeps every group on the page in sync
and remembers the reader's choice. The `CodeBlock` entry shrinks from ~47 KB
to ~21 KB gzipped.
