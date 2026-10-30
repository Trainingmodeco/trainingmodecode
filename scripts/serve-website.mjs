// Serves the trainingmode.co website (website/) locally for the Claude desktop
// preview pane (.claude/launch.json → "website") or `npm run website`.
// Zero dependencies: plain node http + the files on disk. The site is static
// HTML / CSS / JS, so this is exactly what Hostinger serves.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'website');
const PORT = Number(process.env.PORT) || 5050;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};
const WAITING = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Website preview</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#080012;color:#f5e9ff;font:16px system-ui;padding:24px;text-align:center">
<div><h1 style="font-size:22px">The website files aren't in <code>website/</code> yet</h1>
<p>Download <b>public_html</b> from Hostinger as a zip, unzip it into the repo's <code>website/</code> folder, and reload.</p></div>`;

http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  const send = (f, status = 200) => {
    res.writeHead(status, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  };
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return send(file);
  if (fs.existsSync(file + '.html')) return send(file + '.html');
  if (!fs.existsSync(path.join(ROOT, 'index.html'))) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(WAITING); return; }
  const notFound = path.join(ROOT, '404.html');
  if (fs.existsSync(notFound)) return send(notFound, 404);
  res.writeHead(404).end('Not found');
}).listen(PORT, () => console.log(`website preview: http://localhost:${PORT}`));
