// Defect: the site was served with no Content-Security-Policy, so a script injected into a page (through
// a rich-text paste, an imported file or a dependency) ran with the page's full rights. public/_headers
// now enforces one. This pins its key directives and the reason for each loosening, and that the page
// (index.html) carries no inline script a strict script-src would block. The browser proof of the whole
// app under it is tests/playwright/561-n2-csp-flows.spec.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');
const code = file.replace(/^\s*#.*$/gm, '');

/** The value of the Content-Security-Policy line of the `/*` rule, or null. */
function cspLine(text) {
  const m = text.match(/^[ \t]+Content-Security-Policy:[ \t]*(.+)$/im);
  return m ? m[1].trim() : null;
}

/** `{ 'script-src': ["'self'", …], … }`; a directive named twice throws (the browser would ignore the second). */
function directives(value) {
  const out = {};
  for (const part of value.split(';').map((s) => s.trim()).filter(Boolean)) {
    const [name, ...sources] = part.split(/\s+/);
    assert.ok(!(name.toLowerCase() in out), `${name} is set twice`);
    out[name.toLowerCase()] = sources;
  }
  return out;
}

const value = cspLine(code);
const d = value ? directives(value) : {};

test('the site is served with an enforced Content-Security-Policy on every page (not Report-Only)', () => {
  assert.ok(value, 'public/_headers sets Content-Security-Policy');
  assert.doesNotMatch(code, /content-security-policy-report-only/i);
  assert.ok(value.length < 1900, `one _headers line may hold 2,000 characters (this is ${value.length})`);
  assert.deepEqual([...code.matchAll(/^\S.*$/gm)].map((m) => m[0].trim()), ['/*'], 'one rule, for every path');
});

test('scripts: this site, WebAssembly (the PDF layout engine) and Google sign-in; never inline or eval', () => {
  assert.deepEqual(d['script-src'], ["'self'", "'wasm-unsafe-eval'", 'https://apis.google.com']);
  assert.deepEqual(d['default-src'], ["'self'"]);
  assert.doesNotMatch(value, /'unsafe-eval'/);
  assert.ok(!(d['script-src'] || []).includes("'unsafe-inline'"), 'no inline script');
  assert.ok(!(d['script-src'] || []).some((s) => s === '*' || s === 'https:' || s === 'data:' || s === 'blob:'), 'no wildcard script source');
});

test('the document cannot be turned into a plug-in host, rebased, posted elsewhere or framed by another site', () => {
  assert.deepEqual(d['object-src'], ["'none'"]);
  assert.deepEqual(d['base-uri'], ["'self'"]);
  assert.deepEqual(d['form-action'], ["'self'"]);
  assert.deepEqual(d['frame-ancestors'], ["'self'"]);
});

test('workers, fonts, images and styles are the ones the app uses', () => {
  assert.deepEqual(d['worker-src'], ["'self'", 'blob:'], 'the PDF worker and the pdf.js worker are files of this site');
  assert.ok(d['font-src'].includes("'self'") && d['font-src'].includes('data:') && d['font-src'].includes('https://cdn.jsdelivr.net'), 'fonts: this site, small inlined ones, jsDelivr');
  assert.ok(['data:', 'blob:', 'https:'].every((s) => d['img-src'].includes(s)), 'images: uploads (data), page pictures (blob) and photo URLs');
  assert.ok(d['style-src'].includes("'self'") && d['style-src'].includes("'unsafe-inline'"), 'styles: inline style attributes of the rich-text editor and the UI');
  assert.ok(d['connect-src'].includes("'self'"), 'fetch: this site');
});

test('sign-in and sync: the frames and endpoints Firebase Auth and Firestore use', () => {
  for (const s of ['https://*.firebaseapp.com', 'https://accounts.google.com', 'https://apis.google.com']) assert.ok(d['frame-src'].includes(s), `frame-src ${s}`);
  assert.ok(!d['frame-src'].includes('*') && !d['frame-src'].includes('https:'), 'frames: named hosts only');
  assert.ok(d['connect-src'].includes('https:'), 'fetch of https endpoints (Firestore, Auth, jsDelivr, and a photo given as a URL)');
});

test('every loosened directive is explained in the file', () => {
  for (const word of ["'unsafe-inline'", "'wasm-unsafe-eval'", 'apis.google.com', 'connect-src', 'frame-src', 'custom']) {
    assert.ok(file.split('\n').filter((l) => /^\s*#/.test(l)).join('\n').includes(word), `a comment explains ${word}`);
  }
});

test('index.html has no inline script, inline handler or javascript: link for the policy to block', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length > 0, 'the page loads its entry');
  for (const [, attrs, body] of scripts) {
    assert.match(attrs, /\bsrc=/, 'a script has a src');
    assert.equal(body.trim(), '', 'an external script has no body');
  }
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /javascript:/i);
});
