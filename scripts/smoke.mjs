import { chromium } from 'playwright';
import { collectChildLogs, spawnNodePreview, starterRoot, stopOwnedProcess, waitForOwnedReadiness } from './smoke-harness.mjs';

const port = 4175;
const root = starterRoot(import.meta.url);
const server = spawnNodePreview({ cwd: root, port });
const logs = collectChildLogs(server);

const errors = [];

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
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.getByText('New entries are checked').waitFor();
  await page.getByRole('button', { name: 'Stop timer' }).click();
  await page.getByRole('button', { name: 'Report' }).click();
  await page.getByRole('button', { name: 'Generate weekly report' }).click();
  await page.getByText('Billable value', { exact: true }).waitFor();
  await page.goto(`http://127.0.0.1:${port}/build`);
  await page.getByRole('heading', { name: 'How Tempo is built' }).waitFor();
  if (errors.length) throw new Error(`Console problems:\n${errors.join('\n')}`);
  const notFound = await page.goto(`http://127.0.0.1:${port}/missing-route`);
  if (notFound.status() !== 404) throw new Error(`Expected 404, got ${notFound.status()}`);
  console.log('Tempo smoke OK: timer, report endpoint, static build page and real 404.');
} finally {
  if (browser) await browser.close().catch(() => {});
  await stopOwnedProcess(server, { logs, label: 'Tempo preview' });
}
