// R5-JOB-02: /jobs/:id/edit for a job that does not exist showed a grey "Job not found." line and
// a text link, while the job page (/jobs/:id) shows the kit's EmptyState for the same missing job.
// Now the edit page shows that same state: the title "Job not found", the line "It may have been
// deleted, or the link is wrong." and a primary "← Back to Job Tracker" button link to /jobs.
// On the real JobForm and JobDetail (tests/pdf/fake-dom.mjs, loaded through Vite for the `@/` aliases).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/** The missing-job state at `path`, as its title, description and action link. */
async function missing(path) {
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const { createElement: h } = await import('react');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
  const { JobDetail } = await loadModule('/src/pages/JobDetail.jsx');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = new MemoryStorage();
  localStorage.setItem('cpwtcv_jobs_v1', JSON.stringify({ jobs: [], dataVersion: 2 }));
  globalThis.sessionStorage = new MemoryStorage();
  _resetJobStoreForTest();
  const store = { appState: { resumes: [] } };
  function App() {
    return h(MemoryRouter, { initialEntries: [path] }, h(Routes, null,
      h(Route, { path: '/jobs/:id/edit', element: h(JobForm, { store }) }),
      h(Route, { path: '/jobs/:id', element: h(JobDetail, { store }) })));
  }
  const view = dom.mount(App);
  try {
    const all = [...dom.elements(view.container)];
    const heading = all.find((el) => el.tagName === 'H3');
    const link = all.find((el) => el.tagName === 'A' && el.textContent.trim() === '← Back to Job Tracker');
    return {
      title: heading?.textContent.trim(),
      text: view.container.textContent,
      link: link && { href: link.getAttribute('href'), className: link.getAttribute('class') },
      bareButton: all.some((el) => el.tagName === 'BUTTON' && el.textContent.trim() === '← Back to Job Tracker'),
    };
  } finally {
    await view.unmount();
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
  }
}

it('R5-JOB-02: a missing job\'s edit page shows the kit EmptyState with a primary button back to the tracker', async () => {
  const edit = await missing('/jobs/nope/edit');
  assert.equal(edit.title, 'Job not found');
  assert.match(edit.text, /It may have been deleted, or the link is wrong\./);
  assert.ok(edit.link, 'a "← Back to Job Tracker" link');
  assert.equal(edit.link.href, '/jobs');
  assert.equal(edit.bareButton, false, 'not the old text button');
});

it('R5-JOB-02: the edit page and the job page show the same missing-job state', async () => {
  const edit = await missing('/jobs/nope/edit');
  const page = await missing('/jobs/nope');
  assert.equal(edit.title, page.title);
  assert.equal(edit.text, page.text);
  assert.deepEqual(edit.link, page.link, 'the same button, class for class');
});
