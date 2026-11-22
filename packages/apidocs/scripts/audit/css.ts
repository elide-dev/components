/**
 * The good-css.com rules, checked against the stylesheets a site ships.
 *
 * good-css.com is a list of 47 modern CSS techniques with rules, written for
 * agents ("Strong opinions about modern CSS technique, borrowed from
 * experts"). It is a guideline, not a tool, and has no score. Its agent skill
 * (https://good-css.com/skills/good-css/SKILL.md) states nine rules "in all
 * CSS"; this file checks those mechanically, with each violation's selector.
 * The 47 entries (https://good-css.com/llms.txt) need judgment about where a
 * technique applies, so each gets a checklist row with what the stylesheet
 * shows (a signal) and a "review" status for a person to settle.
 *
 * The score is the share of the mechanical rules with no violation.
 */
import postcss, { type AtRule, type ChildNode, type Comment, type Declaration, type Rule } from "postcss";
import type { Finding, Status } from "./types";

export interface Stylesheet {
  /** The published path, such as "assets/apidocs.css". */
  path: string;
  css: string;
  /** The source file it comes from, for the report. */
  source: string;
}

interface Decl {
  sheet: string;
  line: number;
  selector: string;
  /** Ancestor at-rules, outermost first, such as "@media (hover: hover) and (pointer: fine)". */
  context: string[];
  prop: string;
  value: string;
  /** Rules this declaration is a noted exception to: a "good-css exception (rule-id): reason" comment before it in its rule, or before its rule. */
  exceptions: string[];
}

const EXCEPTION = /good-css exception \(([a-z-]+)\)/g;
const exceptionIds = (text: string) => [...text.matchAll(EXCEPTION)].map(m => m[1]!);

export interface CssReport {
  score: number;
  rules: Finding[];
  checklist: Finding[];
}

const SKILL = "https://good-css.com/skills/good-css/SKILL.md";
const entry = (slug: string) => `https://good-css.com/${slug}`;

const PHYSICAL = /^(margin|padding|scroll-margin|scroll-padding)-(left|right|top|bottom)$|^border-(left|right|top|bottom)(-(width|style|color))?$|^(left|right|top|bottom)$|^border-(top|bottom)-(left|right)-radius$|^overscroll-behavior-[xy]$/;
const NAMED_COLOR = /\b(white|black|red|green|blue|gray|grey|silver|orange|yellow|purple|pink|navy|teal|maroon|olive|lime|aqua|fuchsia)\b/i;
const MOVES = /\b(transform|translate|scale|rotate|inset|top|left|right|bottom|margin[\w-]*|width|height|inline-size|block-size|grid-template[\w-]*|all)\b/;

export function readDeclarations(sheets: Stylesheet[]): Decl[] {
  const out: Decl[] = [];
  for (const sheet of sheets) {
    const root = postcss.parse(sheet.css, { from: sheet.path });
    root.walkDecls((decl: Declaration) => {
      const context: string[] = [];
      let selector = "";
      for (let p = decl.parent; p && p.type !== "root"; p = p.parent as typeof p) {
        if (p.type === "rule" && !selector) selector = (p as Rule).selector.replace(/\s+/g, " ");
        else if (p.type === "rule") selector = `${(p as Rule).selector.replace(/\s+/g, " ")} ${selector}`;
        if (p.type === "atrule") context.unshift(`@${(p as AtRule).name} ${(p as AtRule).params}`.trim());
      }
      const exceptions: string[] = [];
      for (let n: ChildNode | undefined = decl.prev(); n; n = n.prev()) if (n.type === "comment") exceptions.push(...exceptionIds((n as Comment).text));
      const before = decl.parent && decl.parent.type === "rule" ? (decl.parent as Rule).prev() : undefined;
      if (before?.type === "comment") exceptions.push(...exceptionIds((before as Comment).text));
      out.push({ sheet: sheet.path, line: decl.source?.start?.line ?? 0, selector: selector || "(at-rule)", context, prop: decl.prop.toLowerCase(), value: decl.value, exceptions });
    });
  }
  return out;
}

