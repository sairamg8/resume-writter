// R5-HUNT9-JOB-IMPORT-MONTH-FIRST-DATES: an imported job's day written month first ('Oct 15, 2026',
// 'October 15 2026') or as 'YYYY/MM/DD' / '2026-1-5' was kept as text: the card had no deadline pill,
// a passed follow-up was never due, the List sorted it as blank, and the Summary listed even a passed
// deadline under 'Upcoming deadlines' ('Jan 5, 2026' >= '2026-09-29' as text). completeJob now makes
// these days 'YYYY-MM-DD' (jobDay), and the Summary's upcoming list takes only a deadline it can
// compare (isDeadlineUpcoming).
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
// As namespaces: without the fix, isDeadlineUpcoming is missing and only its own test fails.
import * as normalizeJob from '../../src/utils/normalizeJob.js';
import * as jobQuery from '../../src/utils/jobQuery.js';

const { completeJob, readJob, jobDay } = normalizeJob;
const { isFollowUpDue, sortJobs } = jobQuery;
const NOW = new Date(2026, 8, 29, 12);

test('jobDay reads month-first days and YYYY/M/D days', () => {
  assert.equal(jobDay('Oct 15, 2026'), '2026-10-15');
  assert.equal(jobDay('October 15, 2026'), '2026-10-15');
  assert.equal(jobDay('October 15 2026'), '2026-10-15');
  assert.equal(jobDay('Sept. 1, 2026'), '2026-09-01');
  assert.equal(jobDay(' Jan 5, 2026 '), '2026-01-05');
  assert.equal(jobDay('2026/10/15'), '2026-10-15');
  assert.equal(jobDay('2026/1/5'), '2026-01-05');
  assert.equal(jobDay('2026-1-5'), '2026-01-05');
});

test('jobDay still leaves an unreadable or impossible day as it is', () => {
  for (const v of ['Feb 31, 2026', '2026/02/31', '2026/13/01', 'Foo 5, 2026', '10/15/2026', 'next week', '2026/10/15/1']) {
    assert.equal(jobDay(v), v, v);
  }
});

test('an imported job with month-first days is due, sorts as dated, and has ISO days', () => {
  const acme = completeJob(readJob({
    company: 'Acme', role: 'PM', status: 'applied',
    appliedDate: 'Sep 1, 2026', deadline: 'Jan 5, 2026', followUpDate: 'September 20, 2026',
  }).kept);
  const beta = completeJob(readJob({ company: 'Beta', role: 'Dev', status: 'applied', deadline: '2026/10/15' }).kept);
  assert.equal(acme.appliedDate, '2026-09-01');
  assert.equal(acme.deadline, '2026-01-05');
  assert.equal(acme.followUpDate, '2026-09-20');
  assert.equal(beta.deadline, '2026-10-15');
  assert.equal(isFollowUpDue(acme, NOW), true, 'a passed follow-up is due');
  const blank = { ...beta, id: 'blank', deadline: '' };
  assert.deepEqual(sortJobs([blank, beta, acme], 'deadline', 'asc').map((j) => j.company + (j.id === 'blank' ? '-blank' : '')),
    ['Acme', 'Beta', 'Beta-blank'], 'dated jobs sort before a blank one, by date');
});

test('a deadline that is not YYYY-MM-DD is not upcoming; a passed one is not either', () => {
  const job = (deadline, status = 'applied') => ({ id: deadline, status, deadline });
  const up = (j) => jobQuery.isDeadlineUpcoming(j, NOW);
  assert.equal(up(job('Jan 5, 2026')), false, "'Jan 5, 2026' is not compared as text");
  assert.equal(up(job('next week')), false);
  assert.equal(up(job('')), false);
  assert.equal(up(job('2026-01-05')), false, 'passed');
  assert.equal(up(job('2026-09-29')), true, 'today');
  assert.equal(up(job('2026-10-15')), true);
  assert.equal(up(job('2026-10-15', 'rejected')), false, 'a closed job');
});
