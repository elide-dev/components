---
"@elide/tokens": patch
"@elide/ui": patch
---

Give buttons a hard edge. The gradient and primary rim sat between the face and
the page in tone, with a blurred glow under it, so the edge read as soft. The
rim now contrasts with both: deeper than the face in the light theme, lighter
than it in the dark theme. `--button-shadow` is one unblurred pixel of shade in
place of the glow. The outline button's rim goes from 25% to 40% of the
foreground and loses its shadow.
