// Job-seeker journey (cycle 7): the Job Summary's "Upcoming deadlines" card showed the first six open jobs with
// a deadline ahead and hid the rest without a word, while "Follow-ups due" beside it says how many more there
// are (R5-HUNT1). With eight deadlines ahead the user read six and never learned of the other two. The card now
// ends with "+N more deadlines ahead" when jobs are left out, and adds nothing when all of them are listed.
// On the real JobSummary (tests/pdf/fake-dom.mjs, loaded through Vite). Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, dayFromToday, render } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const kids = (el) => el.childNodes.filter((n) => n.nodeType === 1);

// Job 1's deadline is tomorrow … job 8's is eight days off, added in that order.
const jobs = [1, 2, 3, 4, 5, 6, 7, 8].map((d, i) => ({ ...acme, id: `j${i + 1}`, company: `Co ${i + 1}`, deadline: dayFromToday(d) }));

async function deadlineCard(list) {
  const { JobSummary } = await loadModule('/src/components/job/JobSummary.jsx');
  const page = await render(JobSummary, { jobs: list, onOpen: () => {} });
  const card = page.all().find((el) => el.tagName === 'SECTION' && el.firstChild?.firstChild?.textContent === 'Upcoming deadlines');
  assert.ok(card, 'the Upcoming deadlines card');
  const ul = kids(card).find((el) => el.tagName === 'UL');
  const companies = kids(ul).map((li) => li.textContent.match(/Co \d/)[0]);
  return { page, card, companies };
}

it('with eight deadlines ahead the card lists the nearest six and says two more are ahead', async () => {
  const { page, card, companies } = await deadlineCard(jobs);
  try {
    assert.deepEqual(companies, ['Co 1', 'Co 2', 'Co 3', 'Co 4', 'Co 5', 'Co 6'], 'the nearest first');
    assert.match(card.textContent, /\+2 more deadlines ahead/);
  } finally {
    await page.view.unmount();
  }
});

it('with seven the line is singular, and with six or fewer there is no "more" line', async () => {
  const seven = await deadlineCard(jobs.slice(0, 7));
  try {
    assert.match(seven.card.textContent, /\+1 more deadline ahead/);
    assert.doesNotMatch(seven.card.textContent, /deadlines ahead/);
  } finally {
    await seven.page.view.unmount();
  }
  const six = await deadlineCard(jobs.slice(0, 6));
  try {
    assert.equal(six.companies.length, 6);
    assert.doesNotMatch(six.card.textContent, /more deadline/);
  } finally {
    await six.page.view.unmount();
  }
});
