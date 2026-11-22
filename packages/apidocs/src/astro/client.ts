/**
 * The Astro pages' client script: a module Astro bundles once and runs once. The client router swaps pages
 * without a document load, so each behavior starts on astro:page-load (which also fires for the first page)
 * and stops on astro:before-swap: one AbortController per page owns every listener and observer.
 *
 * Around the swap it also does what a full page load would have done:
 * - carries the theme choice and the boot script's marks (data-js, data-emoji) to the new page's <html>, whose
 *   attributes the router replaces;
 * - updates the top bar and the navigator, which the router keeps (transition:persist) so the navigator keeps
 *   its scroll position and filter text: the index links' current page, and the navigator's rows for the new
 *   page, leaving the filter field in place;
 * - runs the load bar from astro:before-preparation and finishes it on arrival.
 */
import { pageBehaviors, saveNavigatorScroll, siteRoot } from "../client/behaviors";
import { pathUnder } from "./versions";

/** The <html> attributes the page's own scripts set, which the router's swap would drop. */
const CARRIED = ["data-js", "data-emoji", "data-theme", "data-file"];
const PERSIST = "data-astro-transition-persist";

let page: AbortController | undefined;

function start() {
  page?.abort();
  page = new AbortController();
  pageBehaviors(page.signal);
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
      const nav = kept.querySelector(".topbar-nav");
      const fresh = next.querySelector(".topbar-nav");
      if (nav && fresh) nav.replaceWith(document.importNode(fresh, true));
    } else if (kept.matches(".sidebar")) {
      refreshNavigator(kept, next);
    }
  }
}

function refreshNavigator(kept: HTMLElement, next: HTMLElement) {
  const focused = kept.contains(document.activeElement) ? (document.activeElement as HTMLAnchorElement).getAttribute?.("href") : null;
  const top = kept.scrollTop;
  for (const child of [...kept.children]) if (!child.matches(".nav-filter")) child.remove();
  for (const child of [...next.children]) if (!child.matches(".nav-filter")) kept.append(document.importNode(child, true));
  kept.scrollTop = top;
  // Keyboard users who chose a row stay on it.
  if (focused) kept.querySelector<HTMLElement>(`a[href="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  // The current page's row comes into view if it is out of it, as on a first load.
  const current = kept.querySelector<HTMLElement>('[aria-current="page"]');
  if (current && (current.offsetTop < kept.scrollTop || current.offsetTop > kept.scrollTop + kept.clientHeight - 40)) {
    kept.scrollTop = Math.max(0, current.offsetTop - kept.clientHeight / 3);
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
