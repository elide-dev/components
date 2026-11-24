/**
 * The page behaviors, as functions with no side effects at import. Each one finds its static markup and adds
 * behavior; with JavaScript off the pages lose these and nothing else.
 *
 * Every listener and observer is tied to an AbortSignal, so a caller can start the behaviors for a page and
 * stop them all at once. The static bundle (islands.tsx) starts them once per page load and never stops them.
 * The Astro client (src/astro/client.ts) starts them on every astro:page-load and stops them on
 * astro:before-swap, so the client router's page swaps never stack listeners.
 */
import { render } from "preact";

import { type Entry, search } from "./search";

declare global {
  interface Window {
    apidocsSearch?: Entry[];
  }
}


/** The site root, from the page: "../../" on a static page, the site's base path on an Astro page. */
export function siteRoot(): string {
  return document.documentElement.getAttribute("data-root") ?? "./";
}

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

// ---- Theme switch: system, light, dark; the choice persists where storage works.

export function themeSwitch(signal?: AbortSignal) {
  const button = document.querySelector<HTMLButtonElement>("[data-theme-switch]");
  if (!button) return;
  const modes = ["system", "light", "dark"] as const;
  type Mode = (typeof modes)[number];
  let mode: Mode = "system";
  try {
    const stored = storage()?.getItem("apidocs-theme");
    if (stored === "light" || stored === "dark") mode = stored;
  } catch {
    /* storage blocked: follow the system */
  }
  const apply = () => {
    if (mode === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", mode);
    button.dataset.mode = mode;
    button.setAttribute("aria-label", `Color theme: ${mode}. Change`);
    button.title = `Theme: ${mode}`;
  };
  button.hidden = false;
  apply();
  button.addEventListener("click", () => {
    mode = modes[(modes.indexOf(mode) + 1) % modes.length]!;
    try {
      if (mode === "system") storage()?.removeItem("apidocs-theme");
      else storage()?.setItem("apidocs-theme", mode);
    } catch {
      /* not persisted */
    }
    apply();
  }, { signal });
}

// ---- Copy buttons on signatures and code blocks.

export function copyButtons(signal?: AbortSignal) {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    button.hidden = false;
    button.addEventListener("click", async () => {
      const text = button.dataset.copyText ?? button.parentElement?.querySelector("pre")?.textContent ?? "";
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        try {
          ok = document.execCommand("copy");
        } catch {
          ok = false;
        }
        area.remove();
      }
      button.textContent = ok ? "Copied" : "Copy failed";
      button.dataset.copied = "";
      setTimeout(() => {
        button.textContent = "Copy";
        delete button.dataset.copied;
      }, 1500);
    }, { signal });
  }
}

// ---- Search over the lazily loaded index.

