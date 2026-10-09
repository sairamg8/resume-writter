// Defect: the site was served with no security headers at all (public/ held two icons): any page could
// frame it, and a browser could sniff a type for a file. public/_headers (read by Cloudflare's static
// assets, copied into dist by Vite) sets them. This pins the file, what it leaves out on purpose, and that
// the build still copies public/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const headers = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');
const code = headers.replace(/#.*$/gm, '');
/** `{ '/*': { 'x-frame-options': 'SAMEORIGIN', … } }` from the file's rules. */
function rules(text) {
  const out = {};
  let path = null;
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    if (!/^\s/.test(raw)) { path = raw.trim(); out[path] = {}; continue; }
    const at = raw.indexOf(':');
    out[path][raw.slice(0, at).trim().toLowerCase()] = raw.slice(at + 1).trim();
  }
  return out;
}

test('every page is served with nosniff, same-origin framing, a short referrer and no camera, microphone or location', () => {
  const r = rules(code);
  assert.deepEqual(Object.keys(r), ['/*']);
  assert.equal(r['/*']['x-content-type-options'], 'nosniff');
  assert.equal(r['/*']['x-frame-options'], 'SAMEORIGIN');
  assert.equal(r['/*']['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.equal(r['/*']['permissions-policy'], 'camera=(), microphone=(), geolocation=()');
});

test('no Cross-Origin-Opener-Policy (it would break the Google sign-in popup) and no long Cache-Control (the single-page fallback)', () => {
  assert.doesNotMatch(code, /cross-origin-opener-policy/i);
  assert.doesNotMatch(code, /cache-control/i);
  const wrangler = readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(wrangler, /"not_found_handling": "single-page-application"/, 'the reason for the second rule above');
});

test('Vite still copies public/ into the build', () => {
  const config = readFileSync(new URL('../../vite.config.js', import.meta.url), 'utf8');
  assert.doesNotMatch(config, /publicDir\s*:\s*false/);
});
