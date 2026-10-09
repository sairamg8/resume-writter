// Defect: the site was served with no security headers at all (public/ held two icons): any page could
// frame it, a browser could sniff a type for a file, and every returning visit asked again for files whose
// names change with their content. public/_headers (read by Cloudflare's static assets, copied into dist
// by Vite) sets them. This pins the file, and that the build still copies public/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const headers = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');
/** `{ '/*': { 'x-frame-options': 'SAMEORIGIN', … } }` from the file's rules. */
function rules(text) {
  const out = {};
  let path = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '');
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) { path = line.trim(); out[path] = {}; continue; }
    const at = line.indexOf(':');
    out[path][line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
  }
  return out;
}

test('every page is served with nosniff, same-origin framing, a short referrer and no camera, microphone or location', () => {
  const all = rules(headers)['/*'];
  assert.equal(all['x-content-type-options'], 'nosniff');
  assert.equal(all['x-frame-options'], 'SAMEORIGIN');
  assert.equal(all['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.equal(all['permissions-policy'], 'camera=(), microphone=(), geolocation=()');
});

test('assets/ (named by content) are kept for a year; index.html is not given that', () => {
  const r = rules(headers);
  assert.equal(r['/assets/*']['cache-control'], 'public, max-age=31536000, immutable');
  assert.equal(r['/*']['cache-control'], undefined, 'the pages themselves are asked about every time');
  assert.deepEqual(Object.keys(r).sort(), ['/*', '/assets/*']);
});

test('no Cross-Origin-Opener-Policy: it would break the Google sign-in popup', () => {
  assert.doesNotMatch(headers.replace(/#.*$/gm, ''), /cross-origin-opener-policy/i);
});

test('Vite still copies public/ into the build, and assets/ is where it names files by content', () => {
  const config = readFileSync(new URL('../../vite.config.js', import.meta.url), 'utf8');
  assert.doesNotMatch(config, /publicDir\s*:\s*false/);
  assert.doesNotMatch(config, /assetsDir\s*:/, 'assets/ is Vite\'s default');
  assert.doesNotMatch(config, /entryFileNames|chunkFileNames|assetFileNames/, 'file names keep their content hash');
});
