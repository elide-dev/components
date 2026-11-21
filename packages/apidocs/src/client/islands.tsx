/**
 * The client bundle: four small islands over prerendered pages. Each one finds
 * its static markup and adds behavior; with JavaScript off the pages lose these
 * and nothing else. Classic script, no modules, no fetch: the search index is a
 * script that assigns window.apidocsSearch, loaded on first use.
 */
import { render } from "preact";

import { type Entry, search } from "./search";

declare global {
  interface Window {
    apidocsSearch?: Entry[];
  }
}

const doc = document;
const root = doc.documentElement.getAttribute("data-root") ?? "./";

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

// ---- Theme switch: system, light, dark; the choice persists where storage works.

function themeSwitch() {
  const button = doc.querySelector<HTMLButtonElement>("[data-theme-switch]");
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
    if (mode === "system") doc.documentElement.removeAttribute("data-theme");
    else doc.documentElement.setAttribute("data-theme", mode);
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
  });
}

// ---- Copy buttons on signatures and code blocks.

function copyButtons() {
  for (const button of doc.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    button.hidden = false;
    button.addEventListener("click", async () => {
      const text = button.parentElement?.querySelector("pre")?.textContent ?? "";
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        const area = doc.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        doc.body.appendChild(area);
        area.select();
        try {
          ok = doc.execCommand("copy");
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
    });
  }
}

// ---- Search over the lazily loaded index.

function loadIndex(): Promise<Entry[]> {
  if (window.apidocsSearch) return Promise.resolve(window.apidocsSearch);
  return new Promise((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = `${root}assets/search-index.js`;
    script.onload = () => (window.apidocsSearch ? resolve(window.apidocsSearch) : reject(new Error("empty index")));
    script.onerror = () => reject(new Error("search index did not load"));
    doc.head.appendChild(script);
  });
}

function Results({ items, active, query }: { items: Entry[]; active: number; query: string }) {
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

function searchBox() {
  const box = doc.querySelector<HTMLElement>("[data-search]");
  const input = box?.querySelector("input");
  const list = box?.querySelector<HTMLUListElement>("ul");
  if (!box || !input || !list) return;
  box.hidden = false;
  doc.querySelector<HTMLElement>(".search-fallback")?.setAttribute("hidden", "");
  let items: Entry[] = [];
  let active = 0;
  let entries: Entry[] | undefined;

  const show = () => {
    const open = input.value.trim().length > 0;
    list.hidden = !open;
    input.setAttribute("aria-expanded", String(open));
    if (open) {
      render(<Results items={items} active={active} query={input.value} />, list);
      input.setAttribute("aria-activedescendant", items.length ? `apidocs-result-${active}` : "");
      doc.getElementById(`apidocs-result-${active}`)?.scrollIntoView({ block: "nearest" });
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
  input.addEventListener("focus", () => void loadIndex().then(e => (entries = e)).catch(() => undefined));
  input.addEventListener("input", () => void update());
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
        window.location.href = root + item[2];
      }
    } else if (event.key === "Escape") {
      input.value = "";
      items = [];
      show();
      input.blur();
    }
  });
  doc.addEventListener("click", event => {
    if (!box.contains(event.target as Node)) {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
    }
  });
  doc.addEventListener("keydown", event => {
    const target = event.target as HTMLElement;
    if (event.key === "/" && !event.metaKey && !event.ctrlKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) && !target.isContentEditable) {
      event.preventDefault();
      input.focus();
    }
  });
}

// ---- Table of contents: mark the section in view; keep the navigation's scroll position.

function tableOfContents() {
  const toc = doc.querySelector<HTMLElement>(".toc");
  const links = new Map<string, HTMLAnchorElement>();
  for (const link of doc.querySelectorAll<HTMLAnchorElement>("[data-toc-target]")) links.set(link.dataset.tocTarget!, link);
  if (toc && links.size && "IntersectionObserver" in window) {
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
      const target = doc.getElementById(id);
      if (target) observer.observe(target);
    }
  }

  const nav = doc.querySelector<HTMLElement>(".sidebar");
  if (nav) {
    const key = `apidocs-nav:${new URL(root, window.location.href).pathname}`;
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
    window.addEventListener("pagehide", () => {
      try {
        window.sessionStorage.setItem(key, String(nav.scrollTop));
      } catch {
        /* storage blocked */
      }
    });
  }
}

// ---- List filters: narrow the navigator, or the page rail and the member summary, to rows that match.

function listFilter(boxSelector: string, rowSelector: string, also?: string) {
  const box = doc.querySelector<HTMLElement>(boxSelector);
  const input = box?.querySelector<HTMLInputElement>("input");
  if (!box || !input) return;
  box.hidden = false;
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    const scope = box.parentElement!;
    for (const fold of scope.querySelectorAll<HTMLDetailsElement>("details")) if (query) fold.open = true;
    for (const row of scope.querySelectorAll<HTMLElement>(rowSelector)) {
      const hit = !query || (row.textContent ?? "").toLowerCase().includes(query);
      row.toggleAttribute("data-filtered-out", !hit);
    }
    if (also) {
      for (const row of doc.querySelectorAll<HTMLElement>(also)) {
        const hit = !query || (row.querySelector("th")?.textContent ?? "").toLowerCase().includes(query);
        row.toggleAttribute("data-filtered-out", !hit);
      }
    }
  });
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      input.value = "";
      input.dispatchEvent(new Event("input"));
    }
  });
}

// ---- The navigator toggle: remember "hidden" on wide screens; "[" toggles it.

function navigatorToggle() {
  const toggle = doc.querySelector<HTMLInputElement>("#apidocs-nav-toggle");
  if (!toggle) return;
  const wide = window.matchMedia("(min-width: 861px)");
  toggle.addEventListener("change", () => {
    if (!wide.matches) return;
    try {
      window.localStorage.setItem("apidocs-nav", toggle.checked ? "closed" : "open");
    } catch {
      /* storage blocked */
    }
  });
  // A narrow screen's open panel must not become a hidden navigator when the window grows, or the reverse.
  wide.addEventListener("change", () => {
    let closed = false;
    try {
      closed = window.localStorage.getItem("apidocs-nav") === "closed";
    } catch {
      /* storage blocked */
    }
    toggle.checked = wide.matches && closed;
  });
  doc.addEventListener("keydown", event => {
    const target = event.target as HTMLElement;
    if (event.key === "[" && !event.metaKey && !event.ctrlKey && !event.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) && !target.isContentEditable) {
      toggle.checked = !toggle.checked;
      toggle.dispatchEvent(new Event("change"));
    }
  });
}

function start() {
  doc.documentElement.dataset.js = "";
  themeSwitch();
  copyButtons();
  searchBox();
  tableOfContents();
  navigatorToggle();
  // Types only: packages stay, so the way to another package is never filtered away.
  listFilter("[data-nav-filter]", ".nav-section:not(:first-of-type) .nav-list > li");
  listFilter("[data-toc-filter]", ".toc-entries > li", "#member-summary table.summary tbody tr");
}

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start);
else start();
