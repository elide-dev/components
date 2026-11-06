# Internationalization

The library supplies all built-in labels, placeholders, status messages and
accessible names in 12 locales. Content supplied by an application (page titles,
nav links, menu items, descriptions, dates and numbers) remains that application's
responsibility. Brand names, programming language names, keyboard legends and
code syntax retain their conventional spelling.

| Tier | Locales |
| --- | --- |
| Primary (current docs set) | `en`, `es`, `de`, `fr`, `ru`, `uk`, `ar` |
| Secondary (expanded component set) | `zh-Hans`, `zh-Hant`, `ja`, `ko`, `he` |

The primary set was checked against `elide/project/docs/src/i18n/locales.ts` at
`ba3be6350cb2bfb7fff0704acf1b6fc19160d04a`. The docs do not declare tier names;
these tiers identify the existing docs set versus the requested expansion, not
a different completeness requirement. Both tiers pass the same catalog checks.
Changes to docs languages should update this registry in the same release.
These new translations have automated structural coverage; native-speaker
editorial review is still needed. Do not treat completeness as linguistic certification.

## Load only what you use

```tsx
import { I18nProvider } from '@elide/ui/i18n';
import he from '@elide/ui/locales/he';

<I18nProvider locale="he" messages={he}>
  <YourApp />
</I18nProvider>
```

The provider adds a scoped `div` with `lang` and `dir`, merges messages and
provides Base UI's direction context for keyboard and placement behavior.
Arabic and Hebrew resolve to RTL. Portaled overlays receive the same language
and direction, even outside the provider's DOM element. Nested message-only
providers inherit the parent's catalog and locale; changing locale starts from
English defaults rather than leaking the previous language into missing keys.

For a full document, set `<html lang="he" dir="rtl">` during server rendering
and use `MessagesProvider` with the same props to avoid adding a wrapper. Neither
provider mutates global document state. This supports simultaneous SSR requests
and embedded widgets with different languages. A custom language catalog can
use an explicit `direction` override.

Existing `MessagesProvider messages={partialDictionary}` calls continue to work.
Unspecified keys fall back to English (or the enclosing provider). The bundled
catalogs themselves must be complete. Supplying `locale` does **not** implicitly
fetch messages; the explicit catalog keeps initial rendering deterministic.
Use `useMessages()` for strings and `useLocale()` for `{ locale, direction }`.

For application-controlled lazy loading:

```ts
import { loadMessages } from '@elide/ui/i18n/loader';
import { resolveLocale } from '@elide/ui/i18n/locales';

const locale = resolveLocale(requestedLanguage);
const messages = await loadMessages(locale);
// Render once both values are ready; serialize the same values for hydration.
```

The loader lives in a separate opt-in entry with statically enumerated dynamic
imports, one per locale. It does not run on provider render, navigate, fetch from
a translation service, or install a runtime compiler. Direct locale imports are
data-only ESM without React dependencies; their declarations also resolve through
the pure `@elide/ui/i18n/messages` entry instead of the provider API. Raw JSON is available as
`@elide/ui/locales/he.json` for server frameworks and translation tooling.
The main UI entry does not import secondary catalogs or the async loader.

`resolveLocale` handles BCP 47 language/region aliases, including `iw` → `he` and
Chinese scripts: `zh-TW`/`zh-HK` → `zh-Hant`, `zh-CN` → `zh-Hans`; an explicit
script wins over the region. Unsupported or invalid values fall back to English.
It accepts a single language tag, **not** an HTTP `Accept-Language` header.
Negotiate weighted request preferences in your application/router, respecting
explicit user choice and `q=0` exclusions before resolving the catalog.

## Serving and integration

- Preload the selected catalog server-side and hydrate with that same catalog.
  Do not render English and replace it after mount: translated text can reflow.
- Prefer locale URLs when serving translated pages. Cache HTML by locale and
  revalidate it. If a response varies by `Accept-Language`, make the CDN cache
  key and `Vary` behavior explicit; never cache one user's locale for everyone.
