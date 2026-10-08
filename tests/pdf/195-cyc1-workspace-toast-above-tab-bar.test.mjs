// A notice in the workspace (an Undo after a project, job or issue is deleted, "marked done") sat at the window's bottom
// (16 px) on a phone, over the 72 px tab bar and hiding its tabs; only the editor's Edit | Preview pill had a rule that lifts
// the stack. The same lift now applies while the tab bar is on the page, in the same phone-only media query (the tab bar is
// md:hidden), outside any layer so it outranks the stack's bottom-4. fake-dom has no layout: the stylesheet and the sources are read.
// Run: node --test tests/pdf/195-cyc1-workspace-toast-above-tab-bar.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = (p) => fs.readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');

it('a rule lifts the notice stack above the phone tab bar, and both elements it names exist', () => {
  const css = source('index.css');
  const rule = /body:has\(\[data-testid="bottom-tab-bar"\]\) \[aria-label="Notifications"\]\s*\{\s*bottom:\s*5rem;/.exec(css);
  assert.ok(rule, 'the stack is lifted 5 rem (80 px) while the tab bar is on the page');
  assert.match(source('components/BottomTabBar.jsx'), /data-testid="bottom-tab-bar"[^>]*md:hidden|md:hidden[^>]*data-testid="bottom-tab-bar"/);
  assert.match(source('components/ui/Toast.jsx'), /aria-label="Notifications"/);
});

it('the rule sits in the phone-only media query (the exact complement of the tab bar\'s md:hidden, in rem like Tailwind\'s md) and at the top level', () => {
  const css = source('index.css');
  const at = css.indexOf('body:has([data-testid="bottom-tab-bar"])');
  const media = css.lastIndexOf('@media', at);
  // 48rem, not 768px: with a larger text size in the browser md is wider than 768 px, and the tab bar (md:hidden) is on screen up to there.
  assert.equal(css.slice(media, css.indexOf('{', media)).trim(), '@media not all and (min-width: 48rem)');
  const before = css.slice(0, media);
  assert.equal((before.match(/\{/g) ?? []).length, (before.match(/\}/g) ?? []).length, 'outside any @layer, so it outranks the stack\'s bottom-4 utility');
  assert.match(source('components/ui/Toast.jsx'), /fixed inset-x-4 bottom-4 /);
});
