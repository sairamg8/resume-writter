// R4-JOB-02: nothing in the app could set a job's follow-up date, work mode or source — the job
// page's Details box and the Summary's "Follow-ups due" read them, but only an imported file ever
// filled them, and the one date the form and the Overview called "Deadline / Follow-up" wrote the
// deadline. The form and the Overview now edit all three (the date is "Deadline" alone), and a
// follow-up set there lists the job under "Follow-ups due" once its day comes. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, atRoute, dayFromToday, render, storedJobs } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

it('the job form sets the follow-up date, work mode and source, and the job is then a follow-up due', async () => {
  const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
  const { JobSummary } = await loadModule('/src/components/job/JobSummary.jsx');
  const page = await atRoute('/jobs/a/edit', {
    '/jobs/:id/edit': h(JobForm, { store: { appState: { resumes: [] } } }),
    '/jobs/:id': h('p', null, 'DETAIL'),
  }, [acme]);
  try {
    const control = (field) => page.all().find((el) => ['INPUT', 'SELECT'].includes(el.tagName) && (el.getAttribute('id') || '').endsWith(field));
    const label = (field) => page.all().find((el) => el.tagName === 'LABEL' && el.getAttribute('for') === control(field)?.getAttribute('id'))?.textContent;
    assert.equal(label('deadline'), 'Deadline', 'the deadline is called what it is');
    for (const field of ['followUpDate', 'workMode', 'source']) assert.ok(control(field), `the form has a ${field} control`);
    const today = dayFromToday(0);
    page.fire(control('followUpDate'), 'onChange', { target: { value: today } });
    page.fire(control('workMode'), 'onChange', { target: { value: 'hybrid' } });
    page.fire(control('source'), 'onChange', { target: { value: 'referral' } });
    const form = page.all().find((el) => el.tagName === 'FORM');
    page.fire(form, 'onSubmit');
    const [job] = storedJobs();
    assert.equal(job.followUpDate, today);
    assert.equal(job.workMode, 'hybrid');
    assert.equal(job.source, 'referral');
    assert.equal(job.deadline, '', 'the deadline is untouched');

    const summary = await render(JobSummary, { jobs: [job], onOpen: () => {} });
    try {
      assert.match(summary.text(), /Follow-ups due.*Acme/s, 'the job is listed as a follow-up due');
      assert.doesNotMatch(summary.text(), /Nothing to chase today/);
    } finally { await summary.view.unmount(); }
  } finally {
    await page.view.unmount();
    delete globalThis.localStorage;
  }
});

it('the Overview tab edits the follow-up date, work mode and source', async () => {
  const { OverviewTab } = await loadModule('/src/components/job/OverviewTab.jsx');
  const edits = [];
  const page = await render(OverviewTab, { job: acme, set: (k, v) => edits.push([k, v]), resumes: [], navigate: () => {} });
  try {
    const labelled = (name) => page.all().find((el) => el.getAttribute('aria-label') === name);
    assert.ok(labelled('Deadline'), 'the deadline input is called what it is');
    page.fire(labelled('Work Mode'), 'onChange', { target: { value: 'remote' } });
    page.fire(labelled('Source'), 'onChange', { target: { value: 'linkedin' } });
    // The follow-up date is a Field: its pencil opens a date input that saves on Enter.
    const title = page.all().find((el) => el.tagName === 'P' && el.textContent === 'Follow-up Date');
    assert.ok(title, 'a Follow-up Date field');
    const pencil = [...title.parentNode.childNodes].flatMap((n) => [n, ...(n.childNodes || [])]).find((el) => el.tagName === 'BUTTON');
    page.fire(pencil, 'onClick');
    const input = labelled('Follow-up Date');
    assert.equal(page.props(input).type, 'date');
    page.fire(input, 'onChange', { target: { value: '2026-10-01' } });
    page.fire(labelled('Follow-up Date'), 'onKeyDown', { key: 'Enter', nativeEvent: {} });
    assert.deepEqual(edits, [['workMode', 'remote'], ['source', 'linkedin'], ['followUpDate', '2026-10-01']]);
  } finally {
    await page.view.unmount();
  }
});
