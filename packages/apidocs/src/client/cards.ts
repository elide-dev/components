/**
 * Hover cards: a link in the content to a declaration or guide of this site shows what it leads to (its kind, where
 * it is declared, its name and its first sentence) when the pointer rests on it or the keyboard focuses it. The
 * card's text comes from the site's search index, loaded on the first link pointed at, so a page that never shows a
 * card loads nothing. One card element serves the page: a manual popover in the top layer, placed against the link
 * with CSS anchor positioning where the browser has it, and from the link's box where it does not. A screen reader
 * hears the card as the link's description. Touch screens show none: a tap follows the link.
 */
import { SYMBOLS } from "../symbols";
import type { Entry } from "./search";

/** Links that never get a card: the navigator and breadcrumbs, heading and member anchors, menus, cards and rows. */
const SKIP = ".nav-row, .crumbs a, .heading-anchor, .formats a, .guide-card-link, .guide-pager-link, .member-name a, .decl, .search-results a, .related-link";
/** How long the pointer rests on a link before its card shows, and how long the card stays after the pointer leaves. */
const SHOW_MS = 400;
const HIDE_MS = 150;
const ANCHOR = "--apidocs-card";

/** A path relative to the site's root, decoded, as the index writes it: "com/example/geo/Circle.html#area()". */
function key(url: URL, root: URL): string | undefined {
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) return undefined;
  try {
    return decodeURIComponent(url.pathname.slice(root.pathname.length) + url.hash);
  } catch {
    return undefined;
  }
}

function indexByPath(entries: Entry[]): Map<string, Entry> {
  const map = new Map<string, Entry>();
  for (const entry of entries) {
    try {
      map.set(decodeURIComponent(entry[2]), entry);
    } catch {
      map.set(entry[2], entry);
    }
  }
  return map;
}

/** The words for an index entry's kind, as a card's first line says them. */
const KIND_WORD: Record<string, string> = {
  method: "Method", function: "Function", field: "Field", property: "Property", constructor: "Constructor",
  enumConstant: "Enum constant", annotationElement: "Annotation element", package: "Package", guide: "Guide", section: "Section",
};