/** The static site's index: a script that assigns window.apidocsSearch, loaded once. */
export function loadIndex(): Promise<Entry[]> {
  if (window.apidocsSearch) return Promise.resolve(window.apidocsSearch);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${siteRoot()}assets/search-index.js`;
    script.onload = () => (window.apidocsSearch ? resolve(window.apidocsSearch) : reject(new Error("empty index")));
    script.onerror = () => reject(new Error("search index did not load"));
    document.head.appendChild(script);
  });
}

/** The result rows, linked from the site root. Shared by the static search box and the Astro search island. */
export function Results({ items, active, query, root }: { items: Entry[]; active: number; query: string; root: string }) {
  if (!items.length) return <li class="search-empty" role="presentation">No declarations match “{query}”.</li>;
  return (
    <>
      {items.map((item, i) => (
        <li key={item[2]} id={`apidocs-result-${i}`} role="option" aria-selected={i === active ? "true" : "false"}>
          <a href={root + item[2]} tabIndex={-1}>
            <span class="result-label"><Highlight text={item[0]} query={query} /></span>
            <span class="result-kind">{item[1]}</span>
            {(item[3] || item[4]) && <span class="result-context">{[item[3], item[4]].filter(Boolean).join(": ")}</span>}
          </a>
        </li>
      ))}
    </>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (at < 0 || !query.trim()) return <>{text}</>;
  const end = at + query.trim().length;
  return <>{text.slice(0, at)}<mark>{text.slice(at, end)}</mark>{text.slice(end)}</>;
}

/** The storage key that turns single-key shortcuts off (WCAG 2.2, 2.1.4): "off" when the reader has. */
export const KEYS_STORAGE = "apidocs-keys";

/** Whether the reader turned single-key shortcuts off. */
export function shortcutsOff(): boolean {
  try {
    return window.localStorage.getItem(KEYS_STORAGE) === "off";
  } catch {
    return false;
  }
}

/** Whether a key press is the given shortcut, typed outside a text field, with shortcuts on. */
export function isShortcut(event: KeyboardEvent, key: string): boolean {
  const target = event.target as HTMLElement;
  return event.key === key && !event.metaKey && !event.ctrlKey && !event.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) && !target.isContentEditable && !shortcutsOff();
}

export function searchBox(signal?: AbortSignal) {
  const box = document.querySelector<HTMLElement>("[data-search]");
  const input = box?.querySelector("input");
  const list = box?.querySelector<HTMLUListElement>("ul");
  if (!box || !input || !list) return;
  box.hidden = false;
  document.querySelector<HTMLElement>(".search-fallback")?.setAttribute("hidden", "");
  let items: Entry[] = [];
  let active = 0;
  let entries: Entry[] | undefined;

  const show = () => {
    const open = input.value.trim().length > 0;
    list.hidden = !open;
    input.setAttribute("aria-expanded", String(open));
    if (open) {
      render(<Results items={items} active={active} query={input.value} root={siteRoot()} />, list);
      input.setAttribute("aria-activedescendant", items.length ? `apidocs-result-${active}` : "");
      document.getElementById(`apidocs-result-${active}`)?.scrollIntoView({ block: "nearest" });
    }
  };
  const update = async () => {
    try {
      entries ??= await loadIndex();
    } catch {
      entries = [];
    }
    items = search(entries, input.value);
    active = 0;
    show();
  };
  input.addEventListener("focus", () => void loadIndex().then(e => (entries = e)).catch(() => undefined), { signal });
  input.addEventListener("input", () => void update(), { signal });
  input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!items.length) return;
      event.preventDefault();
      active = (active + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
      show();
    } else if (event.key === "Enter") {
      const item = items[active];
      if (item) {
        event.preventDefault();
        window.location.href = siteRoot() + item[2];
      }
    } else if (event.key === "Escape") {
      input.value = "";
      items = [];
      show();
      input.blur();
    }
  }, { signal });
  document.addEventListener("click", event => {
    if (!box.contains(event.target as Node)) {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
    }
  }, { signal });
  document.addEventListener("keydown", event => {
    if (isShortcut(event, "/")) {
      event.preventDefault();
      input.focus();
    }
  }, { signal });
}

// ---- The navigator's scroll position across full page loads: saved when the page goes, restored on load.

/** The key the navigator's scroll position is stored under: one per site. */
export function navScrollKey(): string {
  return `apidocs-nav:${new URL(siteRoot(), window.location.href).pathname}`;
}

export function navigatorScroll(signal?: AbortSignal) {
  const nav = document.querySelector<HTMLElement>(".sidebar");
  if (!nav) return;
  const key = navScrollKey();
  try {
    const saved = window.sessionStorage.getItem(key);
    if (saved) nav.scrollTop = Number(saved);
  } catch {
    /* storage blocked */
  }
  const currentLink = nav.querySelector<HTMLElement>('[aria-current="page"]');
  // Only when the current row is out of view, as the head script does: a navigator moved for no reason leaves its top
  // rows half under the filter field.
  if (currentLink && (currentLink.offsetTop < nav.scrollTop || currentLink.offsetTop > nav.scrollTop + nav.clientHeight - 40)) {
    nav.scrollTop = window.apidocsNavTop?.(nav, currentLink) ?? Math.max(0, currentLink.offsetTop - nav.clientHeight / 3);
  }
  saveNavigatorScroll(signal);
}

/** Saves the navigator's scroll position when the page is left, for the next page of the site to restore. */
export function saveNavigatorScroll(signal?: AbortSignal) {
  window.addEventListener("pagehide", () => {
    const nav = document.querySelector<HTMLElement>(".sidebar");
    if (!nav) return;
    try {
      window.sessionStorage.setItem(navScrollKey(), String(nav.scrollTop));
    } catch {
      /* storage blocked */
    }
  }, { signal });
}

// ---- The navigator's filter: narrow the tree to rows that match, with the branches that lead to them.

/**
 * Filters the navigator's tree under `scope` (case-insensitive). A row that matches stays, with everything under it
 * (a package that matches keeps its types); a branch stays when anything under it matches, and opens while the filter
 * has text (data-filter-open), without changing the reader's own folding. An empty query clears it all.
 */
export function filterTree(scope: Element, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();
  const visit = (item: HTMLElement, inherited: boolean): boolean => {
    const own = item.querySelector<HTMLElement>(":scope > .nav-branch-row, :scope > .nav-row");
    const hit = inherited || !query || (own ? (own.textContent ?? "").toLowerCase().includes(query) : false);
    let below = false;
    // The list items whose nearest enclosing item is this one: its children, through the wrapper that holds a list.
    for (const child of item.querySelectorAll<HTMLElement>("li")) {
      if (child.parentElement?.closest("li") !== item) continue;
      if (visit(child, hit && !!query)) below = true;
    }
    const shown = hit || below;
    item.toggleAttribute("data-filtered-out", !shown);
    item.toggleAttribute("data-filter-open", !!query && below);
    return shown;
  };
  for (const list of scope.querySelectorAll<HTMLElement>(".nav-section[data-nav-filterable] > ul")) {
    for (const item of list.querySelectorAll<HTMLElement>(":scope > li")) visit(item, false);
  }
}

/** The navigator's rows the filter narrows: guides, packages and types. The sites stay. */
export const NAV_FILTERED_ROWS = ".nav-section[data-nav-filterable] li";

export function navigatorFilter(signal?: AbortSignal) {
  const box = document.querySelector<HTMLElement>("[data-nav-filter]");
  const input = box?.querySelector<HTMLInputElement>("input");
  const nav = box?.closest<HTMLElement>(".sidebar");
  if (!box || !input || !nav) return;
  box.hidden = false;
  const apply = () => filterTree(nav, input.value);
  input.addEventListener("input", apply, { signal });
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      input.value = "";
      apply();
    }
  }, { signal });
  // A filter that kept its text across a client-side navigation applies to the new page's rows at once.
  if (input.value.trim()) apply();
}

// ---- The navigator's folds: each branch's twisty, and the button that folds or opens them all.

/** Sets a branch folded or open, and its twisty's state. */
export function setFolded(branch: HTMLElement, folded: boolean) {
  branch.toggleAttribute("data-folded", folded);
  const twisty = branch.querySelector<HTMLButtonElement>(":scope > .nav-branch-row > .nav-twisty");
  if (twisty?.tagName === "BUTTON") {
    twisty.setAttribute("aria-expanded", String(!folded));
    const label = twisty.getAttribute("aria-label") ?? "";
    twisty.setAttribute("aria-label", label.replace(/: (fold|unfold)$/, folded ? ": unfold" : ": fold"));
  }
}

type FoldAction = "collapse" | "expand" | "restore";
const foldLabels = { collapse: "Collapse all", expand: "Expand all", restore: "Restore previous layout" } as const;

// The Astro router keeps the sidebar element across pages but replaces its branches.
const priorFolds = new WeakMap<Element, Set<string>>();

function foldAction(button: HTMLButtonElement, action: FoldAction) {
  button.dataset.action = action;
  button.setAttribute("aria-label", foldLabels[action]);
  button.title = foldLabels[action];
}

/** An individual change starts a fresh cycle with the tree as it now stands. */
export function syncFoldAll(nav: Element) {
  const button = nav.querySelector<HTMLButtonElement>("[data-nav-fold-all]");
  if (!button) return;
  priorFolds.delete(nav);
  const anyOpen = nav.querySelector(".nav-branch:not([data-folded])");
  foldAction(button, anyOpen ? "collapse" : "expand");
}

export function navigatorFolds(signal?: AbortSignal) {
  const nav = document.querySelector<HTMLElement>(".sidebar");
  if (!nav) return;
  if (!priorFolds.has(nav)) syncFoldAll(nav);
  nav.addEventListener("click", event => {
    const target = event.target as Element;
    const twisty = target.closest?.("button.nav-twisty");
    if (twisty) {
      const branch = twisty.closest<HTMLElement>(".nav-branch")!;
      setFolded(branch, !branch.hasAttribute("data-folded"));
      syncFoldAll(nav);
      return;
    }
    const all = target.closest?.<HTMLButtonElement>("[data-nav-fold-all]");
    if (!all) return;
    const branches = [...nav.querySelectorAll<HTMLElement>(".nav-branch")];
    const action = all.dataset.action;
    if (action === "collapse") {
      const folded = branches.filter(branch => branch.hasAttribute("data-folded"));
      if (folded.length) priorFolds.set(nav, new Set(folded.map(branch => branch.dataset.navKey!)));
    }
    for (const branch of branches) {
      setFolded(branch, action === "collapse" || (action === "restore" && !!priorFolds.get(nav)?.has(branch.dataset.navKey!)));
    }
    if (action === "expand" && priorFolds.has(nav)) foldAction(all, "restore");
    else if (action === "collapse") foldAction(all, "expand");
    else syncFoldAll(nav);
  }, { signal });
}

function navigatorScrollbar(signal?: AbortSignal) {
  const nav = document.querySelector<HTMLElement>(".sidebar");
  if (!nav) return;
  let timer: ReturnType<typeof setTimeout>;
  const idle = () => {
    clearTimeout(timer);
    nav.removeAttribute("data-scrolling");
  };
  nav.addEventListener("scroll", () => {
    clearTimeout(timer);
    nav.setAttribute("data-scrolling", "");
    timer = setTimeout(idle, 180);
  }, { passive: true, signal });
  signal?.addEventListener("abort", idle, { once: true });
}

// ---- Copy the page as Markdown: read the Markdown file beside the page and put it on the clipboard.

export function copyMarkdown(signal?: AbortSignal) {
  const button = document.querySelector<HTMLButtonElement>("[data-copy-markdown]");
  if (!button) return;
  const url = button.dataset.copyMarkdown!;
  button.addEventListener("click", () => {
    // XMLHttpRequest, not the newer API: the control exists only on a served page (data-served-only), and the
    // output check forbids the newer call everywhere so that no page can come to depend on it from file://.
    const request = new XMLHttpRequest();
    request.open("GET", url);
    request.responseType = "text";
    const fail = () => {
      window.location.href = url;
    };
    request.onerror = fail;
    request.onload = async () => {
      if (request.status < 200 || request.status >= 300) return fail();
      try {
        // The page's text, as a reader pastes it: without the frontmatter that describes it to programs.
        await navigator.clipboard.writeText(request.responseText.replace(/^---\n[\s\S]*?\n---\n\n?/, ""));
      } catch {
        return fail();
      }
      button.dataset.copied = "";
      button.setAttribute("aria-label", "Copied");
      setTimeout(() => {
        delete button.dataset.copied;
        button.setAttribute("aria-label", "Copy this page as Markdown");
      }, 1600);
    };
    request.send();
  }, { signal });
}

// ---- Menus built on <details>: close on Escape and on a click elsewhere.

/** The menus this closes: the page's formats menu, the suite menu, and a site's version menu. */
const MENUS = "details.formats-menu[open], details.suite-menu[open], details.version-menu[open]";

export function menus(signal?: AbortSignal) {
  const open = () => document.querySelectorAll<HTMLDetailsElement>(MENUS);
  document.addEventListener("click", event => {
    for (const menu of open()) if (!menu.contains(event.target as Node)) menu.open = false;
  }, { signal });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    for (const menu of open()) {
      menu.open = false;
      menu.querySelector<HTMLElement>("summary")?.focus();
    }
  }, { signal });
}

// ---- The suite switcher: the layout alone shows its row or its menu (SuiteSwitcher in chrome.tsx). The top bar's
// script (SUITES_BOOT) also sizes it to what it shows, and hides the other from assistive technology and the
// keyboard; this runs that again whenever the tools' width changes, and closes the menu when the row takes its place.

declare global {
  interface Window {
    apidocsFitSuites?: () => void;
    /** Where the navigator scrolls to show a row (NAV_BOOT in chrome.tsx). */
    apidocsNavTop?: (nav: HTMLElement, row: HTMLElement) => number;
  }
}

export function suiteSwitcher(signal?: AbortSignal) {
  const box = document.querySelector<HTMLElement>(".suites");
  const tools = box?.parentElement;
  if (!box || !tools || !window.apidocsFitSuites || !("ResizeObserver" in window)) return;
  const fit = () => {
    window.apidocsFitSuites?.();
    const menu = box.querySelector<HTMLDetailsElement>("details.suite-menu");
    if (menu?.open && box.dataset.fit !== "menu") menu.open = false;
  };
  // At once, for a top bar the client router has just put in place, and then whenever the tools' width changes.
  fit();
  const observer = new ResizeObserver(fit);
  observer.observe(tools);
  document.fonts?.addEventListener("loadingdone", fit, { signal });
  signal?.addEventListener("abort", () => observer.disconnect(), { once: true });
}

// ---- The suite switcher keeps the reader's place: each entry leads back to the page last read in that site.

/** The session key for the last page read in the site an entry names. */
function suiteKey(link: HTMLAnchorElement): string {
  return `apidocs-suite:${new URL(link.dataset.suite!, window.location.href).pathname}`;
}

export function suiteMemory(signal?: AbortSignal) {
  const links = () => [...document.querySelectorAll<HTMLAnchorElement>("a[data-suite]")];
  const update = () => {
    const all = links();
    const current = all.find(link => link.getAttribute("aria-current") === "true");
    try {
      const store = window.sessionStorage;
      if (current) store.setItem(suiteKey(current), window.location.pathname + window.location.search + window.location.hash);
      for (const link of all) {
        if (link === current || link.getAttribute("aria-current") === "true") continue;
        const saved = store.getItem(suiteKey(link));
        // Only a path on this origin: the stored value came from this site, but is checked all the same.
        if (saved && saved.startsWith("/") && !saved.startsWith("//")) link.href = saved;
      }
    } catch {
      /* storage blocked: the entries lead to each site's overview */
    }
  };
  update();
  window.addEventListener("hashchange", update, { signal });
}

// ---- Folded descriptions: a long description shows its first lines and a control that shows the rest.

export function folds(signal?: AbortSignal) {
  for (const fold of document.querySelectorAll<HTMLElement>("[data-fold]")) {
    const body = fold.querySelector<HTMLElement>(":scope > .fold-body");
    const button = fold.querySelector<HTMLButtonElement>(":scope > .fold-toggle");
    if (!body || !button) continue;
    // Only a description longer than its folded height gets the control; a short one shows whole.
    const long = body.scrollHeight > body.clientHeight + 2;
    fold.toggleAttribute("data-short", !long);
    button.hidden = !long;
    // The blocks wholly below the folded height wait in a part hidden "until found": find in page searches it and,
    // on a match, fires beforematch there and reveals it, so the fold opens to show the match. The block the fold
    // cuts through stays, faded as before, so the folded description looks and measures the same.
    let rest: HTMLElement | null = null;
    if (long) {
      // The blocks are the children of the innermost wrapper (the body holds one .prose).
      let container: HTMLElement = body;
      while (container.children.length === 1 && container.firstElementChild!.children.length > 1) {
        container = container.firstElementChild as HTMLElement;
      }
      const blocks = [...container.children] as HTMLElement[];
      const top = body.getBoundingClientRect().top;
      const cut = blocks.findIndex((block, i) => i > 0 && block.getBoundingClientRect().top - top >= body.clientHeight);
      if (cut > 0) {
        rest = document.createElement("div");
        rest.className = "fold-rest";
        rest.append(...blocks.slice(cut));
        container.append(rest);
        rest.setAttribute("hidden", "until-found");
      }
    }
    const set = (open: boolean) => {
      fold.toggleAttribute("data-open", open);
      button.setAttribute("aria-expanded", String(open));
      button.textContent = open ? "Show less" : "Show more";
      if (rest) {
        if (open) rest.removeAttribute("hidden");
        else rest.setAttribute("hidden", "until-found");
      }
    };
    button.addEventListener("click", () => set(!fold.hasAttribute("data-open")), { signal });
    rest?.addEventListener("beforematch", () => set(true), { signal });
    // A match in the clipped lines of the block the fold cuts through: find in page scrolls the folded body (a scroll container,
    // overflow: hidden) to show it. Open the fold there instead, and move the page by as much, so the match stays
    // where the reader saw it.
    body.addEventListener("scroll", () => {
      const by = body.scrollTop;
      if (by === 0 || fold.hasAttribute("data-open")) return;
      body.scrollTop = 0;
      set(true);
      window.scrollBy(0, by);
    }, { signal, passive: true });
  }
  // A link into a folded description opens it.
  const reveal = () => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const fold = id ? document.getElementById(id)?.closest<HTMLElement>("[data-fold]") : null;
    if (fold && !fold.hasAttribute("data-open")) fold.querySelector<HTMLButtonElement>(":scope > .fold-toggle")?.click();
  };
  window.addEventListener("hashchange", reveal, { signal });
  reveal();
}

// ---- Leaving for another page of this site: start the load bar; the next page finishes it.

export function leaving(signal?: AbortSignal) {
  const here = () => window.location.href.replace(/#.*$/, "");
  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
    if (!link || link.target || link.hasAttribute("download")) return;
    if (link.origin !== window.location.origin || link.href.replace(/#.*$/, "") === here()) return;
    if (!/\.html$/.test(link.pathname)) return;
    document.documentElement.setAttribute("data-leaving", "");
    try {
      window.sessionStorage.setItem("apidocs-load", "1");
    } catch {
      /* storage blocked: the next page simply does not finish the bar */
    }
  }, { signal });
  // Back from the page cache: this page never unloaded, so clear what the click left.
  window.addEventListener("pageshow", () => document.documentElement.removeAttribute("data-leaving"), { signal });
}

// ---- Folded members: open or fold a whole group; open the member a link points at.

export function members(signal?: AbortSignal) {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-expand-all]")) {
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") !== "true";
      for (const member of button.closest("section")!.querySelectorAll<HTMLDetailsElement>("details.member")) member.open = open;
      button.setAttribute("aria-expanded", String(open));
      button.textContent = open ? "Collapse all" : "Expand all";
    }, { signal });
  }
  // Browsers open a closed disclosure when a link lands inside it; this covers the ones that do not.
  const reveal = () => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const fold = id ? document.getElementById(id)?.closest("details") : null;
    if (fold && !fold.open) {
      fold.open = true;
      document.getElementById(id)?.scrollIntoView();
    }
  };
  window.addEventListener("hashchange", reveal, { signal });
  reveal();
}

// ---- The keyboard. One key each, typed outside a text field, and listed by "?" or the footer's link, where the
// reader can turn them off. The navigator's tree is one stop in the tab order, moved through with the arrow keys, so
// Tab goes from the top bar to the navigator's filter, its tree and the content in a few presses.

/** Every shortcut, in the order the list shows them. */
export const SHORTCUTS: readonly { keys: string[]; what: string }[] = [
  { keys: ["/"], what: "Search" },
  { keys: ["["], what: "Show or hide the navigator" },
  { keys: ["j", "k"], what: "Next or previous member" },
  { keys: ["n", "p"], what: "Next or previous page, in the navigator's order" },
  { keys: ["u"], what: "Up: the package, or the overview" },
  { keys: ["?"], what: "This list" },
];

/** The rows a reader can reach in the navigator now: shown, not filtered out, not inside a folded branch. */
function visibleRows(nav: Element): HTMLElement[] {
  return [...nav.querySelectorAll<HTMLElement>(".nav-tree .nav-row, .nav-list .nav-row")].filter(row => row.offsetParent !== null || row.getClientRects().length > 0);
}

/**
 * The navigator's tree as one tab stop: the current page's row (or the first one shown) takes focus from Tab, and the
 * arrow keys move between rows: up and down, right to open a branch or enter it, left to fold it or reach its parent,
 * Home and End. Enter follows the row's link. Without the script every row is a stop, as links are.
 */
export function navigatorKeys(signal?: AbortSignal) {
  const nav = document.getElementById("apidocs-nav");
  if (!nav) return;
  const tree = (): HTMLElement[] => [...nav.querySelectorAll<HTMLElement>(".nav-row")];
  for (const twisty of nav.querySelectorAll<HTMLElement>("button.nav-twisty")) twisty.tabIndex = -1;
  let active: HTMLElement | undefined;
  const settle = (row?: HTMLElement) => {
    const shown = visibleRows(nav);
    const next = row && shown.includes(row) ? row
      : active && shown.includes(active) ? active
      : shown.find(r => r.hasAttribute("aria-current")) ?? shown[0];
    for (const r of tree()) r.tabIndex = r === next ? 0 : -1;
    active = next;
  };
  settle();
  // Folding and filtering change which rows are shown; the stop moves to one that is.
  const observer = new MutationObserver(() => settle());
  observer.observe(nav, { subtree: true, attributes: true, attributeFilter: ["data-folded", "data-filtered-out", "data-filter-open", "hidden"] });
  signal?.addEventListener("abort", () => observer.disconnect());
  const branchOf = (row: HTMLElement) => {
    const branch = row.closest<HTMLElement>(".nav-branch");
    return branch && branch.querySelector(":scope > .nav-branch-row > .nav-row") === row ? branch : null;
  };
  const go = (row: HTMLElement | undefined) => {
    if (!row) return;
    settle(row);
    row.focus();
  };
  nav.addEventListener("focusin", event => {
    const row = (event.target as HTMLElement).closest?.<HTMLElement>(".nav-row");
    if (row) settle(row);
  }, { signal });
  nav.addEventListener("keydown", event => {
    const row = (event.target as HTMLElement).closest?.<HTMLElement>(".nav-row");
    if (!row || event.altKey || event.ctrlKey || event.metaKey) return;
    const shown = visibleRows(nav);
    const at = shown.indexOf(row);
    const branch = branchOf(row);
    const folded = branch?.hasAttribute("data-folded") && !branch.hasAttribute("data-filter-open");
    const rtl = getComputedStyle(nav).direction === "rtl";
    const key = rtl && event.key === "ArrowRight" ? "ArrowLeft" : rtl && event.key === "ArrowLeft" ? "ArrowRight" : event.key;
    switch (key) {
      case "ArrowDown": go(shown[at + 1]); break;
      case "ArrowUp": go(shown[at - 1]); break;
      case "Home": go(shown[0]); break;
      case "End": go(shown[shown.length - 1]); break;
      case "ArrowRight":
        if (branch && folded) {
          setFolded(branch, false);
          syncFoldAll(nav);
        } else if (branch) go(shown[at + 1]);
        else return;
        break;
      case "ArrowLeft": {
        if (branch && !folded) {
          setFolded(branch, true);
          syncFoldAll(nav);
          break;
        }
        const parent = row.closest(".nav-children")?.closest<HTMLElement>(".nav-branch");
        const parentRow = parent?.querySelector<HTMLElement>(":scope > .nav-branch-row > .nav-row");
        if (!parentRow) return;
        go(parentRow);
        break;
      }
      default: return;
    }
    event.preventDefault();
  }, { signal });
}

/** The shortcut list: a dialog made the first time it is asked for. */
function shortcutDialog(): HTMLDialogElement {
  const existing = document.querySelector<HTMLDialogElement>("dialog.keys");
  if (existing) return existing;
  const dialog = document.createElement("dialog");
  dialog.className = "keys";
  dialog.setAttribute("aria-labelledby", "apidocs-keys-title");
  const rows = SHORTCUTS.map(s => `<tr><td>${s.keys.map(k => `<kbd>${k}</kbd>`).join(" ")}</td><td>${s.what}</td></tr>`).join("");
  // Markup from SHORTCUTS, constant text, so innerHTML takes nothing a reader or a page wrote.
  dialog.innerHTML =
    `<form method="dialog"><h2 id="apidocs-keys-title">Keyboard shortcuts</h2>` +
    `<table><tbody>${rows}<tr><td><kbd>Tab</kbd></td><td>The top bar, the navigator's filter, its tree (arrow keys inside), then the page</td></tr></tbody></table>` +
    `<label class="keys-switch"><input type="checkbox" data-keys-switch> Single-key shortcuts</label>` +
    `<button class="keys-close" value="close">Close</button></form>`;
  document.body.append(dialog);
  const box = dialog.querySelector<HTMLInputElement>("[data-keys-switch]")!;
  box.addEventListener("change", () => {
    try {
      window.localStorage.setItem(KEYS_STORAGE, box.checked ? "on" : "off");
    } catch {
      /* storage blocked: the choice lasts for this page */
    }
  });
  // A click on the backdrop closes it.
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  return dialog;
}

