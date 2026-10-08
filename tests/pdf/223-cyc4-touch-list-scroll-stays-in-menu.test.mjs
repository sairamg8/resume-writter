// Cycle 4, touch: a menu, a picker's option list or the Export menu that is taller than the room is capped
// (useFloating's maxHeight) and scrolls inside. Scrolled by a finger past its end, the scroll chained to whatever scrolls
// behind it (the workspace's <main>, a dialog's body, the Dashboard's page), and because a floating panel follows its anchor
// on every scroll, the page slid under a menu that looked loose. The editor's panels, the Section style popover and the
// search results already say `overscroll-contain`; the kit's menu list, the multi-select list and the Export menu did not.
// fake-dom has no scrolling: the sources are read.
// Run: node --test tests/pdf/223-cyc4-touch-list-scroll-stays-in-menu.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = (p) => fs.readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');

/** The class tokens of the string (quoted ' or ") that holds `needle`, searched from `anchor`. */
function tokensOf(text, anchor, needle) {
  const from = text.indexOf(anchor);
  assert.ok(from >= 0, `${anchor} is in the source`);
  const m = new RegExp(`["']([^"']*${needle}[^"']*)["']`).exec(text.slice(from));
  assert.ok(m, `a class string with ${needle}`);
  return m[1].split(/\s+/);
}

it('the menu list, whose items can run past the room, keeps its scroll to itself', () => {
  const tokens = tokensOf(source('components/ui/MenuList.jsx'), 'role="menu"', 'z-\\[70\\]');
  assert.ok(tokens.includes('overflow-y-auto') && tokens.includes('overscroll-contain'), tokens.join(' '));
});

it('the multi-select option list (labels, epics, sprints) keeps its scroll to itself', () => {
  const tokens = tokensOf(source('components/ui/MultiSelectPopover.jsx'), 'role="listbox"', 'max-h-64');
  assert.ok(tokens.includes('overflow-y-auto') && tokens.includes('overscroll-contain'), tokens.join(' '));
});

it('the editor\'s Export menu keeps its scroll to itself', () => {
  const s = source('components/ExportDropdown.jsx');
  assert.match(s, /overflow-y-auto overscroll-contain bg-cv-surface border border-cv-hairline/);
});
