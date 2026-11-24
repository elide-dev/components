/**
 * The Astro pages' client script: a module Astro bundles once and runs once. The client router swaps pages
 * without a document load, so each behavior starts on astro:page-load (which also fires for the first page)
 * and stops on astro:before-swap: one AbortController per page owns every listener and observer.
 *
 * Around the swap it also does what a full page load would have done:
 * - carries the theme choice and the boot script's marks (data-js, data-emoji) to the new page's <html>, whose
 *   attributes the router replaces;
 * - updates the top bar and the navigator, which the router keeps (transition:persist) so the navigator keeps
 *   its scroll position and filter text: the suite switcher's links, and the navigator's blocks for the new page
 *   (the sites, the indexes with the current one marked, the guides, packages and types), leaving the filter field
 *   in place;
 * - runs the load bar from astro:before-preparation and finishes it on arrival.
 */
import { filterTree, pageBehaviors, saveNavigatorScroll, setFolded, siteRoot, syncFoldAll } from "../client/behaviors";
import { hoverCards } from "../client/cards";
import { loadIndex } from "./search-index";
import { pathUnder } from "./versions";

/** The <html> attributes the page's own scripts set, which the router's swap would drop. */
const CARRIED = ["data-js", "data-emoji", "data-theme", "data-file"];
const PERSIST = "data-astro-transition-persist";

let page: AbortController | undefined;

function start() {
  page?.abort();
  page = new AbortController();
  pageBehaviors(page.signal);
  hoverCards(() => loadIndex(siteRoot()), siteRoot(), page.signal);
  versionMenus(page.signal);
}

/** Keeps each version menu's links on the page being read: the top bar, and the menu in it, outlive the page. */
function versionMenus(signal: AbortSignal) {
  const update = (menu: Element) => {
    const path = pathUnder(location.pathname, siteRoot());
    for (const link of menu.querySelectorAll<HTMLAnchorElement>("a[data-version-base]")) link.href = link.dataset.versionBase! + path;
  };
  for (const menu of document.querySelectorAll("[data-version-menu], .version-notice")) update(menu);
  // toggle does not bubble; a capturing listener on the document sees it for menus that server islands add later.
  document.addEventListener("toggle", event => {
    const menu = event.target as HTMLDetailsElement;
    if (menu.matches?.("details[data-version-menu]") && menu.open) update(menu);
  }, { capture: true, signal });
}

/** Moves a persisted element's page-specific content from the new page into the kept element. */
function refreshPersisted(newDocument: Document) {
  for (const kept of document.querySelectorAll<HTMLElement>(`[${PERSIST}]`)) {
    const next = newDocument.querySelector<HTMLElement>(`[${PERSIST}="${CSS.escape(kept.getAttribute(PERSIST)!)}"]`);
    if (!next) continue;
    if (kept.matches(".topbar")) {
      // The suite switcher marks the site, which a persisted top bar keeps; its links are refreshed all the same.
      const suites = kept.querySelector(".suites");
      const fresh = next.querySelector(".suites");
      if (suites && fresh) suites.replaceWith(document.importNode(fresh, true));
    } else if (kept.matches(".sidebar")) {
      refreshNavigator(kept, next);
    }
  }
}

function refreshNavigator(kept: HTMLElement, next: HTMLElement) {
  const focused = kept.contains(document.activeElement) ? (document.activeElement as HTMLAnchorElement).getAttribute?.("href") : null;
  const top = kept.scrollTop;
  // The reader's folding, by branch: kept for the new page's tree, except that the new page's own path opens.
  const folding = new Map<string, boolean>();
  for (const branch of kept.querySelectorAll<HTMLElement>(".nav-branch[data-nav-key]")) folding.set(branch.dataset.navKey!, branch.hasAttribute("data-folded"));
  // Every block but the filter field is the new page's, in the new page's order around the kept field.
  const filter = kept.querySelector<HTMLElement>(":scope > .nav-filter");
  for (const child of [...kept.children]) if (child !== filter) child.remove();
  let afterFilter = false;
  for (const child of [...next.children]) {
    if (child.matches(".nav-filter")) {
      afterFilter = true;
      if (!filter) kept.append(document.importNode(child, true));
      continue;
    }
    const node = document.importNode(child, true);
    if (filter && !afterFilter) kept.insertBefore(node, filter);
    else kept.append(node);
  }
  // The kept filter text applies to the new rows now, before the scroll position is put back, so the rows above it
  // take the same space as before.
  for (const branch of kept.querySelectorAll<HTMLElement>(".nav-branch[data-nav-key]")) {
    const folded = folding.get(branch.dataset.navKey!);
    if (folded !== undefined && !branch.hasAttribute("data-path")) setFolded(branch, folded);
  }
  const branches = kept.querySelectorAll<HTMLElement>(".nav-branch[data-nav-key]");
  if (branches.length !== folding.size || [...branches].some(branch =>
    folding.get(branch.dataset.navKey!) !== branch.hasAttribute("data-folded"))) syncFoldAll(kept);
  const query = filter?.querySelector("input")?.value;
  if (query?.trim()) filterTree(kept, query);
  kept.scrollTop = top;
  // Keyboard users who chose a row stay on it.
  if (focused) kept.querySelector<HTMLElement>(`a[href="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  // The current page's row comes into view if it is out of it, as on a first load.
  const current = kept.querySelector<HTMLElement>('[aria-current="page"]');
  if (current && (current.offsetTop < kept.scrollTop || current.offsetTop > kept.scrollTop + kept.clientHeight - 40)) {
    kept.scrollTop = window.apidocsNavTop?.(kept, current) ?? Math.max(0, current.offsetTop - kept.clientHeight / 3);
  }
  kept.dataset.scrollTop = String(kept.scrollTop);
}

// The router fires the first page's astro:page-load on window load, after images and fonts. Start at once
// instead (a module script runs when the document is parsed), and let that first event pass.
let firstLoadPending = true;
start();
document.addEventListener("astro:page-load", () => {
  if (firstLoadPending) {
    firstLoadPending = false;
    if (page) return;
  }
  start();
});

document.addEventListener("astro:before-preparation", event => {
  const root = document.documentElement;
  root.removeAttribute("data-arriving");
  root.setAttribute("data-leaving", "");
  // A navigation that is aborted (another click, an error) leaves the bar where it was.
  event.signal.addEventListener("abort", () => root.removeAttribute("data-leaving"), { once: true });
});

document.addEventListener("astro:before-swap", event => {
  firstLoadPending = false;
  page?.abort();
  page = undefined;
  const next = event.newDocument.documentElement;
  for (const name of CARRIED) {
    const value = document.documentElement.getAttribute(name);
    if (value !== null) next.setAttribute(name, value);
  }
  next.setAttribute("data-arriving", "");
  refreshPersisted(event.newDocument);
});

document.addEventListener("astro:after-swap", () => {
  // A top bar from another site arrives without its script having run: size its suite switcher before it paints.
  window.apidocsFitSuites?.();
  // Where the router cannot move an element without detaching it (no Element.moveBefore), the navigator loses
  // its scroll position in the move: put it back before the new page paints.
  const nav = document.querySelector<HTMLElement>(`.sidebar[${PERSIST}]`);
  if (nav?.dataset.scrollTop !== undefined) {
    const top = Number(nav.dataset.scrollTop);
    if (nav.scrollTop !== top) nav.scrollTop = top;
    delete nav.dataset.scrollTop;
  }
});

// A full load or a reload restores the navigator's position from what the last page saved (NAV_BOOT).
saveNavigatorScroll();
