// Unit tests for the tracker's pure reads (src/utils/jobQuery.js): search and status filters, sorting
// (J-18: the list view sorted every column as text), the KPI stats and the funnel. Every date is
// relative to one fixed `now`. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterJobs, sortJobs, salaryValue, jobStats, daysSince, funnelCounts, isFollowUpDue, isOpen,
} from '../../src/utils/jobQuery.js';
import { JOB_STATUSES } from '../../src/constants/jobs.js';

/** Tuesday 2026-09-22, 15:00 local time. */
const NOW = new Date(2026, 8, 22, 15, 0, 0);
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

let seq = 0;
const job = (extra = {}) => {
  seq += 1;
  return { id: `j${seq}`, company: `Co ${seq}`, role: 'Dev', status: 'applied', todos: [], statusHistory: [], ...extra };
};
const companies = (jobs) => jobs.map((j) => j.company);

// ── filterJobs ───────────────────────────────────────────────────────────────────────────────

test('filterJobs: every word of the search in company, role, location, contact, stage or salary — any case, accents aside', () => {
  const jobs = [
    job({ company: 'Stripe', role: 'Backend Engineer', location: 'Zürich' }),
    job({ company: 'Google', role: 'Frontend Engineer', location: 'Remote' }),
    job({ company: 'Notion', role: 'Designer', contact: 'Ana (recruiter)', stage: 'HR Round' }),
  ];
  assert.deepEqual(companies(filterJobs(jobs, { q: 'engineer' })), ['Stripe', 'Google']);
  assert.deepEqual(companies(filterJobs(jobs, { q: 'zurich backend' })), ['Stripe'], 'every word, anywhere');
  assert.deepEqual(companies(filterJobs(jobs, { q: 'ENGINEER remote' })), ['Google']);
  assert.deepEqual(companies(filterJobs(jobs, { q: 'recruiter' })), ['Notion']);
  assert.deepEqual(companies(filterJobs(jobs, { q: 'hr round' })), ['Notion']);
  assert.deepEqual(filterJobs(jobs, { q: 'zzz' }), []);
  assert.equal(filterJobs(jobs, { q: '   ' }), jobs, 'nothing to filter: the same array');
  assert.equal(filterJobs(jobs), jobs);
});

test('filterJobs: statuses (an array or a Set), combined with the search', () => {
  const jobs = [job({ company: 'A', status: 'saved' }), job({ company: 'B', status: 'interview' }), job({ company: 'C', status: 'offer' })];
  assert.deepEqual(companies(filterJobs(jobs, { statuses: ['interview', 'offer'] })), ['B', 'C']);
  assert.deepEqual(companies(filterJobs(jobs, { statuses: new Set(['saved']) })), ['A']);
  assert.deepEqual(companies(filterJobs(jobs, { statuses: ['offer'], q: 'b' })), []);
});

test('filterJobs / isFollowUpDue: a follow-up is due on or before today, for open jobs only', () => {
  const jobs = [
    job({ company: 'Today', followUpDate: '2026-09-22' }),
    job({ company: 'Late', followUpDate: '2026-09-01', status: 'interview' }),
    job({ company: 'Soon', followUpDate: '2026-09-23' }),
    job({ company: 'Closed', followUpDate: '2026-09-01', status: 'rejected' }),
    job({ company: 'OnHold', followUpDate: '2026-09-01', status: 'on_hold' }),
    job({ company: 'Junk', followUpDate: 'next week' }),
    job({ company: 'None' }),
  ];
  assert.deepEqual(companies(filterJobs(jobs, { followUpDue: true, now: NOW })), ['Today', 'Late']);
  assert.equal(isFollowUpDue(jobs[0], NOW), true);
  assert.equal(isOpen({ status: 'offer' }), true);
  assert.equal(isOpen({ status: 'on_hold' }), false);
});

// ── sortJobs (J-18) ──────────────────────────────────────────────────────────────────────────

