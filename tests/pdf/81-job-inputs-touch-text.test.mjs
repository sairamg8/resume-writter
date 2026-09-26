// Every field of the job tracker is 16 px on a touch screen, on the real components (tests/pdf/fake-dom.mjs,
// loaded through Vite). J-38: iOS Safari zooms the page into any field it focuses whose text is smaller
// than 16 px, and the Add / Edit job form, the job page's fields, the stage picker and the tasks were all
// 14 px, so every tap on one zoomed the page. The kit's own controls (controlClass, which the tracker's
// search box uses) were already 16 px on touch (pointer-coarse:text-base); these now say the same.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_jobs_v1';
const job = {
  id: 'a', company: 'Acme', role: 'Dev', status: 'applied', location: 'Remote', salary: '', url: '', contact: '',
  appliedDate: '2026-09-01', deadline: '', resumeId: '', notes: '', todos: [{ id: 't1', text: 'Research', done: false }],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1,
};

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
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const proto = Object.getPrototypeOf(dom.fakeWindow().document.body);
  proto.scrollIntoView ??= () => {};
  const view = dom.mount(component, props);
  const all = () => [...dom.elements(view.container)];
  return {
    view, all,
    fire: (el, name, e = ev()) => view.act(() => dom.reactProps(el)[name](e)),
  };
}

/**
 * The text fields and pickers on the page that would be under 16 px on a phone or a tablet: a field
 * passes with `pointer-coarse:text-base`, or with an unprefixed `text-base` that no breakpoint shrinks.
 */
function under16OnTouch(page) {
  // React sets an <input>'s type as a property, not an attribute, and the fake DOM keeps them apart:
  // read both, or the tracker's hidden file input reads as a text field.
  const fields = page.all().filter((el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
    && !['file', 'hidden', 'checkbox', 'radio'].includes(el.getAttribute('type') ?? el.type));
  assert.ok(fields.length > 0, 'the page has fields to check');
  return fields.filter((el) => {
    const cls = el.getAttribute('class') ?? '';
    if (/(^|\s)pointer-coarse:text-base(\s|$)/.test(cls)) return false;
    return !(/(^|\s)text-base(\s|$)/.test(cls) && !/(^|\s)(sm|md|lg|xl|2xl):text-(xs|sm|\[)/.test(cls));
  }).map((el) => el.getAttribute('aria-label') || el.getAttribute('id') || el.getAttribute('placeholder') || el.tagName);
}

it('J-38: every field of the Add job form is 16 px on a touch screen, the custom-stage box among them', async () => {
  const { createElement: h } = await import('react');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = memoryStorage([[KEY, JSON.stringify({ jobs: [], dataVersion: 2 })]]);
  _resetJobStoreForTest();
  function App() {
    return h(MemoryRouter, { initialEntries: ['/jobs/new'] }, h(Routes, null,
      h(Route, { path: '/jobs/new', element: h(JobForm, { store: { appState: { resumes: [] } } }) })));
  }
  const page = await render(App, {});
  try {
    assert.ok(page.all().some((el) => el.getAttribute('placeholder') === 'e.g. 2nd Round, Founder Chat…'), 'the stage picker is on the form');
    assert.deepEqual(under16OnTouch(page), []);
  } finally {
    await page.view.unmount();
    delete globalThis.localStorage;
  }
});

it('J-38: the job page\'s Overview fields — each pencil\'s box, the deadline and the résumé picker — are 16 px on a touch screen', async () => {
  const { OverviewTab } = await loadModule('/src/components/job/OverviewTab.jsx');
  const page = await render(OverviewTab, { job, set: () => {}, resumes: [], navigate: () => {} });
  try {
    const pencils = page.all().filter((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Edit');
    assert.ok(pencils.length >= 5);
    for (const pencil of pencils) page.fire(pencil, 'onClick');
    assert.ok(page.all().some((el) => el.getAttribute('aria-label') === 'Company' && el.tagName === 'INPUT'), 'a pencil opened its box');
    assert.deepEqual(under16OnTouch(page), []);
  } finally {
    await page.view.unmount();
  }
});

it('J-38: the Tasks tab\'s new-task box and a task being renamed are 16 px on a touch screen', async () => {
  const { TasksTab } = await loadModule('/src/components/job/TasksTab.jsx');
  const page = await render(TasksTab, { todos: job.todos, onChange: () => {} });
  try {
    const label = page.all().find((el) => el.tagName === 'SPAN' && el.textContent === 'Research');
    page.fire(label, 'onDoubleClick');
    assert.ok(page.all().some((el) => el.getAttribute('aria-label') === 'Task'), 'the rename box is open');
    assert.ok(page.all().some((el) => el.getAttribute('aria-label') === 'New task'));
    assert.deepEqual(under16OnTouch(page), []);
  } finally {
    await page.view.unmount();
  }
});

it('J-38: the tracker\'s search box is 16 px on a touch screen (the kit\'s SearchInput, already so)', async () => {
  const { createElement: h } = await import('react');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const { JobTracker } = await loadModule('/src/pages/JobTracker.jsx');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = memoryStorage([[KEY, JSON.stringify({ jobs: [job], dataVersion: 2 })]]);
  _resetJobStoreForTest();
  function App() {
    return h(MemoryRouter, { initialEntries: ['/jobs'] }, h(Routes, null,
      h(Route, { path: '/jobs', element: h(JobTracker, { store: { appState: { resumes: [] } } }) })));
  }
  const page = await render(App, {});
  try {
    assert.ok(page.all().some((el) => el.getAttribute('aria-label') === 'Search applications'));
    assert.deepEqual(under16OnTouch(page), []);
  } finally {
    await page.view.unmount();
    delete globalThis.localStorage;
  }
});
