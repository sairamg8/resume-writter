// The Job Tracker's Resume Used pickers, on the real components (tests/pdf/fake-dom.mjs, loaded
// through Vite). R2-135: a cover letter is a résumé record marked `kind: 'letter'`, and the pickers
// on a job's Overview tab and in the job form listed every letter among the résumés. They list the
// résumés alone now; a letter the job is already linked to stays listed (and its Open button opens
// it on its letter's tab), so the link still shows until the user picks a résumé.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const RESUMES = [
  { id: 'r1', name: 'Frontend CV' },
  { id: 'l1', name: 'Cover Letter', kind: 'letter' },
  { id: 'r2', name: 'Backend CV' },
  { id: 'l2', name: 'Acme letter', kind: 'letter' },
];

const job = {
  id: 'a', company: 'Acme', role: 'Dev', status: 'applied', location: '', salary: '', url: '', contact: '',
  appliedDate: '2026-09-01', deadline: '', resumeId: '', todos: [], statusHistory: [{ status: 'applied', changedAt: 1 }],
};

// The Resume Used picker's options (the Overview's or the form's): both also have Work Mode and Source selects (R4-JOB-02).
const optionsOf = (dom, view) => {
  const picker = [...dom.elements(view.container)].find((el) => el.tagName === 'SELECT'
    && (el.getAttribute('aria-label') === 'Resume used' || (el.getAttribute('id') || '').endsWith('resumeId')));
  return [...dom.elements(picker)].filter((el) => el.tagName === 'OPTION').map((el) => el.textContent);
};

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

it('R2-135: the Overview tab\'s Resume Used lists the résumés, never a cover letter', async () => {
  const dom = await import('./fake-dom.mjs');
  const { OverviewTab } = await loadModule('/src/components/job/OverviewTab.jsx');
  const view = dom.mount(OverviewTab, { job, set: () => {}, resumes: RESUMES, navigate: () => {} });
  try {
    assert.deepEqual(optionsOf(dom, view), ['— Not linked yet —', 'Frontend CV', 'Backend CV']);
  } finally {
    await view.unmount();
  }
});

it('R2-135: a job already linked to a letter still shows that link, alone of the letters, and Open opens it on its letter\'s tab', async () => {
  const dom = await import('./fake-dom.mjs');
  const { OverviewTab } = await loadModule('/src/components/job/OverviewTab.jsx');
  const went = [];
  const view = dom.mount(OverviewTab, { job: { ...job, resumeId: 'l1' }, set: () => {}, resumes: RESUMES, navigate: (to) => went.push(to) });
  try {
    assert.deepEqual(optionsOf(dom, view), ['— Not linked yet —', 'Frontend CV', 'Cover Letter', 'Backend CV'], 'not "Résumé deleted"');
    const open = [...dom.elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Open resume');
    assert.ok(open, 'a linked letter opens');
    view.act(() => dom.reactProps(open).onClick({ stopPropagation() {}, preventDefault() {} }));
    assert.deepEqual(went, ['/resume/l1?tab=coverletter']);
  } finally {
    await view.unmount();
  }
});

it('R2-135: the job form\'s Resume Used lists the résumés, never a cover letter', async () => {
  const dom = await import('./fake-dom.mjs');
  const { createElement: h } = await import('react');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = new MemoryStorage();
  _resetJobStoreForTest();
  function App() {
    return h(MemoryRouter, { initialEntries: ['/jobs/new'] }, h(Routes, null,
      h(Route, { path: '/jobs/new', element: h(JobForm, { store: { appState: { resumes: RESUMES } } }) })));
  }
  const view = dom.mount(App);
  try {
    assert.deepEqual(optionsOf(dom, view).filter((t) => /CV|letter/i.test(t)), ['Frontend CV', 'Backend CV']);
  } finally {
    await view.unmount();
    delete globalThis.localStorage;
  }
});
