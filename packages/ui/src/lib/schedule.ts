/**
 * Run `task` when the browser is idle (or after `timeout` ms at the latest).
 * Returns a cancel function; falls back to a macrotask without idle callbacks.
 */
export function scheduleIdle(task: () => void, timeout = 2000): () => void {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(task, { timeout });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(task, 1);
  return () => clearTimeout(handle);
}
