---
"@elide/ui": patch
---

Keep table-of-contents text metrics and command-palette indicator space stable
when the active item changes, avoiding navigation-triggered layout work. Memoize
command rows and use group offsets to reduce rendering work in larger palettes.
