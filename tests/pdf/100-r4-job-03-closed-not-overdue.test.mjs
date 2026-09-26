// R4-JOB-03: a Rejected, Withdrawn or On Hold job still showed its passed deadline as a red
// "overdue" pill on its board card and in its page's Details box, a red date in the list, and
// "Deadline has passed" on its Overview — while the Summary counts deadlines and follow-ups for open
// jobs only. A closed job has nothing to chase: its pills are neutral and no warning shows. An open
// job's passed deadline is still overdue. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, atRoute, dayFromToday, render } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

// Three days late: a pill reads "3d overdue" (one day late reads "Yesterday").
const yesterday = dayFromToday(-3);
const late = (status) => ({
  ...acme, status, deadline: yesterday, followUpDate: yesterday,
  statusHistory: [{ status: 'applied', changedAt: 1 }, { status, changedAt: 2 }],
});

describe('a closed job is never overdue', () => {
  for (const status of ['rejected', 'withdrawn', 'on_hold']) {
    it(`${status}: the board card, the Details box, the list and the Overview`, async () => {
      const job = late(status);
      const { KanbanView } = await loadModule('/src/components/job/KanbanView.jsx');
      const board = await render(KanbanView, { jobs: [job], updateJob() {}, onNavigate() {}, onDelete() {} });
      try {
        assert.match(board.text(), /Acme/);
        assert.doesNotMatch(board.text(), /overdue/, 'the card');
      } finally { await board.view.unmount(); }

      const { ListView } = await loadModule('/src/components/job/ListView.jsx');
      const list = await render(ListView, { jobs: [job], resumes: [], onNavigate() {}, onDelete() {} });
      try {
        const cell = list.all().find((el) => el.tagName === 'SPAN' && el.textContent === yesterday);
        assert.ok(cell, 'the deadline cell');
        assert.doesNotMatch(cell.getAttribute('class'), /red/, 'the list');
      } finally { await list.view.unmount(); }

      const { JobDetail } = await loadModule('/src/pages/JobDetail.jsx');
      const page = await atRoute('/jobs/a', { '/jobs/:id': h(JobDetail, { store: { appState: { resumes: [] } } }) }, [job]);
      try {
        const aside = page.all().find((el) => el.tagName === 'ASIDE');
        assert.doesNotMatch(aside.textContent, /overdue/, 'the Details box');
      } finally {
        await page.view.unmount();
        delete globalThis.localStorage;
      }

      const { OverviewTab } = await loadModule('/src/components/job/OverviewTab.jsx');
      const overview = await render(OverviewTab, { job, set() {}, resumes: [], navigate() {} });
      try {
        assert.doesNotMatch(overview.text(), /Deadline has passed/, 'the Overview');
      } finally { await overview.view.unmount(); }
    });
  }

  it('an open job with a passed deadline is still overdue everywhere', async () => {
    const job = late('applied');
    const { KanbanView } = await loadModule('/src/components/job/KanbanView.jsx');
    const board = await render(KanbanView, { jobs: [job], updateJob() {}, onNavigate() {}, onDelete() {} });
    try { assert.match(board.text(), /3d overdue/); } finally { await board.view.unmount(); }
    const { OverviewTab } = await loadModule('/src/components/job/OverviewTab.jsx');
    const overview = await render(OverviewTab, { job, set() {}, resumes: [], navigate() {} });
    try { assert.match(overview.text(), /Deadline has passed/); } finally { await overview.view.unmount(); }
  });
});
