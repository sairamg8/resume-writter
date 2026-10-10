// A small static server for the BUILT app (./dist, or PW_DIST) that answers as Cloudflare's static assets do:
// the headers of dist/_headers on every response, a file when the path is one, and index.html (200) for any
// other path (wrangler.jsonc: "single-page-application"). The specs of the Content-Security-Policy and of the
// service worker use it, because both depend on what the headers and the 404 fallback really are, which
// `vite preview` (the other specs' server) does not reproduce.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export const DIST = path.resolve(process.env.PW_DIST || 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8',
};

/** The `/*` rule of a _headers file as [[name, value], …] (comments and blank lines ignored). */
export function headersFile(dist = DIST) {
  const out = [];
  let inStar = false;
  for (const raw of fs.readFileSync(path.join(dist, '_headers'), 'utf8').split('\n')) {
    if (!raw.trim() || /^\s*#/.test(raw)) continue;
    if (!/^\s/.test(raw)) { inStar = raw.trim() === '/*'; continue; }
    if (!inStar) continue;
    const at = raw.indexOf(':');
    out.push([raw.slice(0, at).trim(), raw.slice(at + 1).trim()]);
  }
  return out;
}

/**
 * Serves `dist` on a free port. Options:
 *  - reportUri: append `report-uri /__csp-report` to the Content-Security-Policy (the browser then also reports
 *    what a worker's policy blocked, which no page event shows); reports are collected in `reports`;
 *  - rewrite(pathname, body): change a file's bytes before they are sent (a "new deploy" of sw.js);
 *  - extra: files that exist only here, { '/sw-kill': 'text' } (`state.extra` may change while it runs).
 * `hits` lists every request path served; `close()` stops it.
 */
export async function serveDist({ dist = DIST, reportUri = false, rewrite = null, extra = {} } = {}) {
  const headers = headersFile(dist).map(([k, v]) => [k, reportUri && /^content-security-policy$/i.test(k) ? `${v}; report-uri /__csp-report` : v]);
  const hits = [];
  const reports = [];
  const state = { extra: { ...extra }, rewrite };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname === '/__csp-report') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => { reports.push(body); res.writeHead(204).end(); });
      return;
    }
    hits.push(url.pathname);
    let pathname = decodeURIComponent(url.pathname);
    let body;
    let type;
    if (pathname in state.extra) {
      body = Buffer.from(state.extra[pathname]);
      type = TYPES[path.extname(pathname)] || TYPES['.txt'];
    } else {
      let file = path.join(dist, pathname);
      if (!file.startsWith(dist)) { res.writeHead(403).end(); return; }
      if (pathname.endsWith('/')) file = path.join(file, 'index.html');
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { file = path.join(dist, 'index.html'); pathname = '/index.html'; }
      body = fs.readFileSync(file);
      type = TYPES[path.extname(file)] || 'application/octet-stream';
      if (state.rewrite) body = state.rewrite(pathname, body) ?? body;
    }
    const head = { 'content-type': type, 'content-length': body.length, 'cache-control': 'public, max-age=0, must-revalidate' };
    for (const [k, v] of headers) head[k.toLowerCase()] = v;
    res.writeHead(200, head);
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    hits, reports, headers, state,
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }),
  };
}
