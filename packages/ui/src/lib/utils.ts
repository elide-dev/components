import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional + conflicting Tailwind classes. Standard shadcn helper. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Stable React keys for items with no id: `base(item)` disambiguated by an
 * occurrence counter, so keys follow content when the list reorders or filters
 * (unlike array indexes) and stay unique when two items share a base.
 */
export function keyed<T>(
  items: readonly T[],
  base: (item: T) => string,
): { item: T; key: string }[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const b = base(item);
    const n = seen.get(b) ?? 0;
    seen.set(b, n + 1);
    return { item, key: n === 0 ? b : `${b}~${n}` };
  });
}
