// Unit tests for making a saved or imported job readable (src/utils/normalizeJob.js, R4-7).
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeJob, readJob, isJobEntry } from '../../src/utils/normalizeJob.js';

const job = (extra = {}) => ({
  id: 'job_1', company: 'Acme', role: 'Dev', status: 'applied', url: '', location: 'Remote', salary: '',
  contact: '', resumeId: '', notes: '<p>Hi</p>', appliedDate: '2026-09-01', deadline: '',
  todos: [{ id: 't1', text: 'Call back', done: true }],
  statusHistory: [{ status: 'applied', changedAt: 1757000000000 }],
  createdAt: 1757000000000, updatedAt: 1757000000000,
  ...extra,
});

test('a readable job comes back as the same object, untouched — missing fields stay missing', () => {
  const j = job();
  assert.equal(normalizeJob(j), j);
  const sparse = { id: 'job_2', company: 'Beta', status: 'saved' }; // an old or hand-made entry
  assert.equal(normalizeJob(sparse), sparse);
  const withNulls = job({ contact: null, todos: null, statusHistory: null });
  assert.equal(normalizeJob(withNulls), withNulls, 'null reads as empty everywhere already');
});

test('only an object that is not a list is a job', () => {
  for (const v of [null, undefined, 'junk', 5, true, [], [job()]]) {
    assert.equal(normalizeJob(v), null, JSON.stringify(v));
    assert.equal(isJobEntry(v), false);
  }
  assert.equal(isJobEntry({}), true);
});

test('to-dos: a list of readable to-dos is kept; anything else is left out (the tracker threw on todos: [null])', () => {
  const t1 = { id: 't1', text: 'Call back', done: true };
  assert.deepEqual(normalizeJob(job({ todos: [null, t1, 'x', [1], { id: 't2', text: { b: 1 } }] })).todos, [t1]);
  assert.deepEqual(normalizeJob(job({ todos: 'x' })).todos, []);
  assert.deepEqual(normalizeJob(job({ todos: { 0: t1 } })).todos, []);
  assert.deepEqual(normalizeJob(job({ todos: [{ id: 't3', text: 42 }] })).todos, [{ id: 't3', text: '42' }]);
});

test('status history: not a list is removed; entries without a status are left out', () => {
  assert.equal('statusHistory' in normalizeJob(job({ statusHistory: 'applied' })), false);
  const h = { status: 'interview', changedAt: 2 };
  assert.deepEqual(normalizeJob(job({ statusHistory: [null, h, { status: { x: 1 } }, 7] })).statusHistory, [h]);
});

test('text fields: a number becomes its digits, anything else that is not text becomes empty', () => {
  const fixed = normalizeJob(job({ company: 3, role: { title: 'x' }, contact: ['a'], salary: true, deadline: {} }));
  assert.deepEqual(
    [fixed.company, fixed.role, fixed.contact, fixed.salary, fixed.deadline],
    ['3', '', '', '', ''],
  );
  assert.equal(normalizeJob(job({ status: { id: 'offer' } })).status, 'saved');
  assert.equal(normalizeJob(job({ status: '' })).status, 'saved');
  assert.equal(normalizeJob(job({ status: 'offer' })).status, 'offer');
});

test('readJob: a repair that keeps what the job held loses nothing — numbers as their digits, an empty status (VM4-5)', () => {
  // Older builds' import saved jobs as they came (salary: 120000), and those displayed fine.
  const { kept, lost } = readJob(job({ salary: 120000, appliedDate: 20260901, todos: [{ id: 't1', text: 42 }], status: '' }));
  assert.equal(lost, false);
  assert.deepEqual([kept.salary, kept.appliedDate, kept.todos[0].text, kept.status], ['120000', '20260901', '42', 'saved']);
  assert.deepEqual(readJob(job({ status: null })), { kept: job({ status: 'saved' }), lost: false });
  const readable = job();
  assert.equal(readJob(readable).kept, readable);
  assert.equal(readJob(readable).lost, false);
  assert.deepEqual(readJob(null), { kept: null, lost: false }, 'an empty slot held nothing');
});

test('readJob: anything left out or blanked is a loss', () => {
  for (const extra of [
    { company: { name: 'Acme' } }, { salary: true }, { role: ['Dev'] }, { deadline: {} },
    { status: 3 }, { status: { id: 'offer' } },
    { todos: 'x' }, { todos: [null] }, { todos: [{ id: 't', text: { b: 1 } }] },
    { statusHistory: 'applied' }, { statusHistory: [{ changedAt: 1 }] },
  ]) assert.equal(readJob(job(extra)).lost, true, JSON.stringify(extra));
  for (const v of ['junk', 5, true, [], [job()]]) assert.deepEqual(readJob(v), { kept: null, lost: true }, JSON.stringify(v));
  // A lossless repair beside a lossy one: still a loss.
  assert.equal(readJob(job({ salary: 120000, todos: [null] })).lost, true);
});

test('the input is never changed: a repaired job is a copy', () => {
  const bad = job({ todos: [null], statusHistory: 'x', company: 5 });
  const before = JSON.stringify(bad);
  const fixed = normalizeJob(bad);
  assert.notEqual(fixed, bad);
  assert.equal(JSON.stringify(bad), before);
  assert.deepEqual({ ...fixed, todos: [null], statusHistory: 'x', company: 5 }, bad, 'nothing else differs');
});
