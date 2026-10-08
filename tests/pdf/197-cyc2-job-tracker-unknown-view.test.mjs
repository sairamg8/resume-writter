// Navigation hunt (cycle 2): /jobs?view=<something that is not a view>. The tracker read the value as it stood: no tab
// matched it, so the page drew the Board (its fallback branch) with none of Summary · Board · List marked as the open
// view, and it did so for any typo or old link. An unknown ?view= now reads as the default view, Board, and the tab
// says so; a known one is read as before.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, atRoute } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

/** The label of the tab marked as the open view at `path` ('' when none is). */
async function openTabAt(path) {
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const { JobTracker } = await loadModule('/src/pages/JobTracker.jsx');
  const page = await atRoute(path, { '/jobs': h(JobTracker, { store: { appState: { resumes: [] } } }) }, [acme]);
  try {
    const nav = page.all().find((el) => el.tagName === 'NAV' && el.getAttribute('aria-label') === 'Job tracker views');
    assert.ok(nav, 'the view tabs');
    const lit = nav.childNodes.filter((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-current') === 'page');
    return lit.map((b) => b.textContent.trim());
  } finally {
    await page.view.unmount();
    delete globalThis.localStorage;
  }
}

it('an unknown ?view= opens the Board and the Board tab is the one marked', async () => {
  assert.deepEqual(await openTabAt('/jobs?view=bogus'), ['Board']);
  assert.deepEqual(await openTabAt('/jobs?view='), ['Board']);
});

it('the known views and no ?view= are read as before', async () => {
  assert.deepEqual(await openTabAt('/jobs'), ['Board']);
  assert.deepEqual(await openTabAt('/jobs?view=summary'), ['Summary']);
  assert.deepEqual(await openTabAt('/jobs?view=list'), ['List']);
  assert.deepEqual(await openTabAt('/jobs?view=kanban'), ['Board']);
});
