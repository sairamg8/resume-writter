// Job-seeker journey (cycle 7): List (or Summary) view -> open a job -> back to the tracker by the page's
// "Job Tracker" breadcrumb, the sidebar or the page a deleted job returns to. Those links go to a bare /jobs,
// which always opened the Board: the user was dropped out of the view they were working in, while their search,
// status filter and list sort (kept for the tab's session, J-30) still applied to the view they did not see.
// The view last open in the tab is now what a bare /jobs opens; the Board stays the first view of a new tab.
// On the real JobTracker and store (tests/pdf/fake-dom.mjs, loaded through Vite), in a memory router.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { useNavigate } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { MemoryStorage, acme, atRoute, dayFromToday } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

// The router commits a navigation from a transition, after the click's own flush: let it land.
const settle = async () => { for (let i = 0; i < 10; i += 1) await new Promise((r) => { setImmediate(r); }); };

function Detail() {
  const navigate = useNavigate();
  return h('button', { type: 'button', onClick: () => navigate('/jobs') }, 'To the tracker');
}

// Open, with a deadline ahead: the Summary lists it, and a row there opens the job.
const JOB = { ...acme, deadline: dayFromToday(3) };

async function openTracker() {
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const { JobTracker } = await loadModule('/src/pages/JobTracker.jsx');
  globalThis.sessionStorage = new MemoryStorage();
  const page = await atRoute('/jobs', {
    '/jobs': h(JobTracker, { store: { appState: { resumes: [] } } }),
    '/jobs/:id': h(Detail),
  }, [JOB]);
  const button = (match) => page.all().find((el) => el.tagName === 'BUTTON' && (el.textContent.trim() === match || el.getAttribute('title') === match));
  /** The label of the view tab marked as open. */
  const openView = () => {
    const nav = page.all().find((el) => el.tagName === 'NAV' && el.getAttribute('aria-label') === 'Job tracker views');
    return nav.childNodes.filter((b) => b.getAttribute('aria-current') === 'page').map((b) => b.textContent.trim()).join();
  };
  const click = async (el) => { page.fire(el, 'onClick'); await settle(); };
  const close = async () => { await page.view.unmount(); delete globalThis.localStorage; delete globalThis.sessionStorage; };
  return { page, button, openView, click, close };
}

it('back to /jobs from a job opened in the List view is the List view, not the Board', async () => {
  const t = await openTracker();
  try {
    assert.equal(t.openView(), 'Board', 'a new tab starts on the Board');
    await t.click(t.button('List view'));
    assert.equal(t.openView(), 'List');
    await t.click(t.page.all().find((el) => el.tagName === 'TR' && el.textContent.includes('Acme')));
    assert.ok(t.button('To the tracker'), 'the job page opened');
    await t.click(t.button('To the tracker'));
    assert.equal(t.openView(), 'List', 'the List view the user left');
    assert.ok(t.page.all().some((el) => el.tagName === 'TR'), 'the table is shown');
  } finally {
    await t.close();
  }
});

it('back to /jobs from a job opened on the Summary is the Summary', async () => {
  const t = await openTracker();
  try {
    await t.click(t.button('Summary view'));
    assert.equal(t.openView(), 'Summary');
    const row = t.page.all().find((el) => el.tagName === 'BUTTON' && el.textContent.includes('Acme'));
    assert.ok(row, 'the job is listed under Upcoming deadlines');
    await t.click(row);
    await t.click(t.button('To the tracker'));
    assert.equal(t.openView(), 'Summary');
  } finally {
    await t.close();
  }
});