test('J-18: status sorts in pipeline order, then the closed statuses — not by the id\'s spelling', () => {
  const ids = JOB_STATUSES.map((s) => s.id);
  const jobs = [...ids].reverse().map((status) => job({ status, company: status }));
  assert.deepEqual(sortJobs(jobs, 'status', 'asc').map((j) => j.status), ids);
  assert.deepEqual(sortJobs(jobs, 'status', 'desc').map((j) => j.status), [...ids].reverse());
});

test('J-18: salary sorts by its first amount — $90k < $120,000 < $180k – $250k < ₹30 LPA; none is last', () => {
  const jobs = [
    job({ company: 'lpa', salary: '₹30 LPA' }), job({ company: 'blank', salary: '' }), job({ company: '180', salary: '$180k – $250k' }),
    job({ company: 'text', salary: 'Competitive' }), job({ company: '90', salary: '$90k' }), job({ company: '120', salary: '$120,000' }),
  ];
  assert.deepEqual(companies(sortJobs(jobs, 'salary', 'asc')), ['90', '120', '180', 'lpa', 'blank', 'text']);
  assert.deepEqual(companies(sortJobs(jobs, 'salary', 'desc')), ['lpa', '180', '120', '90', 'blank', 'text']);
  assert.deepEqual(
    ['$90k', '$120,000', '€65.5k', '1.2m', '₹12 lakhs', '2 Cr', '5 months notice', 'n/a'].map(salaryValue),
    [90000, 120000, 65500, 1200000, 1200000, 20000000, 5, null],
  );
});

test('J-18: dates sort as dates, and a blank date is last in both directions', () => {
  const jobs = [job({ company: 'none', deadline: '' }), job({ company: 'oct', deadline: '2026-10-01' }), job({ company: 'junk', deadline: 'soon' }), job({ company: 'sep', deadline: '2026-09-30' })];
  assert.deepEqual(companies(sortJobs(jobs, 'deadline', 'asc')), ['sep', 'oct', 'none', 'junk']);
  assert.deepEqual(companies(sortJobs(jobs, 'deadline', 'desc')), ['oct', 'sep', 'none', 'junk']);
});

test('J-18: text sorts by the letters (case and accents aside, numbers as numbers); blanks last; ties keep the board\'s order', () => {
  const jobs = [job({ company: 'beta' }), job({ company: '' }), job({ company: 'Alpha' }), job({ company: 'Éclair' }), job({ company: 'alpha', role: 'second' })];
  assert.deepEqual(companies(sortJobs(jobs, 'company', 'asc')), ['Alpha', 'alpha', 'beta', 'Éclair', '']);
  assert.deepEqual(companies(sortJobs(jobs, 'company', 'desc')), ['Éclair', 'beta', 'Alpha', 'alpha', ''], 'equal names keep their order in both directions');
  const rounds = [job({ stage: 'Round 10' }), job({ stage: 'Round 2' })];
  assert.deepEqual(sortJobs(rounds, 'stage', 'asc').map((j) => j.stage), ['Round 2', 'Round 10']);
});

test('J-18: updatedAt (the default order) is newest first; rank is the list\'s own order; the input is never changed', () => {
  const jobs = [job({ company: 'old', updatedAt: 1 }), job({ company: 'new', updatedAt: 3 }), job({ company: 'mid', updatedAt: 2 }), job({ company: 'never' })];
  const before = companies(jobs);
  assert.deepEqual(companies(sortJobs(jobs)), ['new', 'mid', 'old', 'never']);
  assert.deepEqual(companies(sortJobs(jobs, 'rank', 'asc')), before);
  assert.deepEqual(companies(sortJobs(jobs, 'rank', 'desc')), [...before].reverse());
  assert.deepEqual(companies(jobs), before);
  assert.notEqual(sortJobs(jobs, 'rank', 'asc'), jobs, 'always a copy');
});

// ── daysSince ────────────────────────────────────────────────────────────────────────────────

test('daysSince: whole local calendar days to now — a date, a time, the future, junk', () => {
  assert.equal(daysSince('2026-09-22', NOW), 0);
  assert.equal(daysSince('2026-09-17', NOW), 5);
  assert.equal(daysSince('2026-09-24', NOW), -2);
  assert.equal(daysSince('2025-09-22', NOW), 365);
  assert.equal(daysSince(at(2026, 9, 21, 23), NOW), 1, 'yesterday late evening is 1 day, not 0');
  assert.equal(daysSince(at(2026, 3, 1), NOW), 205, 'across a daylight-saving change');
  for (const v of ['', 'yesterday', null, undefined, NaN, '2026-9-1']) assert.equal(daysSince(v, NOW), null, String(v));
});

