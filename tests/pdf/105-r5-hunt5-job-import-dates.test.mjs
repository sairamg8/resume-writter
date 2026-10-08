// R5-HUNT5-JOB-IMPORT-NON-ISO-DATES-INVISIBLE: a saved or imported job with its days written as
// timestamps showed blank Applied, Deadline and Follow up rows in its page's Details box (not even
// "None"): the pill could not read them. The store now reads them as their days (completeJob), and
// a day no pill can read is shown as written. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, atRoute } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

/** The value a Details row shows, after its name. */
const rowText = (page, label) => {
  const name = page.all().find((el) => el.tagName === 'SPAN' && el.textContent === label
    && /grid-cols/.test(el.parentNode?.getAttribute?.('class') ?? ''));
  assert.ok(name, `the ${label} row`);
  return name.parentNode.textContent.slice(label.length);
};

describe('the Details box shows days written another way', () => {
  it('timestamps as their days; an unreadable day as written', async () => {
    const job = {
      ...acme, appliedDate: '2020-09-20T00:00:00.000Z', deadline: '2099-10-15T00:00:00.000Z', followUpDate: 'next week',
    };
    const { JobDetail } = await loadModule('/src/pages/JobDetail.jsx');
    const page = await atRoute('/jobs/a', { '/jobs/:id': h(JobDetail, { store: { appState: { resumes: [] } } }) }, [job]);
    try {
      assert.match(rowText(page, 'Applied'), /Sep 20, 2020/);
      assert.match(rowText(page, 'Deadline'), /Oct 15, 2099/);
      assert.equal(rowText(page, 'Follow up'), 'next week');
    } finally {
      await page.view.unmount();
      delete globalThis.localStorage;
    }
  });
});
