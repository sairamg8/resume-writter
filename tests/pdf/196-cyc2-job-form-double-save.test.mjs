// Navigation hunt (cycle 2): Add job on the job form, pressed twice. The form saves the job and then goes to the
// job's page; that page is a lazy route and the router commits a navigation in a transition, so the form (and its Add
// Job button) stays on screen and live until the page's code has arrived. A double-click on Add Job, or a second Enter in
// a field, ran the save twice and made two jobs; the same for "Save as a new job" on a job deleted in another tab. The
// new-résumé page and the Create project dialog guard against this (a `made` ref); the job form had no guard.
// The real JobForm over the real store (tests/pdf/fake-dom.mjs); the handler is called twice before any render, as two
// presses landing before the transition commits do.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { KEY, acme, atRoute, storedJobs } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const store = { appState: { resumes: [] } };
const probe = (name) => function Probe() { return h('p', null, name); };

async function formAt(path, jobs) {
  const dom = await import('./fake-dom.mjs');
  const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
  const page = await atRoute(path, {
    '/jobs/new': h(JobForm, { store }),
    '/jobs/:id/edit': h(JobForm, { store }),
    '/jobs/:id': h(probe('JOB PAGE')),
  }, jobs);
  const input = (field) => page.all().find((el) => el.tagName === 'INPUT' && (el.getAttribute('id') || '').endsWith(field));
  return {
    page,
    dom,
    type(field, value) { page.view.act(() => dom.reactProps(input(field)).onChange({ target: { value } })); },
    form: () => page.all().find((el) => el.tagName === 'FORM' && el.contains(input('company'))),
    button: (text) => page.all().find((el) => el.tagName === 'BUTTON' && el.textContent.includes(text)),
    async close() { await page.view.unmount(); delete globalThis.localStorage; },
  };
}

it('Add Job pressed twice before the page changes makes one job, not two', async () => {
  const f = await formAt('/jobs/new', []);
  try {
    f.type('company', 'Globex');
    const submit = f.dom.reactProps(f.form()).onSubmit;
    f.page.view.act(() => {
      submit({ preventDefault() {} });
      submit({ preventDefault() {} });
    });
    assert.deepEqual(storedJobs().map((j) => j.company), ['Globex'], 'one job was added');
  } finally {
    await f.close();
  }
});

it('"Save as a new job" (the job was deleted in another tab) pressed twice makes one job', async () => {
  const f = await formAt('/jobs/a/edit', [acme]);
  try {
    f.type('role', 'Senior Dev');
    // Another tab deletes the job while the form is open.
    const gone = JSON.stringify({ jobs: [], dataVersion: 2 });
    localStorage.setItem(KEY, gone);
    f.page.view.act(() => f.page.view.window.dispatchEvent({ type: 'storage', key: KEY, newValue: gone }));
    const save = f.dom.reactProps(f.button('Save as a new job')).onClick;
    f.page.view.act(() => {
      save({ preventDefault() {} });
      save({ preventDefault() {} });
    });
    assert.deepEqual(storedJobs().map((j) => j.role), ['Senior Dev'], 'one job was added');
  } finally {
    await f.close();
  }
});