// ── jobStats ─────────────────────────────────────────────────────────────────────────────────

const h = (...statuses) => statuses.map((status, i) => ({ status, changedAt: at(2026, 9, 1 + i) }));

test('jobStats: total, active, interviewing, offers and the closed counts, per the spec\'s definitions', () => {
  const jobs = ['saved', 'applied', 'phone_screen', 'interview', 'offer', 'on_hold', 'rejected', 'withdrawn', 'interview']
    .map((status) => job({ status, statusHistory: h(status) }));
  const s = jobStats(jobs, NOW);
  assert.deepEqual(
    [s.total, s.active, s.interviewing, s.offers, s.onHold, s.rejected, s.withdrawn],
    [9, 5, 3, 1, 1, 1, 1],
  );
});

test('jobStats: response rate — of jobs that reached applied, the share that later heard back', () => {
  const jobs = [
    job({ status: 'applied', statusHistory: h('saved', 'applied') }), // applied, no answer yet
    job({ status: 'rejected', statusHistory: h('applied', 'rejected') }), // a rejection is an answer
    job({ status: 'interview', statusHistory: h('saved', 'applied', 'phone_screen', 'interview') }),
    job({ status: 'withdrawn', statusHistory: h('applied', 'withdrawn') }), // withdrew before an answer
    job({ status: 'rejected', statusHistory: h('saved', 'rejected') }), // never applied: not counted
    job({ status: 'saved', statusHistory: h('saved') }), // never applied
    job({ status: 'offer', statusHistory: [] }), // added at Offer: it applied, and heard back
    job({ status: 'interview', statusHistory: h('applied') }), // history lags the status
  ];
  const s = jobStats(jobs, NOW);
  assert.deepEqual([s.applied, s.responded, s.responseRate], [6, 4, 67]);
  assert.equal(jobStats([], NOW).responseRate, null, 'nothing applied to: no rate, not 0%');
  assert.equal(jobStats([job({ status: 'saved' })], NOW).responseRate, null);
});

test('jobStats: follow-ups due counts open jobs due today or earlier', () => {
  const jobs = [
    job({ followUpDate: '2026-09-22' }), job({ followUpDate: '2026-09-10', status: 'offer' }),
    job({ followUpDate: '2026-09-23' }), job({ followUpDate: '2026-09-01', status: 'withdrawn' }),
  ];
  assert.equal(jobStats(jobs, NOW).followUpsDue, 2);
});

// ── funnelCounts ─────────────────────────────────────────────────────────────────────────────

test('funnelCounts: jobs that reached each step or a later one, with the conversion from the step before', () => {
  const jobs = [
    job({ status: 'applied', statusHistory: h('applied') }),
    job({ status: 'applied', statusHistory: h('saved', 'applied') }),
    job({ status: 'rejected', statusHistory: h('applied', 'phone_screen', 'rejected') }),
    job({ status: 'rejected', statusHistory: h('applied', 'phone_screen', 'interview', 'rejected') }),
    job({ status: 'offer', statusHistory: h('applied', 'interview', 'offer') }), // skipped the screen
    job({ status: 'saved', statusHistory: h('saved') }),
  ];
  assert.deepEqual(funnelCounts(jobs), [
    { id: 'applied', label: 'Applied', count: 5, rate: null },
    { id: 'phone_screen', label: 'Phone Screen', count: 3, rate: 60 },
    { id: 'interview', label: 'Interview', count: 2, rate: 67 },
    { id: 'offer', label: 'Offer', count: 1, rate: 50 },
  ]);
  assert.deepEqual(funnelCounts([]).map((f) => [f.count, f.rate]), [[0, null], [0, null], [0, null], [0, null]]);
});

// ── J-20: the history's "reopened" ───────────────────────────────────────────────────────────
import { historyLabels, linkedResume, visibleDone } from '../../src/utils/jobQuery.js';

