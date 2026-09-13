import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Store } from './store.js';
import { createApplication } from './app.js';

const host = process.env.LINTECH_HOST || '127.0.0.1';
const port = Number(process.env.LINTECH_PORT || 8080);
const dataFile = process.env.LINTECH_DATA_FILE || path.resolve('data/panel.json');
const store = await new Store(dataFile).load();
const app = createApplication(store);
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend');

const securityHeaders = {
  'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (!url.pathname.startsWith('/api/')) {
      const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!['index.html', 'app.js', 'styles.css'].includes(name)) { res.writeHead(404, securityHeaders).end(); return; }
      const content = await fs.readFile(path.join(frontend, name));
      const type = name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'text/javascript';
      res.writeHead(200, { ...securityHeaders, 'content-type': `${type}; charset=utf-8` }); res.end(content); return;
    }
    let body = {};
    if (!['GET', 'HEAD'].includes(req.method)) {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 1_048_576) throw Object.assign(new Error('request too large'), { status: 413 }); chunks.push(chunk); }
      if (size) body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } else if (url.searchParams.has('path')) body.path = url.searchParams.get('path');
    const result = await store.withLock(async () => {
      await store.load();
      return app({ method: req.method, pathname: url.pathname, headers: req.headers, body, ip: req.socket.remoteAddress });
    });
    res.writeHead(result.status, { ...securityHeaders, ...result.headers }); res.end(result.body == null ? '' : JSON.stringify(result.body));
  } catch (error) {
    const status = Number(error.status) || (error instanceof SyntaxError ? 400 : 500);
    if (status === 500) console.error('request failed', { name: error.name, message: error.message });
    res.writeHead(status, { ...securityHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ error: status === 500 ? 'internal server error' : error.message }));
  }
});
server.listen(port, host, () => console.log(`LinTech API listening on http://${host}:${port}`));
