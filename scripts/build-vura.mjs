import { mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';
import { renderToString } from 'what-framework/server';
import { BuildPage, NotFoundPage, staticCss } from '../src/static-pages.mjs';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const staticDir = join(dist, 'static');
const entryFunctionsDir = join(dist, 'functions', 'api_entry');
const reportFunctionsDir = join(dist, 'functions', 'api_report');

function html(title, body, status = 200) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="${status === 404 ? 'noindex' : 'index,follow'}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><title>${title}</title><style>${staticCss}</style></head><body>${body}</body></html>`;
}

async function write(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

if (!existsSync(join(staticDir, 'index.html'))) {
  throw new Error('Vite output missing dist/static/index.html');
}

for (const route of ['timer', 'projects', 'report']) {
  await mkdir(join(staticDir, route), { recursive: true });
  await copyFile(join(staticDir, 'index.html'), join(staticDir, route, 'index.html'));
}

await write(join(staticDir, 'build', 'index.html'), html('How Tempo is built', renderToString(BuildPage())));
await write(join(staticDir, '404', 'index.html'), html('Tempo route not found', renderToString(NotFoundPage()), 404));
await copyFile(join(staticDir, '404', 'index.html'), join(staticDir, '404.html'));

await rm(entryFunctionsDir, { recursive: true, force: true });
await rm(reportFunctionsDir, { recursive: true, force: true });
await mkdir(entryFunctionsDir, { recursive: true });
await mkdir(reportFunctionsDir, { recursive: true });
await build({
  entryPoints: [join(root, 'src', 'api', 'entry.js')],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  outfile: join(entryFunctionsDir, 'index.js')
});
await build({
  entryPoints: [join(root, 'src', 'api', 'report.js')],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  outfile: join(reportFunctionsDir, 'index.js')
});

await writeFile(join(dist, 'manifest.json'), JSON.stringify({
  version: 1,
  pages: [
    { filePath: 'src/app.jsx', urlPattern: '/', mode: 'client', hasLoader: false, hasGetServerData: false, config: { mode: 'client', title: 'Tempo — What Framework starter' } },
    { filePath: 'src/app.jsx', urlPattern: '/timer', mode: 'client', hasLoader: false, hasGetServerData: false, config: { mode: 'client' } },
    { filePath: 'src/app.jsx', urlPattern: '/projects', mode: 'client', hasLoader: false, hasGetServerData: false, config: { mode: 'client' } },
    { filePath: 'src/app.jsx', urlPattern: '/report', mode: 'client', hasLoader: false, hasGetServerData: false, config: { mode: 'client' } },
    { filePath: 'src/static-pages.mjs', urlPattern: '/build', mode: 'static', hasLoader: false, hasGetServerData: false, config: { mode: 'static', title: 'How Tempo is built' } },
    { filePath: 'src/static-pages.mjs', urlPattern: '/404', mode: 'static', hasLoader: false, hasGetServerData: false, config: { mode: 'static', title: 'Tempo route not found' } }
  ],
  api: [
    { filePath: 'src/api/entry.js', urlPattern: '/api/entry', methods: ['POST'], kind: 'serverless', hasWebsocket: false, config: { kind: 'serverless', compute: { class: 'function', memory: '1gb' } } },
    { filePath: 'src/api/report.js', urlPattern: '/api/report', methods: ['POST'], kind: 'serverless', hasWebsocket: false, config: { kind: 'serverless', compute: { class: 'function', memory: '1gb' } } }
  ],
  timestamp: new Date().toISOString()
}, null, 2));

await writeFile(join(dist, 'package.json'), JSON.stringify({ type: 'module', dependencies: { 'what-framework': '0.13.10' } }, null, 2));
console.log('Tempo Vura build ready: dist/static, dist/functions/api_entry + api_report, dist/manifest.json');
