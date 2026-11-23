/**
 * Search, as an Astro client island (client:idle) in the top bar. The server renders the same markup as the
 * static page's search field; once hydrated, it loads the site's index (assets/search-index.json, paths already
 * in the Astro form) on first focus or keystroke, and opens results through the client router. The top bar is
 * kept across navigations within a site, so the island hydrates once per site, not once per page.
 *
 * With `hosted` (an app with a search service), the local index and the service race: the local results show at
 * once, and the service's, when they arrive, add what the local index lacks (guides, other suites, words inside
 * descriptions). A scope control switches between this site and every site the service covers; when this site has
 * nothing for a query, the other sites' results show under their own heading. A regex mode searches by regular
 * expression, locally and on the service. Every settled search dispatches an `apidocs:search` event on the document
 * with counts and timings (never the query's text), for an app's analytics.
 */
import { navigate } from "astro:transitions/client";
import { useEffect, useRef, useState } from "preact/hooks";
import { isShortcut, siteRoot } from "../client/behaviors";
import { type Entry, search } from "../client/search";
import { loadIndex } from "./search-index";

/** A search service, as an app configures it. */
export interface HostedSearch {
  /** GET with q, scope, mode (auto or regex) and limit; answers `{ hits: Hit[] }`. */
  endpoint: string;
  /** What a hit's path is relative to: "/main/". */
  base: string;
  /** This site's scope. */
  scope: string;
  /** The scopes the service knows, this site's among them, with "all" last; labels name them in results. */
  scopes: { id: string; label: string }[];
}

interface Hit {
  title: string;
  kind: string;
  suite: string;
  module: string;
  context: string;
  summary: string;
  path: string;
}

/** A result row: an index entry, a path from the site root or from the server root (absolute), and its group. */
interface Item {
  label: string;
  kind: string;
  href: string;
  context: string;
  summary: string;
  group: "here" | "elsewhere";
}

const LIMIT = 40;
const HOSTED_LIMIT = 15;
/** Keystrokes closer together than this share one request to the service. */
const DEBOUNCE_MS = 140;

/** The local index filtered by a regular expression over names and their context; invalid input finds nothing. */
function regexSearch(entries: Entry[], query: string): Entry[] {
  let pattern: RegExp;
  try {
    pattern = new RegExp(query, "iu");
  } catch {
    return [];
  }
  const named = entries.filter(e => pattern.test(e[0]));
  const rest = entries.filter(e => !pattern.test(e[0]) && pattern.test(`${e[3]} ${e[4]}`));
  return [...named, ...rest].slice(0, LIMIT);
}

function localItems(entries: Entry[], query: string, regex: boolean, root: string): Item[] {
  return (regex ? regexSearch(entries, query) : search(entries, query, LIMIT))
    .map(e => ({ label: e[0], kind: e[1], href: root + e[2], context: e[3], summary: e[4], group: "here" as const }));
}

function hostedItems(hits: Hit[], base: string, labels: Map<string, string>, group: Item["group"], withSuite: boolean): Item[] {
  return hits.map(h => ({
    label: h.title,
    kind: h.kind,
    href: base + h.path,
    context: [withSuite ? labels.get(h.suite) ?? h.suite : "", h.context].filter(Boolean).join(" · "),
    summary: h.summary,
    group,
  }));
}

/** Paths without their fragment's encoding differences, to tell a local result and a hosted one apart. */
function key(href: string): string {
  try {
    return decodeURIComponent(new URL(href, location.href).pathname + new URL(href, location.href).hash);
  } catch {
    return href;
  }
}

function merge(first: Item[], second: Item[]): Item[] {
  const seen = new Set(first.map(i => key(i.href)));
  return [...first, ...second.filter(i => !seen.has(key(i.href)))].slice(0, LIMIT);
}

function emit(detail: Record<string, unknown>) {
  document.dispatchEvent(new CustomEvent("apidocs:search", { detail }));
}

