import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const controller = new AbortController();
const onInterrupt = () => controller.abort(new Error('Style checks interrupted.'));
process.once('SIGINT', onInterrupt);
process.once('SIGTERM', onInterrupt);
const timeout = setTimeout(() => controller.abort(new Error('Style checks exceeded 120 seconds.')), 120000);
let preview;
let suite;

async function unusedPort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

function start(args, options = {}) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  child.failure = null;
  child.on('error', error => { child.failure = error; });
  return child;
}

function ended(child) {
  return !child?.pid || child.exitCode !== null || child.signalCode !== null;
}

async function stop(child) {
  if (ended(child)) return;
  for (const signal of ['SIGTERM', 'SIGKILL']) {
    try {
      if (process.platform === 'win32') child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
    const deadline = Date.now() + 3000;
    while (!ended(child) && Date.now() < deadline) await delay(50);
    if (ended(child)) return;
  }
  throw new Error('Owned style-check process did not stop.');
}

async function ready(child, url, logs) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    controller.signal.throwIfAborted();
    if (child.failure) throw new Error('Preview failed to start: ' + child.failure.message);
    if (ended(child)) throw new Error('Owned preview exited before readiness.');
    if (stripVTControlCharacters(logs.text).includes(url)) {
      try {
        const response = await fetch(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(1000)]) });
        await response.body?.cancel();
        if (response.ok && !ended(child)) return;
      } catch {
        controller.signal.throwIfAborted();
      }
    }
    await delay(50, undefined, { signal: controller.signal });
  }
  throw new Error('Owned preview was not healthy within 15 seconds.');
}

try {
  const port = await unusedPort();
  const url = 'http://127.0.0.1:' + port;
  const hybrid = existsSync(new URL('./preview-server.mjs', import.meta.url));
  const args = hybrid
    ? ['scripts/preview-server.mjs']
    : ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];
  preview = start(args, { env: { ...process.env, PORT: String(port) } });
  const logs = { text: '' };
  const collect = chunk => { logs.text = (logs.text + String(chunk)).slice(-8192); };
  preview.stdout.on('data', collect);
  preview.stderr.on('data', collect);
  await ready(preview, url, logs);
  console.log('Style checks using owned preview ' + url);
  suite = start(['test/browser/modern-ui.mjs', url], { stdio: 'inherit' });
  while (!ended(suite)) {
    controller.signal.throwIfAborted();
    if (suite.failure) throw new Error('Style-check process failed to start: ' + suite.failure.message);
    if (ended(preview)) throw new Error('Owned preview exited during style checks.');
    await delay(50, undefined, { signal: controller.signal });
  }
  if (suite.failure) throw new Error('Style-check process failed to start: ' + suite.failure.message);
  if (suite.exitCode !== 0) throw new Error('Style checks failed with exit code ' + suite.exitCode + '.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  process.off('SIGINT', onInterrupt);
  process.off('SIGTERM', onInterrupt);
  try {
    await stop(suite);
  } finally {
    await stop(preview);
  }
}