export function openShortcuts() {
  const dialog = shortcutDialog();
  dialog.querySelector<HTMLInputElement>("[data-keys-switch]")!.checked = !shortcutsOff();
  if (!dialog.open) dialog.showModal();
}

/** The next or previous member: the one after (or before) the focused member, or the first below the top bar. */
function memberStep(dir: 1 | -1) {
  // The rows shown: inherited ones are hidden while the page shows declared members only.
  const rows = [...document.querySelectorAll<HTMLElement>(".members > .member > .member-row")].filter(r => r.getClientRects().length > 0);
  if (!rows.length) return;
  const focused = rows.findIndex(r => r === document.activeElement);
  let at: number;
  if (focused >= 0) at = focused + dir;
  else {
    const top = document.querySelector<HTMLElement>(".topbar")?.offsetHeight ?? 0;
    const below = rows.findIndex(r => r.getBoundingClientRect().top > top + 1);
    at = below < 0 ? (dir > 0 ? rows.length : rows.length - 1) : dir > 0 ? below : below - 1;
  }
  const row = rows[Math.max(0, Math.min(rows.length - 1, at))];
  row?.focus();
  row?.scrollIntoView({ block: "nearest" });
}

/** The page after or before this one in the navigator, folded branches included. */
function pageStep(dir: 1 | -1) {
  const rows = [...document.querySelectorAll<HTMLAnchorElement>("#apidocs-nav a.nav-row[href]:not(.nav-group-row)")];
  const at = rows.findIndex(r => r.getAttribute("aria-current") === "page");
  const next = at >= 0 ? rows[at + dir] : undefined;
  if (next) next.click();
}

