// R5-HUNT1-summary-followups-unsorted-truncated: the Job Summary's "Follow-ups due" card listed the
// first six due jobs in board order, unsorted, and hid the rest without a word, so with eight due
// the two most overdue could be the ones missing. Now the most overdue come first, as the deadlines
// card sorts by date, and a line says how many more are due.
// On the real JobSummary (tests/pdf/fake-dom.mjs, loaded through Vite). Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, dayFromToday, render } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const kids = (el) => el.childNodes.filter((n) => n.nodeType === 1);

// Job 1 is due yesterday … job 8 three weeks ago, added in that order.
const ago = [1, 2, 3, 5, 8, 12, 17, 21];
const jobs = ago.map((d, i) => ({ ...acme, id: `j${i + 1}`, company: `Co ${i + 1}`, followUpDate: dayFromToday(-d) }));

async function followUpCard(list) {
  const { JobSummary } = await loadModule('/src/components/job/JobSummary.jsx');
  const page = await render(JobSummary, { jobs: list, onOpen: () => {} });
  const card = page.all().find((el) => el.tagName === 'SECTION' && el.firstChild?.firstChild?.textContent === 'Follow-ups due');
  assert.ok(card, 'the Follow-ups due card');
  const ul = kids(card).find((el) => el.tagName === 'UL');
  const companies = kids(ul).map((li) => li.textContent.match(/Co \d/)[0]);
  return { page, card, companies };
}

it('R5-HUNT1: the most overdue follow-ups come first, and the hidden ones are counted', async () => {
  const { page, card, companies } = await followUpCard(jobs);
  try {
    assert.deepEqual(companies, ['Co 8', 'Co 7', 'Co 6', 'Co 5', 'Co 4', 'Co 3'], 'oldest follow-up date first');
    assert.match(card.textContent, /\+2 more follow-ups due/);
  } finally {
    await page.view.unmount();
  }
});

it('R5-HUNT1: six or fewer due follow-ups add no "more" line', async () => {
  const { page, card, companies } = await followUpCard(jobs.slice(0, 6));
  try {
    assert.equal(companies.length, 6);
    assert.doesNotMatch(card.textContent, /more follow-up/);
  } finally {
    await page.view.unmount();
  }
});
