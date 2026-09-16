// The job pages open, edit and delete a job by its id (useJobStore: updateJob, deleteJob; the
// router's /jobs/:id; the board's card keys). A saved list can hold two jobs with one id — builds
// before 65e981d made it `job_${Date.now()}`, so two added in the same millisecond shared it; a
// hand-edited list may too — and loading only gave an id to a job with none, so deleting one of
// the two deleted both, and editing one edited both (ONB-5). The real store runs here over an
// in-memory localStorage, mounted with react-dom/client (tests/pdf/fake-dom.mjs: the store
// listens to the page's `storage` event). The job pages' own flows: cypress/e2e/06-job-tracker.cy.js.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

let vite;
before(async () => { ({ vite } = await setup()); });
after(teardown);

const KEY = 'cpwtcv_jobs_v1';

/** A localStorage stand-in over a Map. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const job = (id, company) => ({
  id, company, role: 'Dev', status: 'applied', todos: [], statusHistory: [{ status: 'applied', changedAt: 1 }],
  createdAt: 1, updatedAt: 1,
});
const saved = (jobs) => JSON.stringify({ jobs, dataVersion: 2 });

/**
 * The job store as a page opens it over storage holding `jobs`: a fresh copy of the module (it
 * keeps the list for the visit), mounted. Returns the store as the page last rendered it, what
 * storage holds (`stored()`), the mount, and `act`.
 */
async function openStore(jobs) {
  const mod = await vite.moduleGraph.getModuleByUrl('/src/hooks/useJobStore.js', true);
  if (mod) vite.moduleGraph.invalidateModule(mod);
  const { useJobStore } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = new MemoryStorage([[KEY, saved(jobs)]]);
  const seen = {};
  function Probe() {
    seen.store = useJobStore();
    return null;
  }
  const view = mount(Probe, {});
  return {
    view,
    get store() { return seen.store; },
    stored: () => JSON.parse(localStorage.getItem(KEY)).jobs,
    async close() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

const companies = (jobs) => jobs.map((j) => j.company);

it('two saved jobs sharing one id: the second gets its own, kept in storage — the first keeps the id a link opens', async () => {
  const page = await openStore([job('job_1', 'Acme'), job('job_1', 'Beta'), job('job_2', 'Gamma')]);
  try {
    const ids = page.store.jobs.map((j) => j.id);
    assert.equal(ids[0], 'job_1');
    assert.equal(ids[2], 'job_2', 'an id no other job has is kept');
    assert.match(ids[1], /^job_./);
    assert.equal(new Set(ids).size, 3, `every job its own id: ${ids}`);
    assert.deepEqual(companies(page.store.jobs), ['Acme', 'Beta', 'Gamma'], 'nothing is dropped');
    assert.deepEqual(page.stored().map((j) => j.id), ids, 'saved at once, as the page shows it');
    assert.equal(page.store.recovery, null, 'nothing was lost: no notice');
    assert.equal(localStorage.length, 1, 'and no backup');
  } finally {
    await page.close();
  }
});

it('deleting one of two jobs that shared an id deletes that one only', async () => {
  const page = await openStore([job('job_1', 'Acme'), job('job_1', 'Beta')]);
  try {
    // Before: deleteJob('job_1') filtered out both, and the tracker was empty.
    page.view.act(() => page.store.deleteJob('job_1'));
    assert.deepEqual(companies(page.store.jobs), ['Beta']);
    assert.deepEqual(companies(page.stored()), ['Beta']);
    page.view.act(() => page.store.deleteJob(page.store.jobs[0].id));
    assert.deepEqual(page.store.jobs, []);
  } finally {
    await page.close();
  }
});

it('editing one of two jobs that shared an id edits that one only — its status, its history', async () => {
  const page = await openStore([job('job_1', 'Acme'), job('job_1', 'Beta')]);
  try {
    const second = page.store.jobs[1].id;
    page.view.act(() => page.store.updateJob(second, { company: 'Beta Ltd', status: 'offer' }));
    const [a, b] = page.store.jobs;
    // Before: both became 'Beta Ltd', at 'offer'.
    assert.deepEqual([a.company, a.status, a.statusHistory.length], ['Acme', 'applied', 1]);
    assert.deepEqual([b.company, b.status, b.statusHistory.length], ['Beta Ltd', 'offer', 2]);
    assert.deepEqual(companies(page.stored()), ['Acme', 'Beta Ltd']);
  } finally {
    await page.close();
  }
});

it('a list with shared ids saved by another tab (an older build still open) is taken with an id for each', async () => {
  const page = await openStore([job('job_1', 'Acme')]);
  try {
    const list = saved([job('job_7', 'Delta'), job('job_7', 'Echo')]);
    localStorage.setItem(KEY, list);
    page.view.act(() => page.view.window.dispatchEvent({ type: 'storage', key: KEY, newValue: list }));
    assert.deepEqual(companies(page.store.jobs), ['Delta', 'Echo']);
    const ids = page.store.jobs.map((j) => j.id);
    assert.equal(ids[0], 'job_7');
    assert.equal(new Set(ids).size, 2, `every job its own id: ${ids}`);
    page.view.act(() => page.store.deleteJob('job_7'));
    assert.deepEqual(companies(page.store.jobs), ['Echo']);
  } finally {
    await page.close();
  }
});

it('a saved list whose ids are all its own loads as it was saved', async () => {
  const jobs = [job('job_1', 'Acme'), job('job_2', 'Beta')];
  const page = await openStore(jobs);
  try {
    assert.deepEqual(page.store.jobs, jobs);
    assert.deepEqual(page.stored(), jobs);
  } finally {
    await page.close();
  }
});