export function cssAudit(sheets: Stylesheet[]): CssReport {
  const decls = readDeclarations(sheets);
  const sourceOf = (sheet: string) => sheets.find(s => s.path === sheet)?.source ?? sheet;
  const at = (d: Decl) => `${d.sheet}:${d.line} ${d.selector.slice(0, 70)} { ${d.prop}: ${d.value.slice(0, 60)} }`;
  const files = (list: Decl[]) => [...new Set(list.map(d => sourceOf(d.sheet)))].join(", ") || undefined;
  const rules: Finding[] = [];
  const rule = (id: string, name: string, found: Decl[], evidence: string, fix: string, source = SKILL, extra: string[] = []) => {
    // A declaration the stylesheet notes as an exception to this rule, with its reason, is reported but does not fail it.
    const violations = found.filter(d => !d.exceptions.includes(id));
    const excepted = found.filter(d => d.exceptions.includes(id));
    const noted = excepted.length ? ` ${excepted.length} noted exception(s) in the stylesheet: ${excepted.map(d => `${d.selector.slice(0, 40)} { ${d.prop} }`).join("; ")}.` : "";
    rules.push({
      rule: id, name, owner: "page", status: violations.length || extra.length ? "fail" : "pass",
      evidence: (violations.length || extra.length ? `${violations.length + extra.length} ${evidence}` : "No violations.") + noted,
      where: [...extra, ...violations.map(at)].slice(0, 8), file: files(violations) ?? (extra.length ? sheets[0]?.source : undefined), fix: violations.length || extra.length ? fix : undefined, source,
    });
  };
  const inMedia = (d: Decl, re: RegExp) => d.context.some(c => c.startsWith("@media") && re.test(c));
  const selectors = [...new Set(decls.map(d => d.selector))];

  // 1. Logical properties.
  const physical = decls.filter(d => PHYSICAL.test(d.prop)
    || (d.prop === "text-align" && /\b(left|right)\b/.test(d.value))
    || (d.prop === "float" && /\b(left|right)\b/.test(d.value))
    || (/^(margin|padding|inset|scroll-margin|scroll-padding)$/.test(d.prop) && splitValues(d.value).length > 1 && !allSame(splitValues(d.value))));
  rule("logical-properties", "Logical properties in place of left, right, top and bottom", physical,
    "declarations name a physical side (or use a multi-value margin, padding or inset shorthand)",
    "Use margin-inline/-block(-start/-end), padding-inline/-block, inset-inline/-block, border-inline-start, text-align: start/end; the -inline and -block shorthands in place of multi-value margin and padding.", entry("logical-properties"));

  // 2. OKLCH colors, and grays with a hue of none.
  const colorDecls = decls.filter(d => !/^(font|src|content|grid|transition|animation|counter|quotes|unicode)/.test(d.prop) && !/url\(/.test(d.value));
  const legacy = colorDecls.filter(d => /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch)\(/i.test(d.value) || (NAMED_COLOR.test(d.value) && /color|background|border|outline|fill|stroke|shadow|^--/.test(d.prop) && !/color-mix\(in oklch,[^)]*\b(white|black)\b/.test(d.value)));
  const grayHue = colorDecls.filter(d => [...d.value.matchAll(/oklch\(\s*[\d.]+%?\s+0(?:\.0+)?\s+([\d.]+)/g)].length > 0);
  rule("oklch-color", "Colors in oklch(), grays with hue none", [...legacy, ...grayHue],
    "declarations use hex, rgb(), hsl() or a named color, or write a gray's hue as a number",
    "Write colors as oklch(); derive hover, tint and transparent versions with color-mix(in oklch, ...); write grays as oklch(L 0 none).", entry("oklch-color"));

  // 3. Fluid sizes with clamp(): no bare vw, and no font-size or spacing ladders in width media queries.
  const bareVw = decls.filter(d => /\d(vw|vi)\b/.test(d.value) && !/clamp\(|min\(|max\(/.test(d.value));
  const ladder = decls.filter(d => /^(font-size|padding|margin|gap|row-gap|column-gap)(-|$)/.test(d.prop) && inMedia(d, /(min|max)-width|width\s*[<>]/));
  const vwOnly = decls.filter(d => /clamp\([^,]+,\s*[\d.]+vw\s*,/.test(d.value));
  rule("fluid-clamp", "Sizes that grow with the screen in one clamp() token", [...bareVw, ...vwOnly, ...ladder],
    "declarations use a bare vw value, a vw-only clamp middle, or step a font size or spacing through width media queries",
    "Put each fluid size in one custom property: clamp(min-rem, rem + vw, max-rem), and use it in place of the breakpoint steps.", entry("fluid-sizes-with-clamp"));

  // 4. :hover only inside @media (hover: hover) and (pointer: fine).
  const hover = decls.filter(d => /:hover\b/.test(d.selector) && !inMedia(d, /hover:\s*hover/) );
  const hoverHalf = decls.filter(d => /:hover\b/.test(d.selector) && inMedia(d, /hover:\s*hover/) && !inMedia(d, /pointer:\s*fine/));
  rule("hover-media", ":hover only where hover exists", [...hover, ...hoverHalf],
    "declarations under :hover are not inside @media (hover: hover) and (pointer: fine)",
    "Wrap every :hover rule in @media (hover: hover) and (pointer: fine); give touch feedback with :active.", entry("hover-styles-only-where-hover-exists"));

  // 5. Focus with :focus-visible and outline; never outline: none.
  const outlineNone = decls.filter(d => /^outline$/.test(d.prop) && /^(none|0|0px)\b/.test(d.value.trim()) || d.prop === "outline-style" && d.value.trim() === "none");
  const plainFocus = decls.filter(d => /:focus(?![-\w])/.test(d.selector));
  rule("focus-visible", "Focus styled with :focus-visible and outline, never outline: none", [...outlineNone, ...plainFocus],
    "declarations remove the outline or style :focus in place of :focus-visible",
    "Style focus with :focus-visible { outline: ... }; where a component draws its ring with box-shadow, set outline-color: transparent, never outline: none.", entry("one-focus-ring-with-focus-visible"));

  // 6. Everything pressable has an :active state. Approximated as: every selector with :hover has a matching :active.
  const base = (s: string) => s.replace(/:(hover|active|focus-visible|focus-within)\b/g, "").replace(/\s+/g, " ").trim();
  const activeBases = new Set(selectors.filter(s => /:active\b/.test(s)).flatMap(s => s.split(",").map(base)));
  const hoverOnly = [...new Set(selectors.filter(s => /:hover\b/.test(s)).flatMap(s => s.split(",").filter(p => /:hover\b/.test(p)).map(base)))].filter(b => !activeBases.has(b));
  rule("press-feedback", "Everything pressable has an :active state", [],
    "hover targets have no :active state",
    "Add an :active rule for each pressable element (a scale of 0.95 to 0.98 inside the reduced-motion query, or a color change).", entry("press-feedback"), hoverOnly.map(s => `no :active for ${s}`));

  // 7. Motion inside prefers-reduced-motion: no-preference; name properties; never all; never ease-in.
  const transitions = decls.filter(d => /^(transition|transition-property|animation|animation-name)$/.test(d.prop));
  const moving = transitions.filter(d => (d.prop.startsWith("transition") ? MOVES.test(d.value) || /^\s*[\d.]+m?s\b/.test(d.value) : !/^none$/.test(d.value.trim())) && !inMedia(d, /prefers-reduced-motion:\s*no-preference/));
  const all = transitions.filter(d => d.prop.startsWith("transition") && (/\ball\b/.test(d.value) || /^\s*[\d.]+m?s\b/.test(d.value)));
  const easeIn = decls.filter(d => /(transition|animation)(-timing-function)?$/.test(d.prop) && /\bease-in\b(?!-out)/.test(d.value) || /^--ease/.test(d.prop) && /\bease-in\b(?!-out)/.test(d.value));
  const slow = transitions.filter(d => [...d.value.matchAll(/([\d.]+)(m?s)\b/g)].some(m => Number(m[1]) * (m[2] === "s" ? 1000 : 1) > 300));
  rule("opt-in-motion", "Motion that moves or scales only inside prefers-reduced-motion: no-preference", moving,
    "transitions or animations that move, resize or animate 'all' run outside @media (prefers-reduced-motion: no-preference)",
    "Build the state change first, then add the transition inside @media (prefers-reduced-motion: no-preference). Fades of opacity and color may stay outside.", entry("opt-in-motion"));
  rule("motion-properties", "Transitions name their properties, never all, never ease-in, 300 ms or less", [...all, ...easeIn, ...slow],
    "transitions animate all (or name no property), use ease-in, or run longer than 300 ms",
    "Name each property (transition: opacity 180ms var(--ease-out)); use ease-out or a custom curve; keep UI transitions at or under 300 ms (dialogs and drawers excepted).", entry("motion-tokens"));

  // 8. overflow: clip over hidden.
  const hidden = decls.filter(d => /^overflow(-x|-y|-inline|-block)?$/.test(d.prop) && /\bhidden\b/.test(d.value));
  rule("overflow-clip", "overflow: clip over hidden", hidden,
    "declarations use overflow: hidden",
    "Use overflow: clip where nothing scrolls the element by script and it has no resize handle; keep hidden only for those.", entry("overflow-clip-over-hidden"));

  // 9. Left out on purpose.
  const leftOut = decls.filter(d => (d.prop === "text-rendering" && /optimizelegibility/i.test(d.value))
    || (/^text-box(-trim)?$/.test(d.prop) && /(^|,)\s*\*\s*($|,)/.test(d.selector))
    || (d.prop === "display" && d.value === "contents" && /(^|,)\s*\*\s*($|,)/.test(d.selector)));
  rule("left-out", "No text-box trim on *, no optimizeLegibility, no display: contents on *", leftOut,
    "declarations the skill leaves out on purpose",
    "Remove them; good-css.com/the-reset says why.", SKILL);

  const passing = rules.filter(r => r.status === "pass").length;
  return { score: Math.round((100 * passing) / rules.length), rules, checklist: checklist(decls, sheets) };
}

interface Entry {
  slug: string;
  title: string;
  /** What in the stylesheet shows the technique is used. */
  signal: (d: Decl[]) => string | undefined;
  /** When the pages plainly need the technique. */
  applies?: string;
}

const has = (decls: Decl[], prop: RegExp, value: RegExp = /./) => decls.filter(d => prop.test(d.prop) && value.test(d.value));
const said = (list: Decl[], what: string) => (list.length ? `${what} (${list.length}x, first ${list[0]!.selector.slice(0, 40)})` : undefined);

const ENTRIES: Entry[] = [
  { slug: "the-reset", title: "The reset", applies: "every page", signal: d => {
    const parts = [["box-sizing", /border-box/], ["min-width", /^0/], ["text-wrap", /pretty/], ["font-synthesis", /none/], ["scrollbar-gutter", /stable/], ["overflow-wrap", /break-word/], ["-webkit-text-size-adjust", /100%/], ["touch-action", /manipulation/]] as const;
    const found = parts.filter(([p, v]) => has(d, new RegExp(`^${p}$`), v).length).map(([p]) => p);
    return `${found.length}/${parts.length} reset declarations present (${found.join(", ") || "none"}); missing: ${parts.filter(([p]) => !found.includes(p)).map(([p]) => p).join(", ") || "none"}`;
  } },
  { slug: "logical-properties", title: "Logical properties", applies: "every page", signal: d => said(has(d, /-(inline|block)(-start|-end)?$|^inset-/), "logical properties used") },
  { slug: "oklch-color", title: "OKLCH color", applies: "every page", signal: d => said(d.filter(x => /oklch\(|color-mix\(in oklch/.test(x.value)), "oklch()/color-mix used") },
  { slug: "one-set-of-color-tokens-for-light-and-dark", title: "One set of color tokens for light and dark", applies: "the pages have a dark theme", signal: d => [said(has(d, /^color-scheme$/), "color-scheme set"), said(d.filter(x => /light-dark\(/.test(x.value)), "light-dark() used"), d.some(x => x.context.some(c => /prefers-color-scheme/.test(c)) && /^--/.test(x.prop)) ? "tokens are redefined under prefers-color-scheme (the entry says switch color-scheme, never redefine tokens)" : undefined].filter(Boolean).join("; ") || undefined },
  { slug: "fluid-sizes-with-clamp", title: "Fluid sizes with clamp()", signal: d => said(d.filter(x => /clamp\(/.test(x.value)), "clamp() used") },
  { slug: "one-fluid-scale-for-type-and-space", title: "One fluid scale for type and space", signal: d => said(has(d, /^--(step|space|text|font-size)/, /clamp\(/), "fluid scale tokens") },
  { slug: "content-grid-with-breakouts", title: "Content grid with breakouts", signal: d => said(has(d, /^grid-template-columns$/, /\[[\w-]*(content|full|breakout)/), "named content-grid lines") },
  { slug: "intrinsic-grid", title: "Intrinsic grid", signal: d => said(has(d, /^grid-template-columns$/, /auto-(fit|fill)/), "auto-fit/auto-fill grid") },
  { slug: "subgrid-rows-shared-across-cards", title: "Subgrid rows shared across cards", signal: d => said(has(d, /^grid-template-rows$|^grid-template-columns$/, /subgrid/), "subgrid") },
  { slug: "sidebar-that-wraps-on-its-own", title: "Sidebar that wraps on its own", applies: "the navigator beside the content", signal: d => said(has(d, /^flex-basis$|^flex$/, /\d/), "flex-basis sizing") },
  { slug: "container-queries-with-container-units", title: "Container queries with container units", signal: d => said(d.filter(x => x.context.some(c => c.startsWith("@container")) || x.prop === "container-type"), "container queries") },
  { slug: "stack-layers-with-grid", title: "Stack layers with grid", signal: d => said(has(d, /^grid-area$/, /1\s*\/\s*1/), "grid-area: 1 / 1 stacking") },
  { slug: "safe-alignment", title: "Safe alignment", signal: d => said(has(d, /^(justify|align)-(content|items|self)$/, /\bsafe\b/), "safe alignment") },
  { slug: "overflow-clip-over-hidden", title: "overflow: clip over hidden", applies: "anything cut off", signal: d => said(has(d, /^overflow/, /clip/), "overflow: clip") },
  { slug: "section-spacing-that-depends-on-its-neighbors", title: "Section spacing that depends on its neighbors", signal: d => said(d.filter(x => /\+|:has\(\s*\+/.test(x.selector) && /margin|padding/.test(x.prop)), "sibling-dependent spacing") },
  { slug: "space-between-siblings-set-by-the-parent", title: "Space between siblings set by the parent", applies: "stacked blocks of documentation", signal: d => said(has(d, /^(gap|row-gap)$/), "gap on parents") },
  { slug: "push-one-item-away-with-an-auto-margin", title: "Push one item away with an auto margin", signal: d => said(has(d, /^margin-(inline|block)-start$|^margin-(left|top)$/, /^auto$/), "auto margin") },
  { slug: "concentric-nested-radius", title: "Concentric nested radius", signal: d => said(d.filter(x => /radius/.test(x.prop) && /calc\(.*-/.test(x.value)), "nested radius computed") },
  { slug: "long-text-that-wraps-truncates-or-clamps", title: "Long text that wraps, truncates or clamps", applies: "long type and member names", signal: d => said(has(d, /^text-overflow$/, /ellipsis/), "ellipsis truncation") },
  { slug: "image-box-that-holds-any-upload", title: "Image box that holds any upload", signal: d => said(has(d, /^aspect-ratio$|^object-fit$/), "aspect-ratio/object-fit") },
  { slug: "tabular-numbers", title: "Tabular numbers", applies: "counts in the navigator and table of contents", signal: d => said(has(d, /^font-variant-numeric$/, /tabular-nums/), "tabular-nums") },
  { slug: "label-centered-on-its-letters-with-text-box", title: "Label centered on its letters with text-box", signal: d => said(has(d, /^text-box/), "text-box") },
  { slug: "icon-sized-by-the-text-beside-it", title: "Icon sized by the text beside it", applies: "icons beside labels", signal: d => said(d.filter(x => /^(width|height|inline-size|block-size)$/.test(x.prop) && /\d(em|cap|lh)\b/.test(x.value)), "icons sized in em/cap/lh") },
  { slug: "one-focus-ring-with-focus-visible", title: "One focus ring with :focus-visible", applies: "every control", signal: d => said(d.filter(x => /:focus-visible/.test(x.selector)), ":focus-visible rules") },
  { slug: "hover-styles-only-where-hover-exists", title: "Hover styles only where hover exists", applies: "every :hover rule", signal: d => said(d.filter(x => /:hover/.test(x.selector) && x.context.some(c => /hover:\s*hover/.test(c))), ":hover guarded by (hover: hover)") },
  { slug: "press-feedback", title: "Press feedback", applies: "every button", signal: d => said(d.filter(x => /:active/.test(x.selector)), ":active rules") },
  { slug: "hit-area-larger-than-the-visual", title: "Hit area larger than the visual", applies: "icon buttons (theme switch, navigator toggle, copy)", signal: d => said(d.filter(x => /::?(after|before)/.test(x.selector) && x.prop === "inset"), "pseudo-element hit areas") },
  { slug: "whole-card-clickable-from-one-link", title: "Whole card clickable from one link", signal: d => said(d.filter(x => /a::?after|::?after/.test(x.selector) && x.prop === "inset" && /^0/.test(x.value)), "stretched link") },
  { slug: "has-for-parent-and-page-state", title: ":has() for parent and page state", signal: d => said(d.filter(x => /:has\(/.test(x.selector)), ":has() selectors") },
  { slug: "form-feedback-with-user-invalid", title: "Form feedback with :user-invalid", signal: d => said(d.filter(x => /:user-invalid/.test(x.selector)), ":user-invalid") },
  { slug: "textarea-that-grows-with-its-content", title: "Textarea that grows with its content", signal: d => said(has(d, /^field-sizing$/), "field-sizing") },
  { slug: "opt-in-motion", title: "Opt-in motion", applies: "every transition that moves", signal: d => said(d.filter(x => x.context.some(c => /prefers-reduced-motion:\s*no-preference/.test(c))), "rules inside prefers-reduced-motion: no-preference") },
  { slug: "motion-tokens", title: "Motion tokens", applies: "every transition", signal: d => said(has(d, /^--(ease|duration)/), "easing/duration tokens") },
  { slug: "transition-a-custom-property-with-property", title: "Transition a custom property with @property", signal: () => undefined },
  { slug: "shadow-change-that-fades-and-does-not-repaint", title: "Shadow change that fades and does not repaint", signal: d => said(d.filter(x => /::?(after|before)/.test(x.selector) && x.prop === "box-shadow"), "shadow on a pseudo-element") },
  { slug: "cross-document-view-transitions", title: "Cross-document view transitions", applies: "a multi-page site (page transitions are planned)", signal: d => said(d.filter(x => x.context.some(c => c.startsWith("@view-transition")) || /::view-transition/.test(x.selector)), "@view-transition rules") },
  { slug: "indicator-that-slides-to-the-active-item", title: "Indicator that slides to the active item", applies: "the table-of-contents marker", signal: d => said(d.filter(x => /anchor-name|position-anchor/.test(x.prop)), "anchor positioning") },
  { slug: "enter-and-exit-transitions-from-display-none", title: "Enter and exit transitions from display: none", applies: "search results and the mobile navigator", signal: d => said(d.filter(x => x.context.some(c => c.startsWith("@starting-style")) || /allow-discrete/.test(x.value)), "@starting-style / allow-discrete") },
  { slug: "popover-anchored-to-its-trigger", title: "Popover anchored to its trigger", signal: d => said(d.filter(x => /:popover-open/.test(x.selector) || /position-anchor|anchor\(/.test(x.prop + x.value)), "popover/anchor") },
  { slug: "accordion-that-animates-its-height", title: "Accordion that animates its height", applies: "<details> folds in the table of contents", signal: d => said(d.filter(x => /::details-content/.test(x.selector) || x.prop === "interpolate-size"), "::details-content / interpolate-size") },
  { slug: "reveal-with-clip-path", title: "Reveal with clip-path", signal: d => said(has(d, /^clip-path$/), "clip-path") },
  { slug: "carousel-on-native-scroll", title: "Carousel on native scroll", signal: d => said(has(d, /^scroll-snap-type$/), "scroll-snap") },
  { slug: "scroll-area-between-a-fixed-header-and-footer", title: "Scroll area between a fixed header and footer", applies: "the navigator and table-of-contents rails", signal: d => said(has(d, /^overscroll-behavior/), "overscroll-behavior") },
  { slug: "styles-that-apply-only-when-a-scroller-overflows", title: "Styles that apply only when a scroller overflows", applies: "wide signatures and tables", signal: d => said(d.filter(x => /scroll-state|animation-timeline/.test(x.prop + x.value) || x.context.some(c => /scroll-state/.test(c))), "scroll-state / scroll-driven") },
  { slug: "anchor-targets-that-clear-a-sticky-header", title: "Anchor targets that clear a sticky header", applies: "member anchors under the sticky top bar", signal: d => said(has(d, /^scroll-(padding|margin)(-block-start|-top)?$/), "scroll-padding/margin") },
  { slug: "no-rubber-band-bounce-on-desktop", title: "No rubber-band bounce on desktop", signal: d => said(has(d, /^overscroll-behavior(-y|-block)?$/, /none/), "overscroll-behavior: none") },
  { slug: "content-clear-of-the-notch", title: "Content clear of the notch", signal: d => said(d.filter(x => /safe-area-inset/.test(x.value)), "env(safe-area-inset-*)") },
];

function checklist(decls: Decl[], sheets: Stylesheet[]): Finding[] {
  return ENTRIES.map(e => {
    const signal = e.signal(decls);
    const status: Status = "review";
    return {
      rule: e.slug, name: e.title, owner: "page", status,
      evidence: `${signal ?? "no sign of the technique in the stylesheet"}${e.applies ? `. Applies to: ${e.applies}.` : "."}`,
      file: sheets[0]?.source, source: entry(e.slug),
    };
  });
}

function splitValues(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value.trim()) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (current) out.push(current);
      current = "";
    } else current += ch;
  }
  if (current) out.push(current);
  return out;
}

const allSame = (list: string[]) => list.every(v => v === list[0]);
