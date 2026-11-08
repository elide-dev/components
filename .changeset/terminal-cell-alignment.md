---
"@elide/ui": patch
---

Position terminal recording runs at their VT cell columns so fractional glyph
advances and ANSI style boundaries cannot move borders or ASCII art horizontally.
Preserve wide-character and cursor cell widths; keep transcript text unchanged.
