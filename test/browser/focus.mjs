import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectChildLogs, spawnNodePreview, stopOwnedProcess, waitForOwnedReadiness } from '../../scripts/smoke-harness.mjs';

const port = 4185;
const root = fileURLToPath(new URL('../..', import.meta.url));
const server = spawnNodePreview({ cwd: root, port });
const logs = collectChildLogs(server);
const errors = [];

async function replaceWithKeyboard(page, locator, value, marker, expectedAfterClear = '') {
  await locator.evaluate((node, key) => {
    window[key] = node;
  }, marker);
  await locator.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  assert.equal(await locator.evaluate((node, key) => node === window[key], marker), true, `${marker} DOM node changed after clear`);
  assert.equal(await page.evaluate((key) => document.activeElement === window[key], marker), true, `${marker} lost focus after clear`);
  assert.equal(await locator.inputValue(), expectedAfterClear, `${marker} did not clear to expected value`);
  await page.keyboard.type(value);
  assert.equal(await locator.inputValue(), value, `${marker} did not receive continuous typing`);
  assert.equal(await locator.evaluate((node, key) => node === window[key], marker), true, `${marker} DOM node changed after type`);
  assert.equal(await page.evaluate((key) => document.activeElement === window[key], marker), true, `${marker} lost focus after type`);
}

try {
  await waitForOwnedReadiness(server, {
    logs,
    readyPattern: new RegExp(`Tempo preview http://127\\.0\\.0\\.1:${port}`),
    label: 'Tempo preview',
  });
  var browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  page.on('console', (msg) => { if (['error', 'warning'].includes(msg.type())) errors.push(msg.text()); });
  await page.goto(`http://127.0.0.1:${port}/`);
  const firstRow = page.locator('.entry-row').first();
  await firstRow.waitFor();

  await replaceWithKeyboard(page, firstRow.locator('input[aria-label="Entry note"]'), 'Focus stable tempo', '__tempoNoteInput');
  await replaceWithKeyboard(page, firstRow.locator('input[aria-label="Entry minutes"]'), '37', '__tempoMinutesInput', '0');

  await page.reload();
  await firstRow.waitFor();
  assert.equal(await firstRow.locator('input[aria-label="Entry note"]').inputValue(), 'Focus stable tempo');
  assert.equal(await firstRow.locator('input[aria-label="Entry minutes"]').inputValue(), '37');
  if (errors.length) throw new Error(`Console problems:\n${errors.join('\n')}`);
  console.log('Tempo focus regression OK: editable row inputs preserve DOM identity, focus and local persistence.');
} finally {
  if (browser) await browser.close().catch(() => {});
  await stopOwnedProcess(server, { logs, label: 'Tempo preview' });
}
