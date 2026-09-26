// The Job Tracker keeps the user's search, status filter and list sort across a trip to a job and
// back, on the real page over the real store (tests/pdf/fake-dom.mjs, loaded through Vite). J-30:
// opening a job unmounts the tracker, and all three were component state, so Back showed every job
// again in the default order while only the view (?view=, in the address) came back. They are kept
// in sessionStorage for the tab's session now; a saved value the page no longer knows is ignored.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_jobs_v1';
const job = (id, company, role, status) => ({
  id, company, role, status, url: '', location: '', salary: '', contact: '', appliedDate: '', deadline: '',
  resumeId: '', notes: '', todos: [], statusHistory: [{ status, changedAt: 1 }], createdAt: 1, updatedAt: 1,
});
const JOBS = [
  job('a', 'Acme', 'Frontend Dev', 'applied'),
  job('b', 'Beta Labs', 'QA Engineer', 'interview'),
  job('c', 'Cobalt', 'Frontend Lead', 'rejected'),
];
const COMPANIES = JOBS.map((j) => j.company);

function memoryStorage(entries = []) {
  const map = new Map(entries);
  return {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
}

const ev = (props = {}) => ({ preventDefault() {}, stopPropagation() {}, ...props });
/** React Router commits a navigation in a transition: let it land before reading the page. */
const settle = async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => { setImmediate(r); }); await new Promise((r) => { setTimeout(r, 20); }); };

/**
 * The tracker at /jobs over storage holding JOBS, and a job page whose one button goes Back (as
 * the browser's Back does). `session` is the tab's sessionStorage, shared by every mount.
 */
async function tracker(session) {
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const { createElement: h } = await import('react');
  const { MemoryRouter, Routes, Route, useNavigate, useParams } = await import('react-router-dom');
  const { JobTracker } = await loadModule('/src/pages/JobTracker.jsx');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = memoryStorage([[KEY, JSON.stringify({ jobs: JOBS, dataVersion: 2 })]]);
  globalThis.sessionStorage = session;
  _resetJobStoreForTest();
  function Detail() {
    const navigate = useNavigate();
    return h('button', { type: 'button', onClick: () => navigate(-1) }, `Back from ${useParams().id}`);
  }
  function App() {
    return h(MemoryRouter, { initialEntries: ['/jobs'] }, h(Routes, null,
      h(Route, { path: '/jobs', element: h(JobTracker, { store: { appState: { resumes: [] } } }) }),
      h(Route, { path: '/jobs/:id', element: h(Detail) })));
  }
  const view = dom.mount(App, {});
  Object.getPrototypeOf(view.document.body).scrollIntoView ??= () => {};
  const all = () => [...dom.elements(view.container)];
  const button = (match) => all().find((el) => el.tagName === 'BUTTON' && (el.textContent.trim() === match || el.getAttribute('title') === match));
  const fire = (el, name, e = ev()) => view.act(() => dom.reactProps(el)[name](e));
  const search = () => all().find((el) => el.getAttribute('aria-label') === 'Search applications');
  /** The companies shown, in the order the current view shows them (kanban cards or list rows). */
  const shown = () => all()
    .filter((el) => el.getAttribute('aria-roledescription') === 'draggable' || el.tagName === 'TR')
    .map((el) => COMPANIES.find((c) => el.textContent.includes(c)))
    .filter(Boolean);
  const row = (company) => all().find((el) => el.tagName === 'TR' && el.textContent.includes(company));
  /** Open `company`'s job from the list, then go Back to the tracker. */
  async function roundTrip(company) {
    fire(row(company), 'onClick');
    await settle();
    assert.ok(button(`Back from ${JOBS.find((j) => j.company === company).id}`), 'the job page opened');
    fire(button(`Back from ${JOBS.find((j) => j.company === company).id}`), 'onClick');
    await settle();
  }
  const done = async () => { await view.unmount(); delete globalThis.localStorage; delete globalThis.sessionStorage; };
  return { view, all, button, fire, search, shown, roundTrip, done };
}

it('J-30: the search, the status filter and the list sort are still there after opening a job and going Back', async () => {
  const page = await tracker(memoryStorage());
  try {
    page.fire(page.search(), 'onChange', ev({ target: { value: 'frontend' } }));
    page.fire(page.button('List view'), 'onClick');
    await settle();
    page.fire(page.button('Company'), 'onClick');
    page.fire(page.button('Company'), 'onClick'); // Z to A
    assert.deepEqual(page.shown(), ['Cobalt', 'Acme']);

    await page.roundTrip('Cobalt');
    assert.equal(page.view.document.body.textContent.includes('Back from'), false, 'the tracker is back');
    assert.equal(page.all().some((el) => el.tagName === 'TR'), true, 'in the List view');
    assert.equal(page.search().value, 'frontend', 'the search is kept');
    assert.deepEqual(page.shown(), ['Cobalt', 'Acme'], 'the search and the Company Z-A sort are kept');

    page.fire(page.button('Applied 1'), 'onClick');
    assert.deepEqual(page.shown(), ['Acme']);
    await page.roundTrip('Acme');
    assert.deepEqual(page.shown(), ['Acme'], 'the status filter is kept');
    assert.equal(page.button('Applied 1').getAttribute('aria-pressed'), 'true');
  } finally {
    await page.done();
  }
});

it('J-30: a saved status, sort or search the page does not know is ignored, not applied', async () => {
  const session = memoryStorage([
    ['cpwtcv_jobs_status', JSON.stringify('no-such-status')],
    ['cpwtcv_jobs_sort', JSON.stringify({ key: 'nope', dir: 'sideways' })],
    ['cpwtcv_jobs_search', '{not json'],
  ]);
  const page = await tracker(session);
  try {
    assert.deepEqual(page.shown(), COMPANIES, 'every job shows');
    assert.equal(page.search().value, '');
    page.fire(page.button('List view'), 'onClick');
    await settle();
    assert.deepEqual(page.shown(), COMPANIES, 'the list opens in its default order');
  } finally {
    await page.done();
  }
});
