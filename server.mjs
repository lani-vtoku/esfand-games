// Esfand Games — zero-dependency static server + JSON save endpoint.
// Run: node server.mjs   (serves this folder at http://localhost:8080)
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, 'data');
const PORT = 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.md': 'text/plain; charset=utf-8',
};

// /api/save/:key  — key restricted to safe chars, stored as data/<key>.json
const SAVE_KEY_RE = /^[a-z0-9._-]{1,64}$/i;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname.startsWith('/api/save/')) {
      const key = url.pathname.slice('/api/save/'.length);
      if (!SAVE_KEY_RE.test(key)) {
        res.writeHead(400).end('bad key');
        return;
      }
      const file = path.join(DATA_DIR, key + '.json');
      if (req.method === 'POST') {
        let body = '';
        req.setEncoding('utf8');
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 1_000_000) { res.writeHead(413).end(); return; }
        }
        JSON.parse(body); // validate; throws → 500 below
        await fsp.mkdir(DATA_DIR, { recursive: true });
        await fsp.writeFile(file, body, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      } else if (req.method === 'GET') {
        if (!fs.existsSync(file)) { res.writeHead(404).end('null'); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        fs.createReadStream(file).pipe(res);
      } else {
        res.writeHead(405).end();
      }
      return;
    }

    // Static files
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.normalize(path.join(ROOT, pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404: ' + pathname);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache', // event iteration: always refetch, rely on 304s
    });
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end('server error: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`Esfand Games server running at http://localhost:${PORT}`);
  console.log(`  hub:        http://localhost:${PORT}/`);
  console.log(`  onyxia:     http://localhost:${PORT}/games/onyxia-run/`);
  console.log(`  geoguessr:  http://localhost:${PORT}/games/geoguessr/`);
  console.log(`  deathroll:  http://localhost:${PORT}/games/deathroll/`);
  console.log(`  calibrate:  http://localhost:${PORT}/games/geoguessr/calibrate.html`);
});