test('J-20: a closed status is "reopened" only when a pipeline status follows it — On Hold then Rejected is not', () => {
  const entries = historyLabels([{ status: 'applied', changedAt: 1 }, { status: 'on_hold', changedAt: 2 }, { status: 'rejected', changedAt: 3 }]);
  assert.deepEqual(entries.map((e) => [e.status, e.reopened, e.current]), [['applied', false, false], ['on_hold', false, false], ['rejected', false, true]]);
  const back = historyLabels([{ status: 'rejected', changedAt: 1 }, { status: 'applied', changedAt: 2 }]);
  assert.deepEqual(back.map((e) => e.reopened), [true, false]);
  assert.deepEqual(historyLabels([{ status: 'on_hold' }, { status: 'interview' }]).map((e) => e.reopened), [true, false], 'on hold, resumed');
  assert.deepEqual(historyLabels([{ status: 'offer', changedAt: 5 }]).map((e) => [e.label, e.at, e.closed]), [['Offer', 5, false]]);
  assert.equal(historyLabels([{ status: 'saved', changedAt: 'yesterday' }])[0].at, null, 'no time: none printed, not "Invalid Date"');
  assert.deepEqual(historyLabels(undefined), []);
});

// ── J-21: a linked résumé that was deleted ───────────────────────────────────────────────────

test('J-21: linkedResume tells a deleted résumé from none', () => {
  const resumes = [{ id: 'r1', name: 'Frontend CV' }];
  assert.deepEqual(linkedResume({ resumeId: 'r1' }, resumes), { state: 'linked', resume: resumes[0] });
  assert.deepEqual(linkedResume({ resumeId: 'gone' }, resumes), { state: 'deleted', resume: null });
  assert.deepEqual(linkedResume({ resumeId: '' }, resumes), { state: 'none', resume: null });
  assert.deepEqual(linkedResume({}, undefined), { state: 'none', resume: null });
});

// ── J-27: the task just ticked stays in sight ────────────────────────────────────────────────

test('J-27: visibleDone lists completed tasks newest first, so the one just ticked is never behind "Show more"', () => {
  const todos = [
    ...[1, 2, 3, 4, 5].map((n) => ({ id: `t${n}`, text: `Task ${n}`, done: true })), // older builds: no completedAt
    { id: 't6', text: 'Task 6', done: false },
    { id: 't7', text: 'Task 7', done: true, completedAt: 200 },
    { id: 't8', text: 'Task 8', done: true, completedAt: 100 },
  ];
  assert.deepEqual(visibleDone(todos, 5).map((t) => t.id), ['t7', 't8', 't1', 't2', 't3']);
  assert.deepEqual(visibleDone(todos).map((t) => t.id), ['t7', 't8', 't1', 't2', 't3', 't4', 't5']);
  assert.deepEqual(visibleDone([]), []);
});

// ── A salary range with its unit after the second number ─────────────────────────────────────
// '$120-150k' read as 120 and '10-15 LPA' as 10: the unit applied only right after the first number,
// so a range written the usual way sorted as the lowest pay in the list.

test('a range with the unit once, at its end, is read in that unit', () => {
  assert.equal(salaryValue('$120-150k'), 120000);
  assert.equal(salaryValue('10-15 LPA'), 1000000);
  assert.equal(salaryValue('£45–55k'), 45000);
  assert.equal(salaryValue('$120k to $150k'), 120000);
  assert.equal(salaryValue('90 - 110K + bonus'), 90000);
  // A unit after the first number wins; a plain number and no amount are as before.
  assert.equal(salaryValue('1.5M-2M'), 1500000);
  assert.equal(salaryValue('$120,000'), 120000);
  assert.equal(salaryValue('Competitive'), null);
  const jobs = ['10-15 LPA', '8 LPA', '$120-150k', '$95k'].map((salary, n) => ({ id: String(n), salary }));
  assert.deepEqual(sortJobs(jobs, 'salary', 'desc').map((j) => j.salary), ['10-15 LPA', '8 LPA', '$120-150k', '$95k'], 'amounts, not currencies: 8 LPA is 800000');
});
