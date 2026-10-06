// Unit test for the additive canvas tokens (UI redesign B1, docs/tracking/ui-redesign/BRIEF.md):
// src/index.css defines every BRIEF colour, radius, shadow and font under cv-* names with the canvas
// values, the @layer components classes exist, Tailwind's own --font-sans is not redefined, and the
// legacy kit token names stay. Reads src/index.css as text. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = fs.readFileSync(fileURLToPath(new URL('../../src/index.css', import.meta.url)), 'utf8');
const decl = (name) => {
  const m = css.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm'));
  return m && m[1].trim().toLowerCase();
};

const CV = {
  'ground': '#f5f6f8', 'surface': '#ffffff', 'sunken': '#eef0f4', 'stage': '#e9ecf1',
  'hairline': '#e2e5eb', 'field': '#d5dae3',
  'ink': '#151922', 'body': '#2a303c', 'muted': '#4f586a', 'faint': '#6b7385',
  'brand': '#2b59ff', 'brand-text': '#1e45d6', 'brand-soft': '#e8eeff', 'brand-soft-border': '#c9d3f5',
  'good': '#0b7a55', 'good-soft': '#e1f5ec', 'warn': '#8f5200', 'warn-soft': '#fff0d6',
  'bad': '#b3261e', 'bad-soft': '#fde7e5',
};

test('every canvas colour is a cv-* token with the canvas hex', () => {
  for (const [name, hex] of Object.entries(CV)) {
    assert.equal(decl(`--color-cv-${name}`), hex, `--color-cv-${name}`);
  }
});

test('radii, pop shadow and font token', () => {
  assert.equal(decl('--radius-cv-card'), '14px');
  assert.equal(decl('--radius-cv-control'), '9px');
  assert.equal(decl('--radius-cv-chip'), '9999px');
  assert.equal(decl('--shadow-pop').replace(/\s+/g, ' '),
    '0 4px 8px rgba(20, 30, 50, 0.06), 0 18px 44px rgba(20, 30, 50, 0.2)');
  const font = decl('--font-cv');
  assert.match(font, /^"instrument sans", system-ui,/);
  assert.match(font, /"segoe ui emoji", "apple color emoji", "noto color emoji"/);
});

test('Tailwind --font-sans is not redefined and no web font is linked', () => {
  assert.equal(decl('--font-sans'), null);
  assert.ok(!/@import\s+url|fonts\.googleapis/.test(css));
});

test('the component classes exist in @layer components', () => {
  const layer = css.slice(css.indexOf('@layer components'));
  assert.ok(layer.length > 20, '@layer components present');
  for (const c of ['cv-card', 'cv-chip', 'cv-field', 'cv-notice-warn', 'cv-notice-bad', 'cv-pill-nav']) {
    assert.ok(new RegExp(`\\.${c}\\s*[{,\\[]`).test(layer), `.${c}`);
  }
});

test('legacy kit token names are all still defined', () => {
  for (const n of ['ink', 'ink-subtle', 'ink-subtlest', 'line', 'line-subtle', 'sunken', 'hovered', 'pressed',
    'neutral-fill', 'neutral-fill-hover', 'brand', 'brand-hover', 'brand-pressed', 'brand-subtle',
    'brand-subtle-hover', 'loz-todo', 'loz-todo-ink', 'loz-progress', 'loz-progress-ink', 'loz-done', 'loz-done-ink']) {
    assert.ok(decl(`--color-${n}`), `--color-${n}`);
  }
});
