---
"@elide/ui": patch
---

Draw terminal box-drawing and block characters as cells.

Recorded terminals sit at the code line height, so block art and box lines set by the font
left seams between rows. `CodeLines` with `variant="terminal"` now draws box drawing
(light, heavy, rounded and double) and block elements (eighths, halves and shades) per cell
at full row height, as a terminal does, and cell backgrounds fill the row. The characters
stay in the DOM for copy.
