// R5-HUNT5-JOB-IMPORT-NON-ISO-DATES-INVISIBLE: an imported job whose days were written another way
// than 'YYYY-MM-DD' — a timestamp, as most tools write dates in JSON — kept them as written, and no
// job page could read them: the card printed the raw timestamp, the Details rows were blank, the
// Overview's picker was empty, a passed follow-up was never due. completeJob (every import, load
// and cloud copy) now makes a readable day 'YYYY-MM-DD' (jobDay); one it cannot read stays as is.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
// As a namespace: without the fix, jobDay is missing and only its own tests fail (not the whole file).
import * as normalizeJob from '../../src/utils/normalizeJob.js';
import { isFollowUpDue, sortJobs } from '../../src/utils/jobQuery.js';

const { completeJob, readJob } = normalizeJob;
const jobDay = (v) => normalizeJob.jobDay(v);

const imported = {
  company: 'Acme', role: 'Engineer', status: 'Applied',
  appliedDate: '2026-09-20T00:00:00.000Z', deadline: '2026-10-15T00:00:00.000Z', followUpDate: '2026-09-25T00:00:00.000Z',
};

test('an imported job with timestamps gets its days as YYYY-MM-DD, the day as written in any time zone', () => {
  const done = completeJob(readJob(imported).kept);
  assert.equal(done.appliedDate, '2026-09-20');
  assert.equal(done.deadline, '2026-10-15');
  assert.equal(done.followUpDate, '2026-09-25');
  assert.equal(readJob(imported).lost, false, 'nothing is reported lost');
});

test('a passed follow-up written as a timestamp is due', () => {
  const done = completeJob(readJob(imported).kept);
  assert.equal(isFollowUpDue(done, new Date(2026, 8, 29, 12)), true);
});

test('jobDay: other readable forms; a day already so, blank, or unreadable stays as it is', () => {
  assert.equal(jobDay('2026-10-15 09:30:00'), '2026-10-15');
  assert.equal(jobDay('2026-10-15T23:30:00-07:00'), '2026-10-15');
  assert.equal(jobDay(' 15 Jan 2026 '), '2026-01-15');
  for (const v of ['2026-10-15', '', 'next week', '10/15/2026', '2026-02-31T00:00:00Z', undefined, null]) {
    assert.equal(jobDay(v), v, String(v));
  }
});

test('a job whose days are already YYYY-MM-DD comes back as the same object', () => {
  const j = { id: 'job_1', status: 'applied', appliedDate: '2026-09-20', deadline: '', followUpDate: 'next week' };
  assert.equal(completeJob(j), j);
});

test('a day with spaces around it is the bare day: a passed follow-up is due, and sorts as a date', () => {
  const done = completeJob({ id: 'job_2', status: 'applied', followUpDate: ' 2026-09-25 ', appliedDate: '2026-09-20\n' });
  assert.equal(done.followUpDate, '2026-09-25');
  assert.equal(done.appliedDate, '2026-09-20');
  assert.equal(isFollowUpDue(done, new Date(2026, 8, 29, 12)), true);
  const blank = { id: 'job_3', status: 'applied', appliedDate: '' };
  assert.deepEqual(sortJobs([blank, done], 'appliedDate', 'asc').map((j) => j.id), ['job_2', 'job_3'], 'a date sorts before a blank');
});
