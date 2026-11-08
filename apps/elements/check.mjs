import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';
import { preview } from 'vite';
import sharp from 'sharp';

const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const address = server.httpServer.address();
const base = `http://127.0.0.1:${address.port}`;
const engines = { chromium, firefox, webkit };
try {
  for (const name of (process.env.BROWSERS ?? 'chromium').split(',')) {
    assert.ok(engines[name], `Unknown browser ${name}`);
    const browser = await engines[name].launch();
    try {
      const noJS = await browser.newContext({ javaScriptEnabled: false });
      const staticPage = await noJS.newPage();
      await staticPage.goto(`${base}/static.html`);
      await staticPage.getByRole('img', { name: 'Server logo' }).waitFor();
      assert.equal(await staticPage.locator('script').count(), 0);
      const box = await staticPage.locator('eld-logo svg').boundingBox();
      assert.equal(box.height, 40);
      await noJS.close();

      const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/hydrate.html`);
      await page.waitForFunction(() => typeof window.upgradeLogo === 'function');
      const hydrated = await page.evaluate(async () => {
        const host = document.querySelector('eld-logo');
        const svg = host.shadowRoot.querySelector('svg');
        const before = host.getBoundingClientRect().toJSON();
        await window.upgradeLogo();
        await host.updateComplete;
        return { same: svg === host.shadowRoot.querySelector('svg'), before, after: host.getBoundingClientRect().toJSON() };
      });
      assert.equal(hydrated.same, true, 'Hydration must retain SVG identity');
      assert.deepEqual(hydrated.after, hydrated.before, 'Upgrade must retain geometry');
      await page.evaluate(async () => {
        const logo = document.querySelector('eld-logo');
        logo.accessibleLabel = 'Updated';
        logo.height = 72;
        await logo.updateComplete;
      });
      assert.equal((await page.locator('eld-logo svg').boundingBox()).height, 72);
      await page.getByRole('img', { name: 'Updated' }).waitFor();

      await page.goto(`${base}/plain.html`);
      await page.locator('eld-logo svg').first().waitFor();
      await page.emulateMedia({ colorScheme: 'dark' });
      const imageState = () => page.locator('eld-logo').nth(2).evaluate(host =>
        [...host.shadowRoot.querySelectorAll('img')].map(img => getComputedStyle(img).display));
      assert.deepEqual(await imageState(), ['block', 'none'], 'OS dark must not override site light');
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      assert.deepEqual(await imageState(), ['none', 'block']);
      const nested = await page.locator('[data-theme="light"] eld-logo').evaluate(host =>
        [...host.shadowRoot.querySelectorAll('img')].map(img => getComputedStyle(img).display));
      assert.deepEqual(nested, ['block', 'none'], 'Explicit nested light must select light asset');
      assert.equal(await page.getByRole('img', { name: 'Elide', exact: true }).count(), 4, 'Exactly one name per logo');
      await page.evaluate(async () => {
        const logo = document.querySelector('eld-logo');
        logo.setAttribute('form', 'square');
        logo.setAttribute('variant', 'mono');
        await logo.updateComplete;
        if (logo.shadowRoot.querySelectorAll('path').length !== 1) throw new Error('Attributes must update artwork');
        logo.style.setProperty('--eld-logo-height', '64px');
        await new Promise(requestAnimationFrame);
        if (logo.shadowRoot.querySelector('svg').getBoundingClientRect().height !== 64) throw new Error('CSS height must resize artwork');
        logo.decorative = true;
        await logo.updateComplete;
      });
      assert.equal(await page.getByRole('img', { name: 'Elide', exact: true }).count(), 3);
      await page.evaluate(() => document.querySelector('eld-logo').hidden = true);
      assert.equal(await page.locator('eld-logo').first().isVisible(), false);

      await page.goto(`${base}/react.html`);
      await page.locator('[data-case] eld-logo svg').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      let comparisons = 0;
      let maxError = 0;
      for (const dark of [false, true]) {
        await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
        for (const row of await page.locator('[data-case]').all()) {
          const key = await row.getAttribute('data-case');
          // Inactive raster cuts have display:none and are excluded on both sides.
          const legacy = row.locator('[data-legacy] svg:visible, [data-legacy] img:visible');
          const element = row.locator('[data-element] svg:visible, [data-element] img:visible');
          await element.evaluate(async node => { if (node instanceof HTMLImageElement) await node.decode(); });
          await legacy.evaluate(async node => { if (node instanceof HTMLImageElement) await node.decode(); });
          const oldBox = await legacy.boundingBox();
          const newBox = await element.boundingBox();
          assert.ok(Math.abs(oldBox.width - newBox.width) < 0.02 && oldBox.height === newBox.height, `${key}: geometry`);
          const before = await sharp(await legacy.screenshot()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          const after = await sharp(await element.screenshot()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          assert.deepEqual(after.info, before.info, `${key}: screenshot dimensions`);
          let sum = 0;
          for (let i = 0; i < before.data.length; i++) sum += Math.abs(before.data[i] - after.data[i]);
          const mae = sum / before.data.length;
          maxError = Math.max(maxError, mae);
          // Same geometry/colors should render identically; allow only tiny AA noise.
          assert.ok(mae <= 0.1, `${name} ${key} dark=${dark}: pixel MAE ${mae}`);
          comparisons++;
        }
      }
      await page.getByRole('button', { name: 'Resize' }).click();
      await page.waitForFunction(() => document.querySelector('eld-logo')?.shadowRoot?.querySelector('svg')?.getBoundingClientRect().height === 72);
      assert.equal((await page.locator('[data-legacy] svg').first().boundingBox()).height, 72);
      await page.goto(`${base}/react.html?default`);
      await page.locator('[data-case] eld-logo svg').first().waitFor();
      for (const row of await page.locator('[data-case]').all()) {
        await row.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        const legacy = await row.locator('[data-legacy] svg:visible, [data-legacy] img:visible').boundingBox();
        const element = await row.locator('[data-element] svg:visible, [data-element] img:visible').boundingBox();
        assert.ok(Math.abs(element.height - 24) < 0.02, 'Default height must be 24 CSS pixels within subpixel precision');
        assert.ok(Math.abs(legacy.width - element.width) < 0.02, `${await row.getAttribute('data-case')}: default intrinsic ratio`);
      }
      assert.deepEqual(errors, []);
      console.log(`${name}: no-JS SSR, hydration identity, attributes/properties, themes, accessible names, React updates; ${comparisons} pixel comparisons (max MAE ${maxError.toFixed(4)})`);
      await page.close();
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise(resolve => server.httpServer.close(resolve));
}
