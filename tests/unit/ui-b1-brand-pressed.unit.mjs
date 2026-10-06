// Unit test for the primary button's press feedback (UI redesign B1): the legacy --color-brand-pressed
// is its own step, darker than --color-brand-hover, and equals the cv token --color-cv-brand-pressed.
// Reads src/index.css as text. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = fs.readFileSync(fileURLToPath(new URL('../../src/index.css', import.meta.url)), 'utf8');
const decl = (name) => {
  const m = css.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm'));
  return m && m[1].trim().toLowerCase();
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

test('brand-pressed differs from brand-hover and is darker', () => {
  const hover = decl('--color-brand-hover');
  const pressed = decl('--color-brand-pressed');
  assert.match(hover, /^#[0-9a-f]{6}$/);
  assert.match(pressed, /^#[0-9a-f]{6}$/);
  assert.notEqual(pressed, hover);
  assert.ok(lum(pressed) < lum(hover), 'pressed has lower relative luminance than hover');
});

test('brand-pressed equals the cv token', () => {
  assert.ok(decl('--color-cv-brand-pressed'), 'cv token exists');
  assert.equal(decl('--color-brand-pressed'), decl('--color-cv-brand-pressed'));
});
