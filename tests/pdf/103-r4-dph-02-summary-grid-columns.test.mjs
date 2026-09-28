// R4-DPH-02: on a phone the Job Tracker's Summary ran off the right edge of the screen. Its page
// grid (below xl) and the cards' grid (below lg) had no column template, so their one column was
// an implicit `auto` track, which grows to the widest unwrapped line inside — a job row's
// truncated company or role ("Senior Software Engineer") — and the cards, the pipeline and the
// career history then spilled past the screen, clipped where they could not be scrolled to. Each
// grid now names its narrow column (grid-cols-1, a minmax(0, 1fr) track), which a long line
// cannot widen. The fake DOM has no layout: this pins the class tokens that make it. Fictional data.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, atRoute, dayFromToday, render } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

// A deadline ahead lists the job under "Upcoming deadlines", as a row with a long role.
const job = { ...acme, role: 'Senior Software Engineer, Platform Reliability', deadline: dayFromToday(3) };

const tokens = (el) => (el?.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const RESPONSIVE_COLUMNS = /^(sm|md|lg|xl|2xl):grid-cols-/;

/** Every grid that sets its columns only from a breakpoint up must set them below it too. */
function assertNoImplicitColumns(elements, where) {
  const grids = elements.filter((el) => tokens(el).includes('grid') && tokens(el).some((t) => RESPONSIVE_COLUMNS.test(t)));
  assert.ok(grids.length > 0, `${where}: the responsive grids are found`);
  for (const grid of grids) {
    assert.ok(tokens(grid).some((t) => t.startsWith('grid-cols-')), `${where}: a column template below the breakpoint too, in "${grid.getAttribute('class')}"`);
  }
}

it('JobSummary: the stat grid and the cards grid name their one narrow column', async () => {
  const { JobSummary } = await loadModule('/src/components/job/JobSummary.jsx');
  const page = await render(JobSummary, { jobs: [job], onOpen: () => {} });
  try {
    assert.match(page.text(), /Upcoming deadlines.*Senior Software Engineer/s, 'the job row with the long role is rendered');
    // A card is <section><div><h2>title</h2>…</div>…</section>.
    const pipeline = page.all().find((el) => el.tagName === 'SECTION' && el.firstChild?.firstChild?.tagName === 'H2' && el.firstChild.firstChild.textContent === 'Pipeline');
    assert.ok(pipeline, 'the Pipeline card');
    const cards = tokens(pipeline.parentNode);
    assert.ok(cards.includes('grid'), 'the cards sit in a grid');
    assert.ok(cards.includes('grid-cols-1'), `one minmax(0, 1fr) column below lg: ${cards.join(' ')}`);
    assert.ok(cards.includes('lg:grid-cols-2'), 'two columns from lg up, as before');
    // The summary's root holds the stat grid first, then the cards grid.
    const stats = tokens(pipeline.parentNode.parentNode.firstChild);
    assert.ok(stats.includes('grid-cols-1') && stats.includes('sm:grid-cols-2') && stats.includes('xl:grid-cols-4'), `the stat grid: ${stats.join(' ')}`);
    assertNoImplicitColumns(page.all(), 'JobSummary');
  } finally {
    await page.view.unmount();
  }
});

it('JobTracker ?view=summary: the page grid names its one column below xl, and keeps its xl template', async () => {
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const { JobTracker } = await loadModule('/src/pages/JobTracker.jsx');
  const page = await atRoute('/jobs?view=summary', { '/jobs': h(JobTracker, { store: { appState: { resumes: [] } } }) }, [job]);
  try {
    const aside = page.all().find((el) => el.tagName === 'ASIDE' && el.getAttribute('aria-label') === 'Career history');
    assert.ok(aside, 'the Summary view is shown, with its career history');
    const grid = tokens(aside.parentNode);
    assert.ok(grid.includes('grid'), 'the summary and the career history sit in a grid');
    assert.ok(grid.includes('grid-cols-1'), `one minmax(0, 1fr) column below xl: ${grid.join(' ')}`);
    assert.ok(grid.includes('xl:grid-cols-[1fr_18rem]'), 'desktop keeps the summary beside an 18rem career history');
    assertNoImplicitColumns(page.all(), 'JobTracker summary');
  } finally {
    await page.view.unmount();
    delete globalThis.localStorage;
  }
});