function kindWord(kind: string): string {
  return KIND_WORD[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

/** The glyph the navigator shows for a kind ("sealed interface", "enum class", "method"), styled by its tone. */
function glyphFor(kind: string): { letter: string; tone: string } {
  if (kind === "exception") return { letter: SYMBOLS.exception.utf, tone: "exception" };
  if (/annotation/.test(kind) && !/element/i.test(kind)) return { letter: "@", tone: "annotation" };
  if (/interface/.test(kind)) return { letter: "I", tone: "interface" };
  if (/^record/.test(kind)) return { letter: "R", tone: "record" };
  if (/^enum/.test(kind) && kind !== "enumConstant") return { letter: "E", tone: "enum" };
  if (/object/.test(kind)) return { letter: "O", tone: "object" };
  if (kind === "method" || kind === "function") return { letter: SYMBOLS.function.utf, tone: "member" };
  if (kind === "constructor") return { letter: SYMBOLS.constructor.utf, tone: "member" };
  if (kind === "field" || kind === "property" || kind === "enumConstant" || kind === "annotationElement") {
    return { letter: SYMBOLS.property.utf, tone: "member" };
  }
  if (kind === "package") return { letter: SYMBOLS.package.utf, tone: "package" };
  if (kind === "guide" || kind === "section") return { letter: SYMBOLS.see.utf, tone: "guide" };
  return { letter: "C", tone: "class" };
}

export function hoverCards(load: () => Promise<Entry[]>, root: string, signal?: AbortSignal) {
  const content = document.querySelector<HTMLElement>("main.content");
  if (!content || !window.matchMedia("(any-hover: hover)").matches) return;
  const base = new URL(root, location.href);
  const here = key(new URL(location.href.split("#")[0]!), base);
  let index: Map<string, Entry> | undefined;
  let loading: Promise<void> | undefined;
  const ensure = () => (loading ??= load().then(entries => void (index = indexByPath(entries))).catch(() => void (index = new Map())));

  const anchored = CSS.supports?.("anchor-name", ANCHOR) ?? false;
  const card = document.createElement("div");
  card.className = "card";
  card.id = "apidocs-card";
  card.setAttribute("popover", "manual");
  card.setAttribute("role", "tooltip");
  const head = card.appendChild(document.createElement("p"));
  head.className = "card-kind";
  const glyph = head.appendChild(document.createElement("span"));
  glyph.className = "glyph";
  glyph.setAttribute("aria-hidden", "true");
  const kind = head.appendChild(document.createElement("span"));
  // Where it is declared, a package or type, set in the code face like every name from the API.
  const where = head.appendChild(document.createElement("code"));
  const name = card.appendChild(document.createElement("p"));
  name.className = "card-name";
  const summary = card.appendChild(document.createElement("p"));
  summary.className = "card-summary";
  document.body.append(card);
  signal?.addEventListener("abort", () => card.remove());

  let current: HTMLElement | undefined;
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  // A link, or an element that names where it would lead (data-card-href: a type in a member's summary row, which
  // may hold no links).
  const target = (element: HTMLElement) => new URL((element as HTMLAnchorElement).href || element.dataset.cardHref!, location.href);
  const entryFor = (link: HTMLElement): Entry | undefined => {
    if (!index) return undefined;
    const at = key(target(link), base);
    if (!at || at === here) return undefined;
    // The static site's index names pages with .html and an Astro site's without; a data-card-href keeps the
    // static form either way, since the Astro rewrite reaches only real links.
    return index.get(at) ?? index.get(at.replace(/\.html(?=#|$)/, "")) ?? index.get(at.replace(/(?=#|$)/, ".html"));
  };
  const hide = () => {
    clearTimeout(showTimer);
    if (!current) return;
    current.style.removeProperty("anchor-name");
    current.removeAttribute("aria-describedby");
    current = undefined;
    if (card.matches(":popover-open")) card.hidePopover();
  };
  const show = (link: HTMLElement) => {
    const entry = entryFor(link);
    if (!entry) return;
    if (current && current !== link) hide();
    current = link;
    const [label, entryKind, , owner, text] = entry;
    const mark = glyphFor(entryKind);
    glyph.textContent = mark.letter;
    glyph.dataset.tone = mark.tone;
    kind.textContent = owner ? `${kindWord(entryKind)} in` : kindWord(entryKind);
    where.textContent = owner;
    where.hidden = !owner;
    name.textContent = label;
    summary.textContent = text;
    summary.hidden = !text;
    link.setAttribute("aria-describedby", card.id);
    if (anchored) link.style.setProperty("anchor-name", ANCHOR);
    if (!card.matches(":popover-open")) card.showPopover();
    if (!anchored) {
      // Below the link, kept inside the window; above it when there is no room below.
      const box = link.getBoundingClientRect();
      const width = card.offsetWidth;
      const height = card.offsetHeight;
      const left = Math.max(8, Math.min(box.left, window.innerWidth - width - 8));
      const top = box.bottom + 6 + height > window.innerHeight ? box.top - 6 - height : box.bottom + 6;
      card.style.left = `${left}px`;
      card.style.top = `${Math.max(8, top)}px`;
    }
  };
  const eligible = (target: EventTarget | null): HTMLElement | undefined => {
    const link = (target as Element | null)?.closest?.<HTMLElement>("a[href], [data-card-href]");
    return link && content.contains(link) && !link.matches(SKIP) ? link : undefined;
  };
  const schedule = (link: HTMLElement) => {
    clearTimeout(hideTimer);
    clearTimeout(showTimer);
    showTimer = setTimeout(() => void ensure().then(() => show(link)), current ? 0 : SHOW_MS);
  };
  const leave = () => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, HIDE_MS);
  };

  content.addEventListener("pointerover", event => {
    if ((event as PointerEvent).pointerType !== "mouse") return;
    const link = eligible(event.target);
    if (link) schedule(link);
  }, { signal });
  content.addEventListener("pointerout", event => {
    const link = eligible(event.target);
    if (link && !link.contains(event.relatedTarget as Node | null)) leave();
  }, { signal });
  content.addEventListener("focusin", event => {
    const link = eligible(event.target);
    if (link && link.matches(":focus-visible")) schedule(link);
  }, { signal });
  content.addEventListener("focusout", event => {
    if (eligible(event.target)) leave();
  }, { signal });
  // The pointer may cross into the card, to read or select its text; it closes when the pointer leaves it.
  card.addEventListener("pointerenter", () => clearTimeout(hideTimer), { signal });
  card.addEventListener("pointerleave", leave, { signal });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && current) hide();
  }, { signal });
  // Without anchor positioning the card is placed once, so scrolling closes it.
  if (!anchored) window.addEventListener("scroll", hide, { signal, passive: true });
  // Following a link closes its card.
  content.addEventListener("click", hide, { signal });
}
