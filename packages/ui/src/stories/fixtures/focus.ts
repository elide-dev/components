/** Blur whatever a play function left focused, so visual snapshots show resting UI. */
export function releaseFocus(): void {
  (document.activeElement as HTMLElement | null)?.blur?.();
}
