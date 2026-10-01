import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function starterRoot(metaUrl) {
  return fileURLToPath(new URL('.', new URL('..', metaUrl)));
}

export function spawnLocalVitePreview({ cwd, port }) {
  const viteBin = fileURLToPath(new URL('node_modules/vite/bin/vite.js', pathToFileURL(`${cwd}/`)));
  return spawn(process.execPath, [
    viteBin,
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
}

export function spawnNodePreview({ cwd, port }) {
  return spawn(process.execPath, ['scripts/preview-server.mjs'], {
    cwd,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function collectChildLogs(child) {
  const logs = [];
  child.stdout?.on('data', (chunk) => logs.push(String(chunk)));
  child.stderr?.on('data', (chunk) => logs.push(String(chunk)));
  return logs;
}

function readinessText(logs) {
  return stripVTControlCharacters(logs.join(''));
}

export async function waitForOwnedReadiness(child, {
  logs,
  readyPattern,
  timeoutMs = 15000,
  label = 'preview server',
}) {
  if (child.exitCode !== null || child.signalCode !== null) {
    throw new Error(`${label} exited before readiness:\n${logs.join('')}`);
  }
  if (readyPattern.test(readinessText(logs))) return;

  await new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout?.off('data', onData);
      child.stderr?.off('data', onData);
      child.off('exit', onExit);
      child.off('error', onError);
    };
    const finish = (fn, value) => {
      cleanup();
      fn(value);
    };
    const onData = () => {
      if (readyPattern.test(readinessText(logs))) finish(resolve);
    };
    const onExit = (code, signal) => {
      finish(reject, new Error(`${label} exited before readiness (code ${code ?? 'null'}, signal ${signal ?? 'null'}):\n${logs.join('')}`));
    };
    const onError = (error) => {
      finish(reject, new Error(`${label} failed before readiness: ${error.message}\n${logs.join('')}`));
    };
    timer = setTimeout(() => {
      finish(reject, new Error(`${label} did not print readiness within ${timeoutMs}ms:\n${logs.join('')}`));
    }, timeoutMs);
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.once('exit', onExit);
    child.once('error', onError);
    onData();
  });
}

export async function stopOwnedProcess(child, { logs, label = 'preview server', timeoutMs = 3000 } = {}) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const exited = await waitForExitOrTimeout(child, timeoutMs);
  if (exited || child.exitCode !== null || child.signalCode !== null) return;

  child.kill('SIGKILL');
  const killed = await waitForExitOrTimeout(child, timeoutMs);
  if (!killed && child.exitCode === null && child.signalCode === null) {
    throw new Error(`${label} did not exit after SIGKILL:\n${logs?.join('') || ''}`);
  }
}

function waitForExitOrTimeout(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    const onExit = () => {
      cleanup();
      resolve(true);
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.off('exit', onExit);
    };
    child.once('exit', onExit);
  });
}
