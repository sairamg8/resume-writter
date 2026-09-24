// The Job Tracker page and the job pieces no other test drives, on the real components over the real
// store (tests/pdf/fake-dom.mjs, loaded through Vite). R2-156: the tracker's search, status filter,
// view switch, delete and CSV export, a to-do's rename / tick / delete, and the interview-stage picker
// were verified by Cypress only. (Pipeline and the Tasks tab: 82-job-pipeline-tasks.test.mjs.)
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_jobs_v1';
const job = (id, company, role, status, extra = {}) => ({
  id, company, role, status, url: '', location: '', salary: '', contact: '', appliedDate: '', deadline: '',
  resumeId: '', notes: '', todos: [], statusHistory: [{ status, changedAt: 1 }], createdAt: 1, updatedAt: 1, ...extra,
});
const JOBS = [
  job('a', 'Acme', 'Frontend Dev', 'applied', { location: 'Berlin' }),
  job('b', 'Beta Labs', 'QA Engineer', 'interview'),
  job('c', 'Cobalt', 'Frontend Lead', 'rejected'),
];

function memoryStorage(entries = []) {
  const map = new Map(entries);
  return {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
}

const ev = (props = {}) => ({ preventDefault() {}, stopPropagation() {}, ...props });

async function render(component, props) {
  const dom = await import('./fake-dom.mjs');
  // The kanban scrolls a filtered status's column into view (querySelector, scrollIntoView).
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const proto = Object.getPrototypeOf(dom.fakeWindow().document.body);
  proto.scrollIntoView ??= () => {};
  const view = dom.mount(component, props);
  const all = () => [...dom.elements(view.container)];
  return {
    view, all,
    text: () => view.container.textContent,
    button: (match) => all().find((el) => el.tagName === 'BUTTON' && (typeof match === 'string' ? el.textContent.trim() === match || el.getAttribute('title') === match : match.test(el.textContent))),
    fire: (el, name, e = ev()) => view.act(() => dom.reactProps(el)[name](e)),
  };
}

/** The tracker over storage holding JOBS; `route` probes where a click navigated. */
async function tracker() {
  const { createElement: h } = await import('react');
  const { MemoryRouter, Routes, Route, useParams } = await import('react-router-dom');
  const { JobTracker } = await loadModule('/src/pages/JobTracker.jsx');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = memoryStorage([[KEY, JSON.stringify({ jobs: JOBS, dataVersion: 2 })]]);
  _resetJobStoreForTest();
  function Detail() { return h('p', null, `DETAIL ${useParams().id}`); }
  function App() {
    return h(MemoryRouter, { initialEntries: ['/jobs'] }, h(Routes, null,
      h(Route, { path: '/jobs', element: h(JobTracker, { store: { appState: { resumes: [] } } }) }),
      h(Route, { path: '/jobs/:id', element: h(Detail) })));
  }
  const page = await render(App, {});
  const stored = () => JSON.parse(localStorage.getItem(KEY)).jobs;
  /** The companies the current view shows (kanban cards or list rows). */
  const shown = () => ['Acme', 'Beta Labs', 'Cobalt'].filter((c) => page.all().some((el) =>
    (el.getAttribute('aria-roledescription') === 'draggable' || el.tagName === 'TR') && el.textContent.includes(c)));
  const done = async () => { await page.view.unmount(); delete globalThis.localStorage; };
  return { page, stored, shown, done };
}

it('R2-156: the tracker shows every job, and the search narrows them by company, role or location', async () => {
  const { page, shown, done } = await tracker();
  try {
    assert.deepEqual(shown(), ['Acme', 'Beta Labs', 'Cobalt']);
    const search = page.all().find((el) => el.getAttribute('aria-label') === 'Search applications');
    page.fire(search, 'onChange', ev({ target: { value: 'frontend' } }));
    assert.deepEqual(shown(), ['Acme', 'Cobalt']);
    assert.match(page.text(), /2 results/);
    page.fire(search, 'onChange', ev({ target: { value: 'berlin' } }));
    assert.deepEqual(shown(), ['Acme']);
    page.fire(search, 'onChange', ev({ target: { value: '' } }));
    assert.deepEqual(shown(), ['Acme', 'Beta Labs', 'Cobalt']);
  } finally {
    await done();
  }
});

it('R2-156: a status chip filters to that status, a second press or Clear shows all again, in both views', async () => {
  const { page, shown, done } = await tracker();
  try {
    page.fire(page.button('Interview 1'), 'onClick');
    assert.deepEqual(shown(), ['Beta Labs']);
    page.fire(page.button('Interview 1'), 'onClick');
    assert.deepEqual(shown(), ['Acme', 'Beta Labs', 'Cobalt']);
    page.fire(page.button('Rejected 1'), 'onClick');
    page.fire(page.button('List view'), 'onClick');
    assert.deepEqual(shown(), ['Cobalt'], 'the list view keeps the filter');
    // The filter's Clear chip, not the header's "Clear" (all jobs), which comes first.
    const clearFilter = page.all().filter((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Clear').at(-1);
    page.fire(clearFilter, 'onClick');
    assert.deepEqual(shown(), ['Acme', 'Beta Labs', 'Cobalt']);
  } finally {
    await done();
  }
});

it('R2-156: a card opens its job; delete asks first and removes it only on OK', async () => {
  const { page, stored, shown, done } = await tracker();
  try {
    const answers = [false, true];
    const asked = [];
    page.view.window.confirm = globalThis.confirm = (q) => { asked.push(q); return answers.shift(); };
    const deleteOf = () => page.all().filter((el) => el.getAttribute('aria-label') === 'Delete application')[0];
    page.fire(deleteOf(), 'onClick');
    assert.deepEqual(shown(), ['Acme', 'Beta Labs', 'Cobalt'], 'Cancel keeps it');
    page.fire(deleteOf(), 'onClick');
    assert.deepEqual(asked, ['Delete Acme?', 'Delete Acme?']);
    assert.deepEqual(shown(), ['Beta Labs', 'Cobalt']);
    assert.deepEqual(stored().map((j) => j.id), ['b', 'c'], 'and it is saved');
    const card = page.all().find((el) => el.getAttribute('aria-roledescription') === 'draggable' && el.textContent.includes('Beta Labs'));
    page.fire(card, 'onClick');
    await new Promise((r) => { setTimeout(r, 20); }); // the router commits a navigation in a transition
    assert.match(page.text(), /DETAIL b/);
  } finally {
    delete globalThis.confirm;
    await done();
  }
});

it('R2-156: Export CSV downloads every job — not only the filtered ones — as job_applications.csv', async () => {
  const { page, done } = await tracker();
  const blobs = [];
  const { createObjectURL, revokeObjectURL } = URL;
  URL.createObjectURL = (b) => { blobs.push(b); return 'blob:x'; };
  URL.revokeObjectURL = () => {};
  const clicked = [];
  const { document } = page.view;
  const make = document.createElement.bind(document);
  document.createElement = (tag) => Object.assign(make(tag), { click() { clicked.push(this.download); } });
  try {
    page.fire(page.button('Interview 1'), 'onClick');
    page.fire(page.button('Export CSV'), 'onClick');
    assert.deepEqual(clicked, ['job_applications.csv']);
    const csv = await blobs[0].text();
    for (const c of ['Acme', 'Beta Labs', 'Cobalt']) assert.match(csv, new RegExp(c));
  } finally {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    await done();
  }
});

it('R2-156: a to-do ticks, deletes, and renames on double-click — Enter saves, Escape and a blank keep the text', async () => {
  const { TodoItem } = await loadModule('/src/components/job/TodoItem.jsx');
  const calls = [];
  const todo = { id: 't1', text: 'Research', done: false };
  const page = await render(TodoItem, {
    todo, onToggle: () => calls.push('toggle'), onDelete: () => calls.push('delete'), onRename: (t) => calls.push(['rename', t]),
  });
  const buttons = () => page.all().filter((el) => el.tagName === 'BUTTON');
  const label = () => page.all().find((el) => el.tagName === 'SPAN' && el.textContent === 'Research');
  const input = () => page.all().find((el) => el.getAttribute('aria-label') === 'Task');
  try {
    page.fire(buttons()[0], 'onClick');
    page.fire(buttons().at(-1), 'onClick');
    assert.deepEqual(calls, ['toggle', 'delete']);

    page.fire(label(), 'onDoubleClick');
    page.fire(input(), 'onChange', ev({ target: { value: '  Research Acme ' } }));
    page.fire(input(), 'onKeyDown', ev({ key: 'Enter' }));
    assert.deepEqual(calls.at(-1), ['rename', 'Research Acme'], 'trimmed');
    assert.equal(input(), undefined, 'editing ends');

    page.fire(label(), 'onDoubleClick');
    page.fire(input(), 'onChange', ev({ target: { value: 'Something else' } }));
    page.fire(input(), 'onKeyDown', ev({ key: 'Escape' }));
    assert.ok(label(), 'Escape puts the text back');

    page.fire(label(), 'onDoubleClick');
    page.fire(input(), 'onChange', ev({ target: { value: '   ' } }));
    page.fire(input(), 'onBlur');
    assert.ok(label(), 'a blank edit keeps the text');
    assert.equal(calls.filter((c) => c[0] === 'rename').length, 1, 'neither Escape nor a blank renames');
  } finally {
    await page.view.unmount();
  }
});

it('R2-156: the stage picker selects a stage, deselects it, adds a custom one on Enter, and removing the picked one clears it', async () => {
  const { InterviewStageSelector } = await loadModule('/src/components/job/InterviewStageSelector.jsx');
  const { PREDEFINED_STAGES } = await loadModule('/src/hooks/useJobStages.js');
  const picked = [];
  const removed = [];
  const props = {
    stage: '', onStageChange: (s) => picked.push(s), customStages: ['Founder Chat'],
    addCustomStage: (s) => (s.trim() ? s.trim() : null), removeCustomStage: (s) => removed.push(s),
  };
  const page = await render(InterviewStageSelector, props);
  try {
    const first = PREDEFINED_STAGES[0];
    page.fire(page.button(new RegExp(`^1\\.${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)), 'onClick');
    assert.deepEqual(picked, [first]);

    page.view.update({ ...props, stage: first });
    page.fire(page.button(new RegExp(`^1\\.${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)), 'onClick');
    assert.equal(picked.at(-1), '', 'pressing the picked stage clears it');

    const input = page.all().find((el) => el.tagName === 'INPUT');
    page.fire(input, 'onChange', ev({ target: { value: ' 2nd Round ' } }));
    page.fire(input, 'onKeyDown', ev({ key: 'Enter' }));
    assert.equal(picked.at(-1), '2nd Round', 'a new stage is added and picked');
    assert.equal(input.value ?? '', '', 'and the box empties');

    page.view.update({ ...props, stage: 'Founder Chat' });
    page.fire(page.button('Remove'), 'onClick');
    assert.deepEqual(removed, ['Founder Chat']);
    assert.equal(picked.at(-1), '', 'the job no longer names a stage that is gone');
  } finally {
    await page.view.unmount();
  }
});

it('a job-page field opened and closed without typing writes nothing, even when the job never had it', async () => {
  const { Field } = await loadModule('/src/components/job/Field.jsx');
  const writes = [];
  for (const value of [undefined, '', 'Berlin']) {
    const page = await render(Field, { label: 'Location', value, onChange: (v) => writes.push(v) });
    try {
      page.fire(page.button('Edit'), 'onClick');
      const input = page.all().find((el) => el.tagName === 'INPUT');
      page.fire(input, 'onBlur');
      page.fire(page.button('Edit'), 'onClick');
      page.fire(page.all().find((el) => el.tagName === 'INPUT'), 'onKeyDown', ev({ key: 'Enter' }));
    } finally {
      await page.view.unmount();
    }
  }
  assert.deepEqual(writes, [], `writes: ${JSON.stringify(writes)}`);
  // A real edit is still written.
  const page = await render(Field, { label: 'Location', value: undefined, onChange: (v) => writes.push(v) });
  try {
    page.fire(page.button('Edit'), 'onClick');
    page.fire(page.all().find((el) => el.tagName === 'INPUT'), 'onChange', ev({ target: { value: 'Remote' } }));
    page.fire(page.all().find((el) => el.tagName === 'INPUT'), 'onBlur');
    assert.deepEqual(writes, ['Remote']);
  } finally {
    await page.view.unmount();
  }
});
