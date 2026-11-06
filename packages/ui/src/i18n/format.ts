/** Plain text interpolation only: React escapes the result, with no HTML parsing. */
export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : placeholder);
}
/** Isolate interpolated code/names so their punctuation cannot reorder an RTL label. */
export function isolateText(value: string): string { return `\u2068${value}\u2069`; }