- Let the application bundler emit content-hashed ESM locale chunks; serve those
  with Brotli/gzip and `Cache-Control: public, max-age=31536000, immutable`.
  Do not apply immutable caching to unversioned JSON/HTML. Deploy HTML and its
  referenced chunks together, preserving previous chunks during rolling deploys.
- Keep catalog objects at module/request scope, not recreated during every
  parent render. Switch locale and messages together after a lazy import
  completes; discard superseded requests when a user switches rapidly.
- Existing i18next, FormatJS, Lingui, Fluent or framework dictionaries can map to
  the `Messages` shape. No second provider runtime is required beyond this
  component context. Use native `Intl.NumberFormat`, `Intl.DateTimeFormat` and
  `Intl.PluralRules` in the consuming application for its dynamic content.
- Preact consumers use the existing React-to-`preact/compat` alias setup; the
  same provider and locale entry points are covered by SSR/hydration tests.

## Direction and typography

Component spacing, indentation, borders and alignment use logical CSS properties.
Directional navigation icons mirror; code, filenames and API signatures retain
LTR isolation. `SheetContent` accepts logical `start`/`end` sides (default `end`)
while explicit `left`/`right` remain physical. Native and floating overlays both
carry the locale. Tabs and submenus use Base UI's direction-aware keyboard model.
CommandPalette ignores Enter during IME composition and uses normalized,
locale-aware casing for filtering.

Instrument Sans and JetBrains Mono remain the design fonts. System fallbacks
supply missing CJK/Hebrew glyphs without automatically downloading large font
packs. Applications choosing regional webfonts should subset and preload only
the required script. Avoid fixed heights around translated prose and avoid
forcing Latin capitalization or letter spacing on non-Latin text.

## Translation pipeline

1. Edit the canonical English JSON in `packages/ui/src/i18n/locales/en.json`.
   Add every built-in visible/ARIA string there; application copy stays in props.
2. Update all eleven translated JSON catalogs. Preserve `{name}`, `{section}`
   and `{count}` placeholders; their order can change for the target language.
   Interpolation is plain text, never HTML. Code/name values in RTL accessible
   labels are isolated at render time rather than embedding controls in catalogs.
3. From `packages/ui`, run `bun run i18n:generate`. Commit JSON and generated
   TypeScript together. Generation is deterministic and introduces no build-time
   network dependency; emitted declarations require no JSON loader in consumers.
4. Run `bun run i18n:check`, build and tests. Normal CI lint invokes the same
   checks: exact keys, nonempty messages, matching placeholders, NFC, no hidden
   bidi control characters, generated-source drift and static JSX label checks.
   Translation exports from external systems must pass these gates as well.
5. Review the Internationalization Storybook examples in both themes, plus the
   production `/i18n.html` fixture at mobile widths. Seek native-speaker review
   for wording, technical terminology and accessible names before calling a
   translation editorially reviewed.

Automated browser coverage includes all 12 locales, no-JS SSR, hydration,
translated portal labels, RTL tab/submenu keys, sheet sides, switch movement,
code direction and page overflow. `BROWSERS=chromium,firefox,webkit bun i18n-check.mjs`
from `apps/benchmark` exercises the same fixture across engines. Storybook keeps
Arabic/Hebrew/CJK/German visual cases under Chromatic in both themes.

Bundle checks retain the existing 14 KB gzip leaf-component budget and add a
1.6 KB budget per data-only locale and a 6.5 KB budget for a Hebrew provider
consumer. They verify that unrelated catalogs stay out of a single-locale bundle.
[Recorded quality checks](./i18n-quality.md) cover the before/after bundles,
MCP traces and Lighthouse results. Rendering profiles and Lighthouse remain separate quality gates; internationalization
must not be used as a reason to relax them.

References: [Base UI direction provider](https://base-ui.com/react/utils/direction-provider),
[web.dev internationalization](https://web.dev/learn/design/internationalization),
and [good-css logical properties](https://good-css.com/#logical-properties).
The relevant good-css practices here are logical layout, intrinsic sizing,
selectable content and reduced-motion guards, rather than additional animations.
