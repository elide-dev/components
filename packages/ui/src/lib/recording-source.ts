/** Normalize a recording source: a URL string (or URL) becomes `{ src }`. */
export function resolveRecording<T extends { src?: string | URL }>(source: string | URL | T): T {
  return typeof source === "string" || source instanceof URL ? ({ src: source } as T) : source;
}
