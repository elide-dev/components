import * as React from "react";

/** One feedback timer per control; stale writes and unmounts cannot revive it. */
export function useClipboardFeedback() {
  const [copied, setCopied] = React.useState(false);
  const lifecycle = React.useRef<{ mounted: boolean; attempt: number; timer?: ReturnType<typeof setTimeout> }>({ mounted: false, attempt: 0 });
  React.useEffect(() => {
    const state = lifecycle.current;
    state.mounted = true;
    return () => {
      state.mounted = false;
      state.attempt++;
      clearTimeout(state.timer);
    };
  }, []);

  const copy = async (value: string) => {
    const state = lifecycle.current;
    const attempt = ++state.attempt;
    clearTimeout(state.timer);
    try {
      // An unavailable API follows the same failure path as a rejected write.
      await navigator.clipboard.writeText(value);
      if (!state.mounted || state.attempt !== attempt) return;
      setCopied(true);
      state.timer = setTimeout(() => setCopied(false), 1500);
    } catch {
      if (state.mounted && state.attempt === attempt) setCopied(false);
    }
  };
  return { copied, copy };
}
