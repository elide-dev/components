---
"@elide/elements": minor
"@elide/ui": minor
"@elide/tokens": patch
---

Add an opt-in Lit logo with scoped styles, explicit registration, a server-only
declarative shadow DOM renderer, and a React/Preact adapter at
`@elide/ui/elements/logo`. Existing React logo exports remain unchanged. Add
inherited theme variables for light/dark brand assets across shadow roots.

Reduce retained React/Preact component overhead in shared code/terminal token
rendering, and keep logo resize styles local to avoid inherited-variable
invalidation of the artwork subtree.
