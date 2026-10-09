// On a phone the five project pages that scroll in a box of their own (the board, the backlog, the list, the calendar, the timeline)
// kept their header (breadcrumbs, title, actions, tabs) and their toolbar outside that box, on a root exactly one window high: all of
// it pinned for good, a large part of a short screen. Below md the root now grows with the page (no min-h-0) and the box under the
// header is as tall as its content (max-md:flex-none), so the whole page, header and toolbar included, scrolls in <main>, as the
// other workspace pages do. From md up nothing changes: the window-high root and the box scroller stay (tests/pdf/278), and the page
// header stays sticky there. Real geometry: tests/playwright/ui-cyc8-phone-project-page-scroll.spec.mjs.
// Run: node --test tests/pdf/356-cyc8-phone-project-page-scrolls-whole.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL(`../../src/${name}`, import.meta.url), 'utf8');
const PAGES = ['Board.jsx', 'Backlog.jsx', 'ProjectList.jsx', 'ProjectTimeline.jsx', 'ProjectCalendar.jsx'];

describe('the project pages with a scroll box of their own, on a phone', () => {
  for (const name of PAGES) {
    it(`${name}: the root is window-high from md up only, and the box under the header is as tall as its content below md`, () => {
      const text = read(`pages/${name}`);
      assert.ok(text.includes('<div className="flex flex-1 flex-col md:min-h-0">'), `${name}: root is flex-1 flex-col with min-h-0 from md only`);
      assert.ok(!text.includes('<div className="flex min-h-0 flex-1 flex-col">'), `${name}: no root capped at the window on a phone`);
      const box = /className=\{?(?:cx\()?['"]([^'"]*overflow-auto[^'"]*)['"]/.exec(text);
      assert.ok(box, `${name}: has its overflow-auto box`);
      const tokens = box[1].split(/\s+/);
      assert.ok(tokens.includes('overflow-auto'), 'it still scrolls sideways (and, from md, down)');
      assert.ok(tokens.includes('max-md:flex-none'), `${name}: below md the box takes its content's height instead of the leftover: ${box[1]}`);
      assert.ok(tokens.includes('flex-1') && tokens.includes('min-h-0'), `${name}: from md up it still fills what the header leaves`);
    });
  }

  it('the page header is still static on a phone and sticky from md', () => {
    const text = read('components/shell/PageHeader.jsx');
    assert.match(text, /shrink-0 bg-cv-surface md:sticky md:top-0/);
  });
});