export default function Search({ api, hosted }: { api: boolean; hosted?: HostedSearch }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState(hosted?.scope ?? "");
  const [regex, setRegex] = useState(false);
  const [pending, setPending] = useState(false);
  const box = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inflight = useRef<AbortController | undefined>(undefined);
  const labels = new Map((hosted?.scopes ?? []).map(s => [s.id, s.label]));

  const ask = async (value: string, wanted: string, mode: string, signal: AbortSignal): Promise<Hit[] | undefined> => {
    if (!hosted) return undefined;
    const url = new URL(hosted.endpoint, location.href);
    url.searchParams.set("q", value);
    url.searchParams.set("scope", wanted);
    url.searchParams.set("mode", mode);
    url.searchParams.set("limit", String(HOSTED_LIMIT));
    const response = await fetch(url, { signal, headers: { accept: "application/json" } });
    if (!response.ok) return undefined;
    return ((await response.json()) as { hits?: Hit[] }).hits ?? [];
  };

  const run = async (value: string, wantedScope = scope, useRegex = regex) => {
    setQuery(value);
    const started = performance.now();
    const root = siteRoot();
    const entries = await loadIndex(root);
    // The local index is this site's: in the "all" scope it still answers first, as this site's share.
    const local = value.trim() ? localItems(entries, value, useRegex, root) : [];
    setItems(local);
    setActive(0);
    setOpen(value.trim().length > 0);
    clearTimeout(timer.current);
    inflight.current?.abort();
    if (!hosted || !value.trim()) return;
    const controller = new AbortController();
    inflight.current = controller;
    setPending(true);
    timer.current = setTimeout(() => {
      void (async () => {
        const mode = useRegex ? "regex" : "auto";
        let hostedCount = 0;
        let elsewhere = 0;
        let failed = false;
        try {
          const all = wantedScope === "all";
          const hits = await ask(value, wantedScope, mode, controller.signal);
          if (hits === undefined) failed = true;
          hostedCount = hits?.length ?? 0;
          const remote = hostedItems(hits ?? [], hosted.base, labels, "here", all);
          let merged = all ? merge(remote, local) : merge(local, remote);
          // Nothing in this site: what the other sites have, under its own heading.
          if (!merged.length && !all && !failed) {
            const others = (await ask(value, "all", mode, controller.signal)) ?? [];
            elsewhere = others.length;
            merged = hostedItems(others, hosted.base, labels, "elsewhere", true);
          }
          if (controller.signal.aborted) return;
          setItems(merged);
          setActive(0);
        } catch {
          failed = true;
        } finally {
          if (!controller.signal.aborted) {
            setPending(false);
            emit({ scope: wantedScope, mode, local: local.length, hosted: hostedCount, elsewhere, failed, ms: Math.round(performance.now() - started), length: value.length });
          }
        }
      })();
    }, DEBOUNCE_MS);
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
      inflight.current?.abort();
      setQuery("");
      setItems([]);
      setOpen(false);
      setPending(false);
    }, { signal });
    return () => {
      controller.abort();
      inflight.current?.abort();
      clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (open) document.getElementById(`apidocs-result-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const go = (item: Item) => {
    setOpen(false);
    void navigate(item.href);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!items.length) return;
      event.preventDefault();
      setActive((active + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
    } else if (event.key === "Enter") {
      const item = items[active];
      if (item) {
        event.preventDefault();
        go(item);
      }
    } else if (event.key === "Escape") {
      setQuery("");
      setItems([]);
      setOpen(false);
      input.current?.blur();
    }
  };

  const toggleRegex = () => {
    const next = !regex;
    setRegex(next);
    if (query.trim()) void run(query, scope, next);
    input.current?.focus();
  };

  const choose = (next: string) => {
    setScope(next);
    if (query.trim()) void run(query, next, regex);
    input.current?.focus();
  };

  const here = hosted?.scopes.find(s => s.id === hosted.scope);
  const placeholder = regex ? "Regular expression" : api ? "Search types and members" : "Search the guides";
  return (
    <search class={regex ? "search search-regex" : "search"} data-search data-js-only ref={box}>
      <label class="visually-hidden" for="apidocs-search">{api ? "Search the API" : "Search the guides"}</label>
      <input ref={input} id="apidocs-search" type="search" placeholder={placeholder} autocomplete="off" spellcheck={false}
        role="combobox" list={undefined} aria-expanded={open ? "true" : "false"} aria-controls="apidocs-results" aria-autocomplete="list"
        aria-activedescendant={open && items.length ? `apidocs-result-${active}` : undefined}
        value={query}
        onFocus={() => void loadIndex(siteRoot())}
        onInput={event => void run((event.target as HTMLInputElement).value)}
        onKeyDown={onKeyDown} />
      <button type="button" class="search-mode" aria-pressed={regex ? "true" : "false"} title={regex ? "Regular expression: on" : "Regular expression: off"}
        aria-label="Search by regular expression" onClick={toggleRegex}>.*</button>
      <kbd class="search-key" aria-hidden="true">/</kbd>
      <div class="search-panel" hidden={!open}>
        {hosted && here && (
          <div class="search-scopes" role="group" aria-label="Where to search">
            <button type="button" aria-pressed={scope === hosted.scope ? "true" : "false"} onClick={() => choose(hosted.scope)}>{here.label}</button>
            <button type="button" aria-pressed={scope === "all" ? "true" : "false"} onClick={() => choose("all")}>All docs</button>
            {pending && <span class="search-pending" role="status">Searching…</span>}
          </div>
        )}
        <ul id="apidocs-results" class="search-results" role="listbox" aria-label="Search results">
          {open && <HostedResults items={items} active={active} query={query} pending={pending} regex={regex} here={here?.label} onPick={go} />}
        </ul>
      </div>
    </search>
  );
}

function HostedResults({ items, active, query, pending, regex, here, onPick }: { items: Item[]; active: number; query: string; pending: boolean; regex: boolean; here: string | undefined; onPick: (item: Item) => void }) {
  if (!items.length) {
    return <li class="search-empty" role="presentation">{pending ? "Searching…" : regex ? `Nothing matches /${query}/.` : `Nothing matches “${query}”.`}</li>;
  }
  const rows: preact.JSX.Element[] = [];
  let group: Item["group"] | undefined;
  items.forEach((item, i) => {
    if (item.group !== group && item.group === "elsewhere") {
      rows.push(<li key={`g-${i}`} class="search-group" role="presentation">{here ? `Nothing in ${here}; found in other docs` : "Found in other docs"}</li>);
    }
    group = item.group;
    rows.push(
      <li key={item.href} id={`apidocs-result-${i}`} role="option" aria-selected={i === active ? "true" : "false"}>
        <a href={item.href} tabIndex={-1} onClick={event => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          onPick(item);
        }}>
          <span class="result-label">{regex ? item.label : <Highlight text={item.label} query={query} />}</span>
          <span class="result-kind">{item.kind}</span>
          {(item.context || item.summary) && <span class="result-context">{[item.context, item.summary].filter(Boolean).join(": ")}</span>}
        </a>
      </li>,
    );
  });
  return <>{rows}</>;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (at < 0 || !query.trim()) return <>{text}</>;
  const end = at + query.trim().length;
  return <>{text.slice(0, at)}<mark>{text.slice(at, end)}</mark>{text.slice(end)}</>;
}
