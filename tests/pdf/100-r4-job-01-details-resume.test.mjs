// R4-JOB-01: a job page's Details box read "Résumé: None" even with a résumé linked — it took
// linkedResume's `{ state, resume }` for the résumé itself, so `.name` was always undefined. It now
// names the linked résumé, says "Résumé deleted" for one deleted since (the J-21 rule), and "None"
// only when nothing is linked. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, atRoute } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

async function details(job, resumes) {
  const { JobDetail } = await loadModule('/src/pages/JobDetail.jsx');
  const page = await atRoute('/jobs/a', { '/jobs/:id': h(JobDetail, { store: { appState: { resumes } } }) }, [job]);
  const aside = page.all().find((el) => el.tagName === 'ASIDE' && el.getAttribute('aria-label') === 'Job details');
  const row = [...(await import('./fake-dom.mjs')).elements(aside)]
    .find((el) => el.tagName === 'DIV' && el.firstChild?.textContent === 'Résumé');
  const value = row?.lastChild?.textContent;
  await page.view.unmount();
  delete globalThis.localStorage;
  return value;
}

const resumes = [{ id: 'r1', name: 'Frontend CV' }, { id: 'r2', name: 'Backend CV' }];

it('a linked résumé is named in the Details box', async () => {
  assert.equal(await details({ ...acme, resumeId: 'r2' }, resumes), 'Backend CV');
});

it('a linked résumé deleted since reads "Résumé deleted"', async () => {
  assert.equal(await details({ ...acme, resumeId: 'gone' }, resumes), 'Résumé deleted');
});

it('no link reads "None"', async () => {
  assert.equal(await details({ ...acme, resumeId: '' }, resumes), 'None');
});
