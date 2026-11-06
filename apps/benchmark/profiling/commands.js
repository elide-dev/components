(async function () {
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  scrollTo(0, 0);
  await frame();
  const trigger = document.querySelector("[data-testid=performance-search]");
  trigger.focus();
  trigger.click();
  for (let i = 0; i < 20 && !document.querySelector('[aria-label="Command palette"] input'); i++) {
    await frame();
  }
  const input = document.querySelector('[aria-label="Command palette"] input');
  input.focus();
  for (let i = 0; i < 20; i++) await frame();
  const intervals = [];
  let last;
  performance.mark("eld:commands:start");
  for (let i = 0; i < 90; i++) {
    const now = await frame();
    if (last !== undefined) intervals.push(now - last);
    last = now;
    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "ArrowDown", bubbles: true, cancelable: true,
    }));
  }
  await frame();
  await frame();
  performance.mark("eld:commands:end");
  performance.measure("eld:commands", "eld:commands:start", "eld:commands:end");
  input.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Escape", bubbles: true, cancelable: true,
  }));
  for (let i = 0; i < 20; i++) await frame();
  return {
    frames: intervals.length,
    over25ms: intervals.filter(interval => interval > 25).length,
    maxFrameMs: Math.max(...intervals),
  };
})
