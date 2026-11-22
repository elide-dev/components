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
      const text = button.parentElement?.querySelector("pre")?.textContent ?? "";
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

function loadIndex(): Promise<Entry[]> {
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

/** Whether a key press is the given shortcut, typed outside a text field. */
export function isShortcut(event: KeyboardEvent, key: string): boolean {
  const target = event.target as HTMLElement;
  return event.key === key && !event.metaKey && !event.ctrlKey && !event.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) && !target.isContentEditable;
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

// ---- Table of contents: mark the section in view.

export function tableOfContents(signal?: AbortSignal) {
  const toc = document.querySelector<HTMLElement>(".toc");
  const links = new Map<string, HTMLAnchorElement>();
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-toc-target]")) links.set(link.dataset.tocTarget!, link);
  if (!toc || !links.size || !("IntersectionObserver" in window)) return;
  const visible = new Set<string>();
  let current: HTMLAnchorElement | undefined;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target.id);
      else visible.delete(entry.target.id);
    }
    // The most specific entry in view: a member over the section that contains it.
    let first: HTMLAnchorElement | undefined;
    for (const [id, link] of links) {
      if (!visible.has(id)) continue;
      if (!first || (link.closest(".toc-entries") && !first.closest(".toc-entries"))) first = link;
      if (first.closest(".toc-entries")) break;
    }
    if (first && first !== current) {
      current?.removeAttribute("aria-current");
      first.setAttribute("aria-current", "true");
      current = first;
      const fold = first.closest("details");
      if (fold) fold.open = true;
      const top = first.offsetTop - toc.clientHeight / 3;
      if (first.offsetTop < toc.scrollTop || first.offsetTop > toc.scrollTop + toc.clientHeight - 40) toc.scrollTop = Math.max(0, top);
    }
  }, { rootMargin: "-56px 0px -55% 0px" });
  for (const id of links.keys()) {
    const target = document.getElementById(id);
    if (target) observer.observe(target);
  }
  signal?.addEventListener("abort", () => observer.disconnect(), { once: true });
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
  let restored = false;
  try {
    const saved = window.sessionStorage.getItem(key);
    if (saved) {
      nav.scrollTop = Number(saved);
      restored = true;
    }
  } catch {
    /* storage blocked */
  }
  const currentLink = nav.querySelector<HTMLElement>('[aria-current="page"]');
  if (currentLink && (!restored || currentLink.offsetTop < nav.scrollTop || currentLink.offsetTop > nav.scrollTop + nav.clientHeight)) {
    nav.scrollTop = Math.max(0, currentLink.offsetTop - nav.clientHeight / 3);
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

// ---- List filters: narrow the navigator, or the page rail and the member summary, to rows that match.

/** Marks the rows under `scope` that do not contain the query (case-insensitive), and opens folds while filtering. */
export function filterRows(scope: Element, rowSelector: string, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();
  for (const fold of scope.querySelectorAll<HTMLDetailsElement>("details")) if (query) fold.open = true;
  for (const row of scope.querySelectorAll<HTMLElement>(rowSelector)) {
    const hit = !query || (row.textContent ?? "").toLowerCase().includes(query);
    row.toggleAttribute("data-filtered-out", !hit);
  }
}

/** The navigator rows its filter narrows: types and guides. The sites, the indexes and the packages always stay. */
export const NAV_FILTERED_ROWS = ".nav-section[data-nav-filterable] .nav-list > li";

export function listFilter(boxSelector: string, rowSelector: string, also: string | undefined, signal?: AbortSignal) {
  const box = document.querySelector<HTMLElement>(boxSelector);
  const input = box?.querySelector<HTMLInputElement>("input");
  if (!box || !input) return;
  box.hidden = false;
  const apply = () => {
    filterRows(box.parentElement!, rowSelector, input.value);
    if (also) {
      const query = input.value.trim().toLowerCase();
      for (const row of document.querySelectorAll<HTMLElement>(also)) {
        const head = row.querySelector("summary, th");
        // A member row's summary sentence is drawn from an attribute (MemberDetail), so it is read from there too.
        const text = `${head?.textContent ?? ""} ${head?.querySelector("[data-brief]")?.getAttribute("data-brief") ?? ""}`;
        const hit = !query || text.toLowerCase().includes(query);
        row.toggleAttribute("data-filtered-out", !hit);
      }
    }
  };
  input.addEventListener("input", apply, { signal });
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      input.value = "";
      input.dispatchEvent(new Event("input"));
    }
  }, { signal });
  // A filter that kept its text across a client-side navigation applies to the new page's rows at once.
  if (input.value.trim()) apply();
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
  tableOfContents(signal);
  navigatorToggle(signal);
  copyMarkdown(signal);
  members(signal);
  menus(signal);
  suiteSwitcher(signal);
  // Types and guides only: the sites, the indexes and the packages stay, so the way to another one is never filtered away.
  listFilter("[data-nav-filter]", NAV_FILTERED_ROWS, undefined, signal);
  listFilter("[data-toc-filter]", ".toc-entries > li", ".members > details.member", signal);
}
