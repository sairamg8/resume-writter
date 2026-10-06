// C-1 (typing-freeze hunt, Job Tracker with 3000 jobs: the first search key was one 696 ms long task).
// Work counts, not clocks. A key (1) folded the six search fields of every job again — String
// normalize calls — and (2) re-rendered every card of the board with the same job objects. Now the
// folded text is kept per job (a second key folds nothing), and the cards are memoised behind
// stable handlers (a key re-renders only the cards that appear). Matches and their order are unchanged.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const N = 3000;
const STATUSES = ['saved', 'applied', 'phone_screen', 'interview', 'offer'];
let reads = 0; // a card reads `todos` once per render of it
const makeJobs = () => Array.from({ length: N }, (_, i) => {
  const job = {
    id: `j${i}`, company: `Compañía ${i}`, role: i % 2 ? 'Backend Engineer' : 'Diseñador', status: STATUSES[i % STATUSES.length],
    url: '', location: 'Zürich', salary: '', contact: '', appliedDate: '', deadline: '', resumeId: '', notes: '',
    statusHistory: [], createdAt: i, updatedAt: i,
  };
  Object.defineProperty(job, 'todos', { get() { reads += 1; return []; }, enumerable: true });
  return job;
});

it('C-1: a second search key folds no job text again; the first folds each job once', async () => {
  const { filterJobs } = await loadModule('/src/utils/jobQuery.js');
  const jobs = makeJobs();
  const real = String.prototype.normalize;
  let calls = 0;
  String.prototype.normalize = function counted(...a) { calls += 1; return real.apply(this, a); };
  try {
    const one = filterJobs(jobs, { q: 'e' });
    const first = calls;
    calls = 0;
    const two = filterJobs(jobs, { q: 'en' });
    assert.ok(first <= N * 3, `the first key folds each job's text once (${first} normalize calls for ${N} jobs)`);
    assert.equal(calls, 0, `the second key folds nothing (${calls} normalize calls)`);
    assert.equal(one.length, N, 'every job has an e (Compañía / Engineer / Diseñador)');
    assert.deepEqual(two.map((j) => j.id), jobs.filter((j) => j.role === 'Backend Engineer').map((j) => j.id), 'same matches, same order');
    // An edit in place is folded again, so the kept text never goes stale.
    jobs[0].role = 'Zebra tamer';
    assert.deepEqual(filterJobs(jobs, { q: 'zebra' }).map((j) => j.id), ['j0']);
  } finally {
    String.prototype.normalize = real;
  }
});

it('C-1: a search re-renders only the cards that appear, not the whole board', async () => {
  const { KanbanView } = await loadModule('/src/components/job/KanbanView.jsx');
  const dom = await import('./fake-dom.mjs');
  const jobs = makeJobs();
  const handlers = () => ({ updateJob() {}, onNavigate() {}, onDelete() {} });
  reads = 0;
  const view = dom.mount(KanbanView, { jobs, ...handlers() });
  try {
    assert.ok(reads >= N, `first render draws every card (${reads})`);
    reads = 0;
    // A search that keeps 100 of them, with fresh handler functions as the page makes each render.
    view.update({ jobs: jobs.slice(0, 100), ...handlers() });
    assert.equal(reads, 0, `kept cards render again for nothing (${reads} card renders)`);
    // The same list again with new handlers (a re-render of the page): still no card renders.
    view.update({ jobs: jobs.slice(0, 100), ...handlers() });
    assert.equal(reads, 0, `new handler functions re-rendered ${reads} cards`);
    // Clearing the search brings the rest back: only those are drawn.
    view.update({ jobs, ...handlers() });
    assert.equal(reads, N - 100, `only the ${N - 100} cards that appear render (${reads})`);
  } finally {
    await view.unmount();
  }
});
