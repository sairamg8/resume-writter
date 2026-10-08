// Every `cv-*` utility class the app uses names a token that src/index.css defines. A misspelt one
// (`border-cv-hairline-subtle`) draws nothing, and a border with no colour falls back to the text colour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../src/', import.meta.url).pathname;
const css = readFileSync(join(root, 'index.css'), 'utf8');
const names = (re) => new Set([...css.matchAll(re)].map((m) => m[1]));
const colours = names(/--color-(cv-[a-z0-9-]+)\s*:/g);
const radii = names(/--radius-(cv-[a-z0-9-]+)\s*:/g);
const fonts = names(/--font-(cv[a-z0-9-]*)\s*:/g);
const shadows = names(/--shadow-([a-z0-9-]+)\s*:/g);

function* files(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(jsx?|mjs)$/.test(f)) yield p;
  }
}

const UTILITY = /(?<![\w-])(?:[a-z@][a-z0-9:@[\]-]*:)*(bg|text|border|ring|fill|stroke|divide|outline|decoration|placeholder|accent|caret|from|to|via|shadow|rounded|font)-(cv-[a-z0-9-]+?)(?:\/[0-9]+)?(?=[\s"'`}]|$)/g;

test('the design tokens exist (the check below is not vacuous)', () => {
  assert.ok(colours.has('cv-brand') && colours.has('cv-ink') && radii.has('cv-card') && fonts.has('cv'));
});

test('every cv-* utility class in src names a token index.css defines', () => {
  const bad = [];
  for (const file of files(root)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(UTILITY)) {
      const [, kind, token] = m;
      const ok = kind === 'rounded' ? radii.has(token)
        : kind === 'font' ? fonts.has(token)
          : kind === 'shadow' ? shadows.has(token)
            : colours.has(token);
      if (!ok) bad.push(`${file.slice(root.length)}: ${kind}-${token}`);
    }
  }
  assert.deepEqual([...new Set(bad)], [], 'undefined design-token classes');
});
