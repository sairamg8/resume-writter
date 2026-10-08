// The workspace page header (PageHeader, sticky from md) is meant to stay at the top of the shell's scroll box (<main>) while a page
// scrolls under it. A sticky box can never leave its parent, and a page root drawn `flex min-h-0 flex-1 flex-col` is exactly as tall as
// <main> (min-h-0 lets it shrink to the box), so a page whose body is longer than the window just overflows its root: the header held
// for one window's worth of scrolling, then was carried off the top with the root's bottom edge (Job page, Your work, a project's
// Summary and Settings, the Projects list, the Job Tracker). Fixed: those roots are `flex flex-1 flex-col` (as tall as their content,
// at least the box), so the header's parent is the whole page. The pages that scroll in a box of their own (the board, the backlog, the
// list, the calendar, the timeline) keep min-h-0: their header lies outside the scroller and never moves.
// With the header held for the whole page, the Job page's sticky Details column (lg:top-4) would sit under it: its `top` is measured from
// the scroll box's top edge, and the header is about 136 px tall with its tabs, so the column's first 120 px were hidden. Its offset now
// clears the header.
// Run: node --test tests/pdf/278-cyc6-page-header-stays-sticky.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL(`../../src/pages/${name}`, import.meta.url), 'utf8');

/** Every `flex [min-h-0] flex-1 flex-col` page root in the file. */
function roots(text) {
  return [...text.matchAll(/className="(flex (?:min-h-0 )?flex-1 flex-col)"/g)].map((m) => m[1]);
}

// Pages whose body scrolls in <main> itself (the page header is a child of the root and must outlast the whole page).
const SCROLLS_IN_MAIN = ['JobDetail.jsx', 'JobTracker.jsx', 'YourWork.jsx', 'ProjectSummary.jsx', 'BoardSettings.jsx', 'Boards.jsx'];
// Pages with a scroll box of their own under the header (the root is exactly the window, the header lies outside the scroller).
const OWN_SCROLLER = ['Board.jsx', 'Backlog.jsx', 'ProjectCalendar.jsx', 'ProjectList.jsx', 'ProjectTimeline.jsx'];

describe('a workspace page root and its sticky header', () => {
  for (const name of SCROLLS_IN_MAIN) {
    it(`${name}: the root grows with the page (no min-h-0), so the sticky header's parent is the whole page`, () => {
      const found = roots(read(name));
      assert.ok(found.length >= 1, `${name} has a flex-1 flex-col root`);
      for (const root of found) assert.ok(!root.includes('min-h-0'), `${name}: "${root}" is capped at the window's height, and the header leaves with its bottom edge`);
    });
  }

  for (const name of OWN_SCROLLER) {
    it(`${name}: keeps a window-high root, with its own overflow-auto box under the header`, () => {
      const text = read(name);
      assert.ok(roots(text).some((root) => root.includes('min-h-0')), `${name} keeps min-h-0 on its root`);
      assert.match(text, /overflow-auto/, `${name} scrolls in a box of its own`);
    });
  }
});

describe('the Job page\'s sticky Details column', () => {
  it('sits below the sticky page header: its top offset is at least the header\'s height, not 1 rem', () => {
    const text = read('JobDetail.jsx');
    const aside = /<aside aria-label="Job details" className="([^"]*)"/.exec(text);
    assert.ok(aside, 'the Details aside is there');
    const tokens = aside[1].split(/\s+/);
    assert.ok(tokens.includes('lg:sticky'), 'it is still sticky from lg');
    const top = tokens.map((t) => /^lg:top-(\d+)$/.exec(t)).find(Boolean);
    assert.ok(top, `it has a lg:top-N offset: ${aside[1]}`);
    // Tailwind's spacing step is 4 px. The header: 16 padding + 20 breadcrumbs + 4 + 52 title row + 4 + 40 tabs (44 on a touch screen).
    assert.ok(Number(top[1]) * 4 >= 140, `lg:top-${top[1]} (${Number(top[1]) * 4} px) clears the ~140 px page header`);
  });
});
