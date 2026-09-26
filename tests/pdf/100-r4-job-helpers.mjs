// Shared by the R4 Job Tracker tests (100-r4-job-*.test.mjs): the job page, the job form and the
// Overview tab on the real components (tests/pdf/fake-dom.mjs, loaded through Vite), over a
// localStorage holding fictional jobs.
import { loadModule } from './harness.mjs';

export const KEY = 'cpwtcv_jobs_v1';

export class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const pad = (n) => String(n).padStart(2, '0');
/** The local day `days` from today, as 'YYYY-MM-DD'. */
export function dayFromToday(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const acme = {
  id: 'a', company: 'Acme', role: 'Dev', status: 'applied', url: '', location: 'Remote', salary: '', contact: '',
  appliedDate: '2026-09-01', deadline: '', followUpDate: '', resumeId: '', notes: '', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1,
};

/** Mounts `component` with `props`: { view, all, text, props(el), fire(el, handler, event) }. */
export async function render(component, props) {
  const dom = await import('./fake-dom.mjs');
  const view = dom.mount(component, props);
  const all = () => [...dom.elements(view.container)];
  return {
    view, all,
    text: () => view.container.textContent,
    props: (el) => dom.reactProps(el),
    fire: (el, name, e = {}) => view.act(() => dom.reactProps(el)[name]({ preventDefault() {}, stopPropagation() {}, ...e })),
  };
}

/** `element` at `path` in a router over storage holding `jobs`; the store reads that storage afresh. */
export async function atRoute(path, routes, jobs) {
  const { createElement: h } = await import('react');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = new MemoryStorage();
  localStorage.setItem(KEY, JSON.stringify({ jobs, dataVersion: 2 }));
  _resetJobStoreForTest();
  function App() {
    return h(MemoryRouter, { initialEntries: [path] }, h(Routes, null,
      ...Object.entries(routes).map(([p, element]) => h(Route, { key: p, path: p, element }))));
  }
  return render(App, {});
}

export const storedJobs = () => JSON.parse(localStorage.getItem(KEY)).jobs;
