// R4-DUX-18: on the Job Tracker's Board, a search that matched nothing, or no jobs at all, left every
// column saying "Drop a job here", with only a small "0 results" as a cue. Now one message replaces
// the columns: "No jobs match" with a Clear filters button when filtering, "No jobs yet" with Add job
// when there are none. A genuinely empty column on an unfiltered board still says "Drop a job here".
// Real components over the real store (tests/pdf/fake-dom.mjs, loaded through Vite); fictional data.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { KEY, MemoryStorage, acme } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const ev = (props = {}) => ({ preventDefault() {}, stopPropagation() {}, ...props });

/** The tracker at /jobs (Board view) over storage holding `jobs`; /jobs/new is a probe. */
async function tracker(jobs) {
  const dom = await import('./fake-dom.mjs');
  // The kanban scrolls a filtered status's column into view (querySelector, scrollIntoView).
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const proto = Object.getPrototypeOf(dom.fakeWindow().document.body);
  proto.scrollIntoView ??= () => {};
  const { createElement: h } = await import('react');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const { JobTracker } = await loadModule('/src/pages/JobTracker.jsx');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = new MemoryStorage();
  localStorage.setItem(KEY, JSON.stringify({ jobs, dataVersion: 2 }));
  _resetJobStoreForTest();
  function App() {
    return h(MemoryRouter, { initialEntries: ['/jobs'] }, h(Routes, null,
      h(Route, { path: '/jobs', element: h(JobTracker, { store: { appState: { resumes: [] } } }) }),
      h(Route, { path: '/jobs/new', element: h('p', null, 'NEW JOB FORM') })));
  }
  const view = dom.mount(App, {});
  const all = () => [...dom.elements(view.container)];
  return {
    view, all,
    text: () => view.container.textContent,
    button: (label) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label),
    props: (el) => dom.reactProps(el),
    fire: (el, name, e = ev()) => view.act(() => dom.reactProps(el)[name](e)),
    done: async () => { await view.unmount(); delete globalThis.localStorage; },
  };
}

it('R4-DUX-18: a search that matches nothing shows one "No jobs match" message, and Clear filters brings the board back', async () => {
  const page = await tracker([acme, { ...acme, id: 'b', company: 'Beta Labs', status: 'interview' }]);
  try {
    const search = page.all().find((el) => el.getAttribute('aria-label') === 'Search applications');
    page.fire(search, 'onChange', ev({ target: { value: 'no such company zz' } }));
    assert.match(page.text(), /No jobs match/);
    assert.doesNotMatch(page.text(), /Drop a job here/, 'no column says to drop a job');
    const clear = page.button('Clear filters');
    assert.ok(clear, 'a way to clear the filters');
    page.fire(clear, 'onClick');
    assert.doesNotMatch(page.text(), /No jobs match/);
    assert.match(page.text(), /Acme/);
    assert.match(page.text(), /Beta Labs/);
    const box = page.all().find((el) => el.getAttribute('aria-label') === 'Search applications');
    assert.equal(page.props(box).value, '', 'the search is emptied');
  } finally {
    await page.done();
  }
});

it('R4-DUX-18: with no jobs at all, the board says "No jobs yet" and offers Add job', async () => {
  const page = await tracker([]);
  try {
    assert.match(page.text(), /No jobs yet/);
    assert.doesNotMatch(page.text(), /Drop a job here/);
    // The header's Add job comes first; the empty state's is the last one.
    const add = page.all().filter((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Add job').at(-1);
    assert.ok(add);
    page.fire(add, 'onClick');
    await new Promise((r) => { setTimeout(r, 20); }); // the router commits a navigation in a transition
    assert.match(page.text(), /NEW JOB FORM/);
  } finally {
    await page.done();
  }
});

it('R4-DUX-18: an empty column on an unfiltered board with jobs still says "Drop a job here"', async () => {
  const page = await tracker([acme]);
  try {
    assert.match(page.text(), /Acme/);
    assert.match(page.text(), /Drop a job here/);
    assert.doesNotMatch(page.text(), /No jobs match|No jobs yet/);
  } finally {
    await page.done();
  }
});
