// Cycle 4, touch and odd viewports: the workspace shell decided "wide" with a 768 px query, but its menu button
// (TopBar, md:hidden), its sidebar (md:block), its tab bar (md:hidden) and its bottom padding (max-md) are Tailwind's md,
// 48rem. A media query's rem is the browser's default text size, so with it at 24 px (a user who set larger text, or a
// browser on a large screen) md starts at 1152 px: at an 800 px window the menu button is shown and the sidebar hidden,
// yet `wide` was true, and WorkspaceLayout closed the drawer in the very render that the button opened it. The button did
// nothing, and the drawer was the only way to the projects list there. The query is 48rem now. The behaviour is run in
// tests/unit/ui-shell.unit.mjs (a window of 800 px with a 24 px text size); fake-dom has no layout, so here the sources are read.
// Run: node --test tests/pdf/220-cyc4-touch-rem-breakpoint-drawer.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = (p) => fs.readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');

it('the shell asks "wide" in rem, the unit Tailwind\'s md is in, not in px', () => {
  const layout = source('components/shell/WorkspaceLayout.jsx');
  assert.match(layout, /useMediaQuery\('\(min-width: 48rem\)'\)/);
  assert.ok(!/min-width:\s*768px/.test(layout), 'a px query disagrees with md: when the browser text size is not 16 px');
});

it('what the query answers for is on md: the menu button and the sidebar', () => {
  assert.match(source('components/shell/TopBar.jsx'), /label="Open navigation" onClick=\{workspace\.openNav\} className="md:hidden"/);
  assert.match(source('components/shell/Sidebar.jsx'), /md:block/);
  assert.match(source('components/shell/Sidebar.jsx'), /fixed inset-0 z-50 md:hidden/);
});

it('the notice lift above the workspace tab bar (md:hidden) is the complement of md too: 48rem', () => {
  const css = source('index.css');
  const at = css.indexOf('body:has([data-testid="bottom-tab-bar"])');
  assert.ok(at > 0, 'the rule exists');
  assert.match(css.slice(css.lastIndexOf('@media', at), at), /^@media not all and \(min-width: 48rem\)\s*\{\s*$/);
  assert.match(source('components/BottomTabBar.jsx'), /md:hidden/);
});
