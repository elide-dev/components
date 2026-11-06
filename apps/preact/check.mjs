import assert from "node:assert/strict";
import { chromium, firefox, webkit } from "playwright";
import { preview } from "vite";

const server = await preview({ preview: { host: "127.0.0.1", port: 4188, strictPort: true } });
const engines = { chromium, firefox, webkit };
const focused = locator => locator.evaluate(el => el === document.activeElement);

async function load(page, platform, mode) {
  const path = `${platform ? "platform" : "index"}${mode === "client" ? "-client" : ""}.html`;
  // Hold JavaScript until we inspect the server's HTML. A recreated heading
  // would make this check fail even if the hydrated page looked identical.
  let release;
  const scripts = new Promise(resolve => { release = resolve; });
  await page.route("**/*.js", async route => { await scripts; await route.continue(); });
  let heading;
  try {
    await page.goto(`http://127.0.0.1:4188/${path}`, { waitUntil: "commit" });
    if (mode === "hydrate") {
      heading = await page.getByRole("heading", { level: 1 }).elementHandle();
      assert.ok(heading, "Content must exist before JavaScript executes");
    }
  } finally { release(); }
  await page.waitForFunction(expected => document.documentElement.dataset.renderMode === expected, mode);
  if (heading) assert.equal(await heading.evaluate(el => el === document.querySelector("h1")), true, "Hydration must preserve server DOM");
  await page.getByRole("switch", { name: "Preact state", exact: true }).click();
  const button = page.getByRole("button", { name: "Preact enabled", exact: true });
  await button.click();
  assert.equal(await button.getAttribute("data-ref-checked"), "true", "Preact ref reaches the native button");
  assert.equal(await page.getByRole("link", { name: "Back to content" }).getAttribute("href"), "#main");
  assert.equal(await button.evaluate(el => getComputedStyle(el).userSelect), "none");
  assert.equal(await page.getByTestId("preact-i18n").getAttribute("dir"), "rtl");
  await page.getByRole("navigation", { name: "נתיב ניווט" }).waitFor();
  await page.getByTestId("preact-i18n-dialog").click();
  const localizedDialog = page.getByRole("dialog", { name: "תפריט ניווט" });
  await localizedDialog.waitFor();
  assert.equal(await localizedDialog.getAttribute("lang"), "he");
  assert.equal(await localizedDialog.getAttribute("dir"), "rtl");
  await localizedDialog.getByRole("button", { name: "סגירה" }).click();
  await localizedDialog.waitFor({ state: "hidden" });
}

async function controls(page) {
  const toggle = page.getByRole("switch", { name: "Dark theme" });
  await toggle.focus(); await page.keyboard.press("Space");
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
  assert.equal(await toggle.getAttribute("aria-checked"), "true");
  await page.getByRole("tab", { name: "Overview" }).focus();
  await page.keyboard.press("ArrowRight");
  const tab = page.getByRole("tab", { name: "Installation" });
  assert.equal(await focused(tab), true);
  await page.keyboard.press("Space");
  await page.getByRole("tabpanel").filter({ hasText: "bun add" }).waitFor();
  assert.equal(await tab.getAttribute("aria-selected"), "true");
  const trigger = page.getByRole("button", { name: "Explore the details" });
  await trigger.focus(); await page.keyboard.press("Space");
  const dialog = page.getByRole("dialog", { name: "Designed to work together" });
  await dialog.waitFor();
  await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
  assert.equal(await focused(trigger), true);
  const accordion = page.getByRole("button", { name: "Can I use the keyboard?" });
  await accordion.click();
  assert.equal(await accordion.getAttribute("aria-expanded"), "true");
  await page.getByText("Yes. Tabs support arrow keys, dialogs manage focus, and controls retain native keyboard behavior.").waitFor();
}

async function overlays(page) {
  const native = await page.evaluate(() => CSS.supports("anchor-name", "--eld-anchor") && CSS.supports("position-area", "bottom span-all") && CSS.supports("justify-self", "anchor-center") && CSS.supports("position-try-fallbacks", "flip-block"));
  if (native) await page.waitForFunction(() => document.querySelector("button[style*='anchor-name']"));
  for (const [name, positioning] of [["Project details", native ? "css" : "floating"], ["Floating details", "floating"]]) {
    const trigger = page.getByRole("button", { name, exact: true });
    await trigger.focus(); await page.keyboard.press("Space");
    const panel = page.getByRole("dialog", { name, exact: true });
    await panel.waitFor();
    assert.equal(await panel.getAttribute("data-positioning"), positioning);
    await page.keyboard.press("Escape"); await panel.waitFor({ state: "hidden" });
    assert.equal(await focused(trigger), true);
  }
  const trigger = page.getByRole("button", { name: "Review settings" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Review settings", exact: true });
  await dialog.waitFor();
  const nestedTrigger = page.getByRole("button", { name: "Nested details", exact: true });
  await nestedTrigger.click();
  const nested = page.getByRole("dialog", { name: "Nested details", exact: true });
  await nested.waitFor();
  await page.keyboard.press("Escape"); await nested.waitFor({ state: "hidden" });
  assert.equal(await dialog.isVisible(), true);
  assert.equal(await focused(nestedTrigger), true);
  await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
  assert.equal(await focused(trigger), true);
  const commandsTrigger = page.getByRole("button", { name: "Search commands" });
  // Safari does not focus buttons on mouse clicks. Open from the keyboard so
  // this controlled dialog has a focused invoker to restore on dismissal.
  await commandsTrigger.focus(); await page.keyboard.press("Space");
  const commands = page.getByRole("dialog", { name: "Command palette" });
  await commands.waitFor();
  await page.waitForFunction(input => input === document.activeElement, await commands.getByRole("textbox").elementHandle());
  await page.keyboard.press("Escape"); await commands.waitFor({ state: "hidden" });
  assert.equal(await focused(commandsTrigger), true);
}

try {
  for (const name of (process.env.BROWSERS ?? "chromium").split(",")) {
    assert.ok(engines[name], `Unknown browser: ${name}`);
    const browser = await engines[name].launch({ headless: true });
    try {
      for (const mode of ["hydrate", "client"]) {
        for (const platform of [false, true]) {
          const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
          page.setDefaultTimeout(10_000);
          const errors = [];
          page.on("pageerror", error => errors.push(error.message));
          page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
          await load(page, platform, mode);
          await (platform ? overlays(page) : controls(page));
          assert.deepEqual(errors, [], `${name} ${mode}: no browser errors`);
          await page.close();
        }
      }
      console.log(`${name}: Preact client rendering, SSR/hydration, refs, controlled state, keyboard controls, native/floating overlays and focus return passed.`);
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.httpServer.close(resolve)); }
