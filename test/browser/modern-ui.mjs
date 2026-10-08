import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.argv[2];
assert.ok(base, "Pass the running local preview URL.");
const target = new URL(base);
assert.equal(target.protocol, "http:");
assert.equal(target.hostname, "127.0.0.1");
const routes = ["/","/projects","/report","/build"];
const browser = await chromium.launch();
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of routes) {
      await page.goto(base + route);
      await page.locator('h1').waitFor();
      const ui = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const controls = [...document.querySelectorAll('nav a, .nav a, nav .nav-link, .button, .saved-filters button, .line-remove, input, select, a.brand, button.brand, button.logo')].filter(node => node.getBoundingClientRect().height > 0);
        return {
          bodySize: body.fontSize, bodyLine: body.lineHeight, background: body.backgroundImage,
          font: body.fontFamily, overflow: document.documentElement.scrollWidth > innerWidth,
          heading: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),
          controls: controls.map(node => ({ label: node.textContent || node.getAttribute('aria-label'), brand: node.matches('a.brand, button.brand, button.logo'), size: getComputedStyle(node).fontSize, height: node.getBoundingClientRect().height })),
        };
      });
      assert.equal(ui.bodySize, '16px', route + ' body type');
      assert.equal(ui.font.includes('Avenir Next'), true, route + ' shared font');
      assert.equal(ui.background, 'none', route + ' quiet canvas');
      assert.equal(ui.overflow, false, route + ' page overflow at ' + viewport.width);
      assert.ok(ui.heading <= 40 && ui.heading >= 24, route + ' bounded heading');
      for (const control of ui.controls) {
        if (control.brand) {
          assert.ok(parseFloat(control.size) >= 20 && parseFloat(control.size) <= 24, route + ' preserved brand type: ' + control.label);
        } else {
          assert.equal(control.size, '14px', route + ' control type: ' + control.label);
        }
        assert.ok(control.height >= 43.5, route + ' control target: ' + control.label);
      }
      const control = page.locator('input, select, .button:not([disabled]), nav .nav-link, .nav a').first();
      if (await control.count()) {
        await page.keyboard.press('Tab');
        await control.focus();
        const focus = await control.evaluate(node => ({ focused: document.activeElement === node, outline: getComputedStyle(node).outlineStyle, width: parseFloat(getComputedStyle(node).outlineWidth) }));
        assert.equal(focus.focused, true, route + ' focus');
        assert.notEqual(focus.outline, 'none', route + ' visible focus');
        assert.ok(focus.width >= 2, route + ' visible focus width');
      }
    }
    await page.goto(base + routes[1]);
    const homeBrand = page.locator('a.brand, button.brand, button.logo').first();
    await page.keyboard.press('Tab');
    await homeBrand.focus();
    const brandFocus = await homeBrand.evaluate(node => ({ focused: document.activeElement === node, outline: getComputedStyle(node).outlineStyle }));
    assert.equal(brandFocus.focused, true, 'Home wordmark is keyboard reachable');
    assert.notEqual(brandFocus.outline, 'none', 'Home wordmark has visible focus');
    await homeBrand.click();
    await page.waitForURL(base + '/');
    assert.equal(new URL(page.url()).pathname, '/', 'Home wordmark returns to the primary workspace');
    assert.deepEqual(errors, [], 'No runtime errors');
    await page.close();
  }
  console.log('Modern UI regression passed: primary/detail/build routes, desktop/mobile geometry,14px controls,44px targets and visible focus.');
} finally {
  await browser.close();
}
