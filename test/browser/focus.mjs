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

async function deferredRequestsPage(browser) {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  await page.addInitScript(() => {
    localStorage.removeItem('what-starter-tempo.workspace.v1');
    const originalFetch = window.fetch;
    window.__pendingTempo = [];
    window.fetch = (url, options) => {
      if (!String(url).startsWith('/api/')) return originalFetch(url, options);
      return new Promise((resolve, reject) => window.__pendingTempo.push({ url, body: JSON.parse(options.body), resolve, reject }));
    };
    window.__settleTempo = (index, outcome = 'success', marker = 100) => {
      const request = window.__pendingTempo[index];
      if (outcome === 'network') return request.reject(new Error('stale network failure'));
      const data = outcome === 'error' ? { ok: false, error: 'stale validation failure' } : request.url === '/api/entry'
        ? { ok: true, entry: request.body.entry }
        : { ok: true, marker, totals: { minutes: marker, weekMinutes: marker, billableValue: marker }, projects: [] };
      request.resolve(new Response(JSON.stringify(data), { status: outcome === 'error' ? 400 : 200, headers: { 'content-type': 'application/json' } }));
    };
  });
  await page.goto(`http://127.0.0.1:${port}/`);
  return page;
}

async function settleRequest(page, index, outcome = 'success', marker = 100) {
  await page.evaluate(async ({ index, outcome, marker }) => {
    window.__settleTempo(index, outcome, marker);
    await new Promise(requestAnimationFrame);
  }, { index, outcome, marker });
}

async function resetThroughReport(page) {
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await page.getByRole('button', { name: 'Reset demo data' }).click();
}

async function verifyRequestOwnership(browser) {
  for (const action of ['Start timer', 'Add block']) {
    for (const outcome of ['success', 'error', 'network']) {
      const page = await deferredRequestsPage(browser);
      await page.getByRole('button', { name: action, exact: true }).click();
      await page.waitForFunction(() => window.__pendingTempo.length === 1);
      await resetThroughReport(page);
      await settleRequest(page, 0, outcome);
      const state = await page.evaluate(() => JSON.parse(localStorage.getItem('what-starter-tempo.workspace.v1')));
      assert.equal(state.entries.length, 6, `${action} response must not add a row after reset`);
      assert.equal(state.running, null, `${action} response must not resume a timer after reset`);
      await page.getByRole('button', { name: 'Timer', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Start timer', exact: true }).isEnabled(), true);
      await page.close();
    }
  }
  for (const outcome of ['success', 'error', 'network']) {
    const page = await deferredRequestsPage(browser);
    await page.getByRole('button', { name: 'Start timer', exact: true }).click();
    await page.waitForFunction(() => window.__pendingTempo.length === 1);
    await resetThroughReport(page);
    await page.getByRole('button', { name: 'Timer', exact: true }).click();
    await page.getByRole('button', { name: 'Start timer', exact: true }).click();
    await page.waitForFunction(() => window.__pendingTempo.length === 2);
    await settleRequest(page, 0, outcome);
    assert.equal(await page.getByRole('button', { name: 'Checking entry…', exact: true }).isDisabled(), true, 'stale response must not clear the newer pending guard');
    await settleRequest(page, 1);
    assert.equal(await page.locator('.entry-row').count(), 4);
    await page.close();
  }
  for (const outcome of ['success', 'error', 'network']) {
    const reportPage = await deferredRequestsPage(browser);
    await reportPage.getByRole('button', { name: 'Report', exact: true }).click();
    await reportPage.getByRole('button', { name: 'Generate weekly report' }).click();
    await reportPage.waitForFunction(() => window.__pendingTempo.length === 1);
    await reportPage.getByRole('button', { name: 'Reset demo data' }).click();
    await settleRequest(reportPage, 0, outcome);
    assert.match(await reportPage.locator('.report-note').innerText(), /Generate a report/);
    assert.equal(await reportPage.locator('.report-result').count(), 0);
    await reportPage.close();
  }
  for (const outcome of ['success', 'error', 'network']) {
    const reportPage = await deferredRequestsPage(browser);
    await reportPage.getByRole('button', { name: 'Report', exact: true }).click();
    await reportPage.getByRole('button', { name: 'Generate weekly report' }).click();
    await reportPage.getByRole('button', { name: 'Generate weekly report' }).click();
    await reportPage.waitForFunction(() => window.__pendingTempo.length === 2);
    await settleRequest(reportPage, 1, 'success', 202);
    await settleRequest(reportPage, 0, outcome, 101);
    assert.equal(JSON.parse(await reportPage.locator('.report-result pre').textContent()).marker, 202, 'old report response must not overwrite a newer result');
    await reportPage.close();
  }
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
  let validationRequests = 0;
  await page.route('**/api/entry', async (route) => {
    validationRequests++;
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({ json: { ok: true, entry: route.request().postDataJSON().entry } });
  });
  const rowsBefore = await page.locator('.entry-row').count();
  await page.getByRole('button', { name: 'Start timer', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: /Start timer|Checking entry/ }).isDisabled(), true, 'pending creation must disable the timer action');
  await page.evaluate(() => document.querySelector('.timer-actions button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.getByRole('button', { name: 'Stop timer', exact: true }).waitFor();
  assert.equal(validationRequests, 1, 'duplicate pending start must not issue another validation request');
  assert.equal(await page.locator('.entry-row').count(), rowsBefore + 1);
  assert.equal(await page.locator('#project').inputValue(), 'atlas', 'adding an entry must preserve the chosen project');
  await page.getByRole('button', { name: 'Stop timer', exact: true }).click();
  const deniedPage = await browser.newPage();
  await deniedPage.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('storage denied'); }; });
  await deniedPage.goto(`http://127.0.0.1:${port}/`);
  await deniedPage.getByText(/session only.*not saved/i).waitFor();
  await deniedPage.close();
  await verifyRequestOwnership(browser);
  if (errors.length) throw new Error(`Console problems:\n${errors.join('\n')}`);
  console.log('Tempo focus regression OK: editable row inputs preserve DOM identity, focus and local persistence.');
} finally {
  if (browser) await browser.close().catch(() => {});
  await stopOwnedProcess(server, { logs, label: 'Tempo preview' });
}
