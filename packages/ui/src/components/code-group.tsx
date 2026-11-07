import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

export interface CodeGroupProps {
  children: React.ReactNode;
  /**
   * Groups sharing a key stay in sync across the page (picking `pnpm` in one
   * install snippet picks it everywhere) and remember the choice.
   */
  syncKey?: string;
  /** Tab labels; default to each child's `filename`, `title` or `lang`. */
  labels?: string[];
  /** Initially selected label (default: the first). */
  defaultValue?: string;
  className?: string;
}

const EVENT = "elide:code-group";
const storageKey = (key: string) => `elide:code-group:${key}`;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

function childLabel(child: React.ReactElement, index: number): string {
  const props = child.props as { filename?: unknown; title?: unknown; lang?: unknown };
  for (const value of [props.filename, props.title, props.lang]) if (typeof value === "string" && value) return value;
  return String(index + 1);
}

function readStored(key: string): string | undefined {
  try {
    return localStorage.getItem(storageKey(key)) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * CodeGroup — one code surface at a time behind tabs: package managers,
 * languages, platforms. Server-renders the default tab; a remembered choice
 * applies before paint, so readers never see a flash of the wrong variant.
 */
export function CodeGroup({ children, syncKey, labels: labelsProp, defaultValue, className }: CodeGroupProps) {
  const items = React.Children.toArray(children).filter(React.isValidElement);
  const labels = items.map((child, i) => labelsProp?.[i] ?? childLabel(child, i));
  const labelKey = labels.join("\u0000");
  const [value, setValue] = React.useState(defaultValue && labels.includes(defaultValue) ? defaultValue : labels[0]);

  useIsomorphicLayoutEffect(() => {
    if (!syncKey) return;
    const options = labelKey.split("\u0000");
    const stored = readStored(syncKey);
    if (stored && options.includes(stored)) setValue(stored);
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; value: string }>).detail;
      if (detail?.key === syncKey && options.includes(detail.value)) setValue(detail.value);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey(syncKey) && event.newValue && options.includes(event.newValue)) setValue(event.newValue);
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [syncKey, labelKey]);

  function select(next: string) {
    setValue(next);
    if (!syncKey) return;
    try {
      localStorage.setItem(storageKey(syncKey), next);
    } catch {
      // Storage may be unavailable (private mode); syncing within the page still works.
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { key: syncKey, value: next } }));
  }

  return (
    <div data-slot="code-group" className={className}>
      <Tabs value={value} onValueChange={(next) => select(String(next))}>
        <TabsList variant="line">
          {labels.map((label) => (
            <TabsTrigger key={label} value={label}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {items.map((child, i) => (
          // Mounted panels keep every variant in the document for readers without script.
          <TabsContent key={labels[i]} value={labels[i]} keepMounted>
            {child}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
