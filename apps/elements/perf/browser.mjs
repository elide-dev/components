/** Test-only native DOM baseline. Injected after startup metrics are collected. */
export function installStaticDriver() {
  const app = document.querySelector('#app');
  const template = app.firstElementChild.cloneNode(true);
  const viewBox = template.querySelector('svg').viewBox.baseVal;
  const aspect = viewBox.width / viewBox.height;
  window.logoDriver = {
    async mount(count) {
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < count; index++) {
        const cell = template.cloneNode(true);
        cell.dataset.item = String(index);
        fragment.append(cell);
      }
      app.replaceChildren(fragment);
    },
    async update(indices, height) {
      for (const index of indices) {
        const svg = app.children[index].querySelector('svg');
        svg.style.height = `${height}px`;
        svg.style.width = `${Math.round(height * aspect * 100) / 100}px`;
      }
    },
    async clear() { app.replaceChildren(); },
  };
}

export async function afterPaint() {
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/** Same sequential workload for all drivers, with a paint opportunity each step. */
export async function workload({ scenario, steps, count }) {
  const indices = scenario === 'one' ? [0] : Array.from({ length: count }, (_, index) => index);
  performance.mark(`eld:${scenario}:start`);
  const start = performance.now();
  for (let step = 0; step < steps; step++) {
    if (scenario === 'theme') document.documentElement.classList.toggle('dark', step % 2 === 0);
    else await window.logoDriver.update(indices, step % 2 === 0 ? 32 : 24);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  performance.mark(`eld:${scenario}:end`);
  return performance.now() - start;
}

/** Mutation observers run only in a separate correctness/diagnostic pass. */
export async function diagnostics(count) {
  const app = document.querySelector('#app');
  const svgFor = cell => cell.querySelector('svg') ?? cell.querySelector('eld-logo').shadowRoot.querySelector('svg');
  const original = [...app.children].map(svgFor);
  let mutations = 0;
  let unrelatedMutations = 0;
  const observers = [...app.children].map((cell, index) => {
    const observer = new MutationObserver(records => {
      mutations += records.length;
      if (index !== 0) unrelatedMutations += records.length;
    });
    observer.observe(cell, { subtree: true, attributes: true, childList: true, characterData: true });
    const shadow = cell.querySelector('eld-logo')?.shadowRoot;
    if (shadow) observer.observe(shadow, { subtree: true, attributes: true, childList: true, characterData: true });
    return observer;
  });
  await window.logoDriver.update([0], 32);
  await Promise.resolve();
  const one = { mutations, unrelatedMutations };
  const heights = [...app.children].map(cell => svgFor(cell).getBoundingClientRect().height);
  mutations = 0;
  unrelatedMutations = 0;
  document.documentElement.classList.add('dark');
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const themeMutations = mutations;
  const colors = [...app.children].map(cell => getComputedStyle(svgFor(cell)).color);
  const sameNodes = original.every((svg, index) => svg === svgFor(app.children[index]));
  for (const observer of observers) observer.disconnect();
  document.documentElement.classList.remove('dark');
  await window.logoDriver.update(Array.from({ length: count }, (_, index) => index), 24);
  return { one, heights, colors, themeMutations, sameNodes };
}