/** Up a level: the breadcrumbs' last link, which is the package for a type and the overview for a package. */
function up() {
  const links = document.querySelectorAll<HTMLAnchorElement>(".crumbs a[href]");
  links[links.length - 1]?.click();
}

export function shortcuts(signal?: AbortSignal) {
  navigatorKeys(signal);
  document.addEventListener("click", event => {
    if ((event.target as HTMLElement).closest?.("[data-keys-open]")) openShortcuts();
  }, { signal });
  document.addEventListener("keydown", event => {
    if (isShortcut(event, "?")) openShortcuts();
    else if (isShortcut(event, "j")) memberStep(1);
    else if (isShortcut(event, "k")) memberStep(-1);
    else if (isShortcut(event, "n")) pageStep(1);
    else if (isShortcut(event, "p")) pageStep(-1);
    else if (isShortcut(event, "u")) up();
    else return;
    event.preventDefault();
  }, { signal });
}

// ---- Declared or all members: the type page's switch, kept across pages and in the URL (?members=all), so a link
// shows what its writer saw.

export const MEMBERS_STORAGE = "apidocs-members";

export function membersFilter(signal?: AbortSignal) {
  const radios = [...document.querySelectorAll<HTMLInputElement>("input[data-members-filter]")];
  if (!radios.length) return;
  const set = (value: string) => {
    for (const radio of radios) radio.checked = radio.value === value;
  };
  const fromUrl = new URL(location.href).searchParams.get("members");
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(MEMBERS_STORAGE);
  } catch {
    /* storage blocked */
  }
  const initial = fromUrl === "all" || fromUrl === "declared" ? fromUrl : stored === "all" ? "all" : "declared";
  set(initial);
  for (const radio of radios) {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      try {
        window.localStorage.setItem(MEMBERS_STORAGE, radio.value);
      } catch {
        /* storage blocked */
      }
      const url = new URL(location.href);
      if (radio.value === "all") url.searchParams.set("members", "all");
      else url.searchParams.delete("members");
      history.replaceState(history.state, "", url);
    }, { signal });
  }
}

