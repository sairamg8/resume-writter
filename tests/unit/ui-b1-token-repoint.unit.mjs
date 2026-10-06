// Unit test for the CSS-only re-point of the legacy kit tokens (UI redesign B1): the VALUES of ink,
// ink-subtle, ink-subtlest, line, line-subtle, sunken, hovered and brand* equal the canvas cv-*
// values, while every token name and the tokens that are not re-pointed (pressed, neutral fills,
// lozenges) keep today's values. Reads src/index.css as text. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = fs.readFileSync(fileURLToPath(new URL('../../src/index.css', import.meta.url)), 'utf8');
const decl = (name) => {
  const m = css.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm'));
  return m && m[1].trim().toLowerCase();
};
const cv = (n) => decl(`--color-cv-${n}`);

test('legacy kit token values equal the cv values', () => {
  const MAP = {
    'ink': 'ink', 'ink-subtle': 'muted', 'ink-subtlest': 'faint',
    'line': 'hairline', 'line-subtle': 'sunken', 'sunken': 'sunken', 'hovered': 'stage',
    'brand': 'brand', 'brand-hover': 'brand-text', 'brand-pressed': 'brand-pressed',
    'brand-subtle': 'brand-soft', 'brand-subtle-hover': 'brand-soft-border',
  };
  for (const [legacy, canvas] of Object.entries(MAP)) {
    assert.ok(cv(canvas), `cv token ${canvas} exists`);
    assert.equal(decl(`--color-${legacy}`), cv(canvas), `--color-${legacy} = cv ${canvas}`);
  }
});

test('tokens that are not re-pointed keep their values', () => {
  const KEPT = {
    'pressed': '#dcdfe4', 'neutral-fill': '#091e420f', 'neutral-fill-hover': '#091e4224',
    'loz-todo': '#dcdfe4', 'loz-todo-ink': '#44546f', 'loz-progress': '#cce0ff',
    'loz-progress-ink': '#0055cc', 'loz-done': '#baf3db', 'loz-done-ink': '#216e4e',
  };
  for (const [n, v] of Object.entries(KEPT)) assert.equal(decl(`--color-${n}`), v, `--color-${n}`);
});

test('kit motion tokens are unchanged', () => {
  assert.equal(decl('--animate-ui-dialog-in'), 'ui-dialog-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both');
  assert.equal(decl('--animate-ui-sheet-in'), 'ui-sheet-in 220ms cubic-bezier(0.32, 0.72, 0, 1) both');
});
