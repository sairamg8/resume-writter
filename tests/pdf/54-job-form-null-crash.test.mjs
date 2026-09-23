import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

describe('AUD-24: Jobs edit null crash and ErrorBoundary', () => {
  it('JobForm mounts safely when company or role is null (AUD-24)', async () => {
    const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
    const { mount, elements, reactProps } = await import('./fake-dom.mjs');

    // Job with company: null and role: null (from import or external backup)
    const nullJob = {
      id: 'job_null_1',
      company: null,
      role: null,
      location: null,
      salary: null,
      contact: null,
      url: null,
      notes: null,
      status: 'applied',
    };

    const mockStore = {
      appState: { resumes: [] },
    };

    // Mock useParams and useNavigate via react-router-dom or wrap in MemoryRouter
    const { MemoryRouter, Routes, Route } = await import('react-router-dom');
    const { createElement } = await import('react');

    let mountedWithoutError = false;
    let view;
    let savedStorage;

    try {
      class MockStorage {
        constructor() { this.store = new Map(); }
        getItem(k) { return this.store.get(k) ?? null; }
        setItem(k, v) { this.store.set(k, String(v)); }
        removeItem(k) { this.store.delete(k); }
        clear() { this.store.clear(); }
      }
      savedStorage = globalThis.localStorage;
      globalThis.localStorage = new MockStorage();

      const jobsKey = 'cpwtcv_jobs_v1';
      globalThis.localStorage.setItem(jobsKey, JSON.stringify({ jobs: [nullJob], dataVersion: 2 }));
      const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
      _resetJobStoreForTest();

      function TestApp() {
        return createElement(
          MemoryRouter,
          { initialEntries: ['/jobs/job_null_1/edit'] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: '/jobs/:id/edit',
              element: createElement(JobForm, { store: mockStore }),
            })
          )
        );
      }

      view = mount(TestApp);
      mountedWithoutError = true;

      const all = [...elements(view.container)];
      const heading = all.find((el) => el.tagName === 'H1' && el.textContent.includes('Edit Job Application'));
      assert.ok(heading, 'JobForm should render edit title without crashing');

      // The save button should be disabled because both company and role are empty/null
      const saveBtn = all.find((el) => el.tagName === 'BUTTON' && el.textContent.includes('Save Changes'));
      assert.ok(saveBtn, 'Save Changes button exists');
      assert.equal(reactProps(saveBtn).disabled, true, 'Save button should be disabled when company and role are empty');
    } finally {
      if (savedStorage) globalThis.localStorage = savedStorage;
      else delete globalThis.localStorage;
      view?.unmount?.();
    }

    assert.equal(mountedWithoutError, true, 'JobForm mounted without throwing');
  });

  it('ErrorBoundary renders fallback when a child component throws', async () => {
    const { ErrorBoundary } = await loadModule('/src/components/ErrorBoundary.jsx');
    const { mount, elements } = await import('./fake-dom.mjs');
    const { createElement } = await import('react');

    function Bomb() {
      throw new Error('Component boom explosion');
    }

    function TestApp() {
      return createElement(
        ErrorBoundary,
        null,
        createElement(Bomb, null)
      );
    }

    const view = mount(TestApp);
    try {
      const all = [...elements(view.container)];
      const errorTitle = all.find((el) => el.textContent.includes('Something went wrong'));
      assert.ok(errorTitle, 'ErrorBoundary should render "Something went wrong"');
    } finally {
      view.unmount();
    }
  });
});
