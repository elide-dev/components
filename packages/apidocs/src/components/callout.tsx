/** Callouts: notes, deprecations and the admonitions of prose, in one design. */
import type preact from "preact";

/** Icons for callouts: 16px line drawings in the callout's tone. */
const CALLOUT_ICON: Record<string, preact.ComponentChildren> = {
  // A caller's heads-up.
  apiNote: <><circle cx="8" cy="8" r="6.25" /><path d="M8 4.6v3.9" /><path d="M8 11.1v.01" /></>,
  // A requirement an override must meet.
  implSpec: <><rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2.5" /><path d="M5.4 8.2l1.8 1.8 3.4-3.9" /></>,
  // A fact about the code.
  implNote: <path d="M6 4.5 2.75 8 6 11.5M10 4.5 13.25 8 10 11.5" />,
  deprecated: <><circle cx="8" cy="8" r="6.25" /><path d="M3.7 12.3l8.6-8.6" /></>,
  // Tones for prose.
  note: <><circle cx="8" cy="8" r="6.25" /><path d="M8 7.4v3.9" /><path d="M8 4.8v.01" /></>,
  tip: <><path d="M5.6 10.4a4 4 0 1 1 4.8 0c-.4.3-.6.7-.6 1.2H6.2c0-.5-.2-.9-.6-1.2z" /><path d="M6.5 13.6h3" /></>,
  important: <><path d="M3 3.25h10v7.5H8.4L5.5 13.3v-2.55H3z" /><path d="M8 5.4v2.4" /><path d="M8 9.3v.01" /></>,
  warning: <><path d="M8 2.6 14.1 13H1.9z" /><path d="M8 6.5v3" /><path d="M8 11.3v.01" /></>,
  caution: <><path d="M5.5 2.5h5l3 3v5l-3 3h-5l-3-3v-5z" /><path d="M8 5.3v3.2" /><path d="M8 10.6v.01" /></>,
};

/**
 * A callout: an icon tile, a label and the text, in a soft panel. Tone and weight come from the kind: an API note
 * and a deprecation are filled, an implementation note is an outline only.
 */
export function Callout({ kind, label, children }: { kind: string; label: preact.ComponentChildren; children: preact.ComponentChildren }) {
  return (
    <div class={`callout callout-${kind}`} role="note">
      <span class="callout-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="16" height="16">{CALLOUT_ICON[kind]}</svg>
      </span>
      <div class="callout-body">
        <p class="callout-label">{label}</p>
        {children}
      </div>
    </div>
  );
}
