import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const staticDir = join(root, 'dist', 'static');
const entryModule = await import('../dist/functions/api_entry/index.js');
const reportModule = await import('../dist/functions/api_report/index.js');
const port = Number(process.env.PORT || 4175);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };

function sendFile(res, file, status = 200) {
  res.writeHead(status, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/entry' || url.pathname === '/api/report') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const request = new Request(`http://localhost${url.pathname}`, { method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
    const module = url.pathname === '/api/entry' ? entryModule : reportModule;
    const response = await module.default.fetch(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  const safe = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  let file = join(staticDir, safe);
  if (url.pathname.endsWith('/')) file = join(file, 'index.html');
  if (!extname(file)) file = join(file, 'index.html');
  if (existsSync(file)) return sendFile(res, file);
  const notFound = join(staticDir, '404.html');
  if (existsSync(notFound)) return sendFile(res, notFound, 404);
  res.writeHead(404).end('not found');
}).listen(port, () => console.log(`Tempo preview http://127.0.0.1:${port}`));
