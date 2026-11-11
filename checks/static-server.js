// Minimal static server for public/, with the same clean-URL rules Cloudflare Pages uses:
// /            -> public/index.html
// /websites    -> public/websites.html
// anything else missing -> public/404.html with a 404 status
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

export async function resolveFile(root, urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const rel = clean.replace(/\/+$/, '') || '/';
  const candidates = rel === '/'
    ? ['index.html']
    : [rel.slice(1), rel.slice(1) + '.html', path.join(rel.slice(1), 'index.html')];
  for (const candidate of candidates) {
    const full = path.resolve(root, candidate);
    if (!full.startsWith(path.resolve(root))) continue; // no escaping the folder
    try {
      const stat = await fs.stat(full);
      if (stat.isFile()) return full;
    } catch { /* try the next one */ }
  }
  return null;
}

export function createStaticServer(root) {
  return http.createServer(async (req, res) => {
    const file = await resolveFile(root, req.url || '/');
    if (!file) {
      const notFound = path.join(root, '404.html');
      let body = 'Not found';
      try { body = await fs.readFile(notFound); } catch { /* plain text */ }
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(body);
      return;
    }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    res.end(await fs.readFile(file));
  });
}
