// Installed before navigation. Observers run in a separate diagnostic run so
// their overhead cannot contaminate the primary CPU/heap measurements.
export function observeRendering() {
  const entries = {};
  const observers = [];
  for (const type of ['longtask', 'long-animation-frame', 'layout-shift']) {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
    entries[type] = [];
    const observer = new PerformanceObserver(list => {
      entries[type].push(...list.getEntries().map(entry => ({
        startTime: entry.startTime, duration: entry.duration,
        value: entry.value, hadRecentInput: entry.hadRecentInput,
        blockingDuration: entry.blockingDuration,
      })));
    });
    observer.observe({ type, buffered: true });
    observers.push(observer);
  }
  window.renderingDiagnostics = () => {
    for (let index = 0; index < observers.length; index++) {
      const type = Object.keys(entries)[index];
      entries[type].push(...observers[index].takeRecords().map(entry => ({
        startTime: entry.startTime, duration: entry.duration,
        value: entry.value, hadRecentInput: entry.hadRecentInput,
        blockingDuration: entry.blockingDuration,
      })));
    }
    return entries;
  };
}