// ---- The navigator toggle: remember "hidden" on wide screens; "[" toggles it.

export function navigatorToggle(signal?: AbortSignal) {
  const toggle = document.querySelector<HTMLInputElement>("#apidocs-nav-toggle");
  if (!toggle) return;
  const wide = window.matchMedia("(min-width: 861px)");
  toggle.addEventListener("change", () => {
    if (!wide.matches) return;
    try {
      window.localStorage.setItem("apidocs-nav", toggle.checked ? "closed" : "open");
    } catch {
      /* storage blocked */
    }
  }, { signal });
  // A narrow screen's open panel must not become a hidden navigator when the window grows, or the reverse.
  wide.addEventListener("change", () => {
    let closed = false;
    try {
      closed = window.localStorage.getItem("apidocs-nav") === "closed";
    } catch {
      /* storage blocked */
    }
    toggle.checked = wide.matches && closed;
  }, { signal });
  document.addEventListener("keydown", event => {
    if (isShortcut(event, "[")) {
      toggle.checked = !toggle.checked;
      toggle.dispatchEvent(new Event("change"));
    }
  }, { signal });
}

/** The behaviors every page has, whichever renderer wrote it. Search and the load bar differ, so callers add those. */
export function pageBehaviors(signal?: AbortSignal) {
  themeSwitch(signal);
  copyButtons(signal);
  navigatorToggle(signal);
  copyMarkdown(signal);
  members(signal);
  menus(signal);
  suiteSwitcher(signal);
  suiteMemory(signal);
  navigatorFilter(signal);
  navigatorFolds(signal);
  navigatorScrollbar(signal);
  folds(signal);
  shortcuts(signal);
  membersFilter(signal);
}
