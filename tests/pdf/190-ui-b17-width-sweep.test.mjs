// B17 cross-width sweep (screenshots at 1440-390 px): four layout defects found by looking at them.
//  - PageHeader's actions box was shrink-0 + flex-wrap, so it never wrapped under the title: at 768 px
//    the Job Tracker's Add job button ran off the right edge. It is max-w-full now, so it wraps.
//  - The Projects table's "8 open · 10 total" and the project list's key (LIFE-1) broke onto two lines.
//  - Your work's status lozenge was `hidden sm:inline-flex`; the lozenge sets its own display, so it
//    still showed on a phone and squeezed the issue title to three letters. It is max-sm:hidden.
// fake-dom has no layout: the real components are rendered (PageHeader) or their source classes read.
// Run: node --test tests/pdf/190-ui-b17-width-sweep.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

let PageHeader;
before(async () => {
  await setup();
  ({ PageHeader } = await loadModule('/src/components/shell/PageHeader.jsx'));
});
after(teardown);

const src = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

it('the header actions box can wrap under the title instead of running off the page', () => {
  const html = renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(PageHeader, { title: 'Job Tracker', actions: createElement('button', { type: 'button' }, 'Add job') })));
  const box = /<div class="([^"]*ml-auto[^"]*)"/.exec(html);
  assert.ok(box, 'the actions box is rendered');
  const tokens = box[1].split(/\s+/);
  assert.ok(tokens.includes('flex-wrap') && tokens.includes('max-w-full'), tokens.join(' '));
  assert.ok(!tokens.includes('shrink-0'), 'shrink-0 keeps it as wide as all its buttons in a row');
});

it('the Projects Issues cell and the project list Key cell stay on one line', () => {
  assert.match(src('src/pages/Boards.jsx'), /whitespace-nowrap[^"]*"[^>]*>\{counts\.open\} open/);
  assert.match(src('src/pages/ProjectList.jsx'), /whitespace-nowrap border-b border-line-subtle px-2 text-cv-muted', done/);
});

it("Your work's status lozenge is hidden below sm with max-sm:hidden", () => {
  const s = src('src/pages/YourWork.jsx');
  assert.match(s, /<Lozenge tone=\{column\?\.category\} className="max-sm:hidden">/);
  assert.ok(!/hidden sm:inline-flex/.test(s));
});

it("the job list keeps the Salary and Applied cells on one line", () => {
  const s = src("src/components/job/ListView.jsx");
  assert.match(s, /whitespace-nowrap text-ink-subtle">\{job\.salary/);
  assert.match(s, /whitespace-nowrap text-ink-subtle">\{job\.appliedDate/);
});

it("the Projects table keeps Name wide: Key and Updated go between md and lg (the sidebar's width), Type and Lead wait for xl", () => {
  const s = src("src/pages/Boards.jsx");
  assert.match(s, /SIDEBAR_HIDDEN = .hidden sm:table-cell md:max-lg:hidden./);
  assert.match(s, /NARROW_HIDDEN = .hidden xl:table-cell./);
  assert.match(s, /\$\{SIDEBAR_HIDDEN\}`\}>Key/);
  assert.match(s, /\$\{SIDEBAR_HIDDEN\}`\}>Updated/);
  assert.match(s, /\$\{NARROW_HIDDEN\}`\}>Type/);
  assert.match(s, /\$\{NARROW_HIDDEN\}`\}>Lead/);
  assert.match(s, /xl:min-w-\[48rem\]/);
  assert.ok(!/ (sm|lg):min-w-\[48rem\]/.test(s), "no 48rem floor below xl");
});

it('the project tabs pan sideways below lg with a faded right edge as the cue', async () => {
  const { ProjectTabs } = await loadModule('/src/components/board/ProjectTabs.jsx');
  const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/boards/b1'] },
    createElement(ProjectTabs, { boardId: 'b1' })));
  const nav = /<nav\b[^>]*class="([^"]*)"/.exec(html);
  assert.ok(nav, 'the tabs are a nav');
  const tokens = nav[1].split(/\s+/);
  assert.ok(tokens.includes('overflow-x-auto'), 'the row pans sideways');
  assert.ok(tokens.some((t) => t.startsWith('max-lg:[mask-image:linear-gradient(to_right')), `the right edge fades out below lg: ${tokens.join(' ')}`);
  assert.match(src('src/components/board/ProjectTabs.jsx'), /scrollIntoView\?\.\(\{ inline: 'nearest', block: 'nearest' \}\)/);
});

it('the board filter bar is one row that pans sideways between md and xl, with Group by at its end', () => {
  const s = src('src/components/board/BoardToolbar.jsx');
  assert.match(s, /className="flex flex-wrap items-center gap-1\.5 px-4 py-3 md:px-8 md:max-xl:flex-nowrap md:max-xl:overflow-x-auto"/);
  assert.match(s, /<span className="ml-auto flex shrink-0 items-center gap-1\.5">/);
  assert.match(s, /md:flex-initial md:shrink-0/);
  assert.ok(s.indexOf('ml-auto flex shrink-0') < s.indexOf('label="Group by"'), 'Group by sits in the shrink-0 end box');
});
