(async function () {
  await document.fonts.ready;
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  scrollTo(0, 0);
  await frame();
  await frame();
  const max = document.documentElement.scrollHeight - innerHeight;
  const intervals = [];
  let last;
  performance.mark("eld:scroll:start");
  for (let i = 0; i <= 180; i++) {
    const now = await frame();
    if (last !== undefined) intervals.push(now - last);
    last = now;
    scrollTo(0, max * i / 180);
  }
  await frame();
  await frame();
  performance.mark("eld:scroll:end");
  performance.measure("eld:scroll", "eld:scroll:start", "eld:scroll:end");
  return {
    frames: intervals.length,
    over25ms: intervals.filter(interval => interval > 25).length,
    maxFrameMs: Math.max(...intervals),
    active: document.querySelector("[data-testid=performance-toc] [aria-current]")?.textContent,
  };
})
