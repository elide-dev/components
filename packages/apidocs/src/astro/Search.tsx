/**
 * Search, as an Astro client island (client:idle) in the top bar. The server renders the same markup as the
 * static page's search field; once hydrated, it loads the site's index (assets/search-index.json, paths already
 * in the Astro form) on first focus or keystroke, and opens results through the client router. The top bar is
 * kept across navigations within a site, so the island hydrates once per site, not once per page.
 */
import { navigate } from "astro:transitions/client";
import { useEffect, useRef, useState } from "preact/hooks";
import { isShortcut, Results, siteRoot } from "../client/behaviors";
import { type Entry, search } from "../client/search";

/** Each site's index, by URL: the client router can move between sites (versions) without a page load. */
const indexes = new Map<string, Promise<Entry[]>>();

function loadIndex(root: string): Promise<Entry[]> {
  const url = `${root}assets/search-index.json`;
  let index = indexes.get(url);
  if (!index) {
    index = fetch(url).then(r => (r.ok ? (r.json() as Promise<Entry[]>) : [])).catch(() => []);
    indexes.set(url, index);
  }
  return index;
}

export default function Search({ api }: { api: boolean }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Entry[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const root = typeof document === "undefined" ? "" : siteRoot();

  const run = async (value: string) => {
    setQuery(value);
    const entries = await loadIndex(siteRoot());
    setItems(search(entries, value));
    setActive(0);
    setOpen(value.trim().length > 0);
  };

  useEffect(() => {
    // Text typed before hydration searches at once.
    if (input.current?.value) void run(input.current.value);
    const controller = new AbortController();
    const { signal } = controller;
    document.addEventListener("click", event => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }, { signal });
    document.addEventListener("keydown", event => {
      if (isShortcut(event, "/")) {
        event.preventDefault();
        input.current?.focus();
      }
    }, { signal });
    // A new page starts with an empty search, as a full page load would.
    document.addEventListener("astro:after-swap", () => {
      setQuery("");
      setItems([]);
      setOpen(false);
    }, { signal });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (open) document.getElementById(`apidocs-result-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!items.length) return;
      event.preventDefault();
      setActive((active + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
    } else if (event.key === "Enter") {
      const item = items[active];
      if (item) {
        event.preventDefault();
        setOpen(false);
        void navigate(siteRoot() + item[2]);
      }
    } else if (event.key === "Escape") {
      setQuery("");
      setItems([]);
      setOpen(false);
      input.current?.blur();
    }
  };

  return (
    <search class="search" data-search data-js-only ref={box}>
      <label class="visually-hidden" for="apidocs-search">{api ? "Search the API" : "Search the guides"}</label>
      <input ref={input} id="apidocs-search" type="search" placeholder={api ? "Search types and members" : "Search the guides"} autocomplete="off" spellcheck={false}
        role="combobox" list={undefined} aria-expanded={open ? "true" : "false"} aria-controls="apidocs-results" aria-autocomplete="list"
        aria-activedescendant={open && items.length ? `apidocs-result-${active}` : undefined}
        value={query}
        onFocus={() => void loadIndex(siteRoot())}
        onInput={event => void run((event.target as HTMLInputElement).value)}
        onKeyDown={onKeyDown} />
      <kbd class="search-key" aria-hidden="true">/</kbd>
      <ul id="apidocs-results" class="search-results" role="listbox" aria-label="Search results" hidden={!open}>
        {open && <Results items={items} active={active} query={query} root={root} />}
      </ul>
    </search>
  );
}
