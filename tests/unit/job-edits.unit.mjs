// Unit tests for the pure writes on a job (src/utils/jobEdits.js): a new job's defaults and a status
// change (J-10), what the job form's save writes (J-02). Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as edits from '../../src/utils/jobEdits.js';

/** Tuesday 2026-09-22, 15:00 local time. */
const NOW = new Date(2026, 8, 22, 15, 0, 0);
const T = NOW.getTime();

const job = (extra = {}) => ({
  id: 'j1', company: 'Acme', role: 'Dev', status: 'saved', appliedDate: '', deadline: '', notes: '',
  todos: [{ id: 't1', text: 'Prep', done: false }],
  statusHistory: [{ status: 'saved', changedAt: 1000 }], createdAt: 1000, updatedAt: 1000, ...extra,
});

// ── J-10: the applied date follows the status ────────────────────────────────────────────────

test('J-10: a new Saved job has no applied date; a new job past Saved has today', () => {
  const { newJobDefaults } = edits;
  assert.equal(typeof newJobDefaults, 'function');
  assert.equal(newJobDefaults('saved', NOW).appliedDate, '');
  for (const s of ['applied', 'phone_screen', 'interview', 'offer']) assert.equal(newJobDefaults(s, NOW).appliedDate, '2026-09-22', s);
  for (const s of ['on_hold', 'rejected', 'withdrawn']) assert.equal(newJobDefaults(s, NOW).appliedDate, '', s);
  const d = newJobDefaults('saved', NOW);
  assert.deepEqual([d.followUpDate, d.source, d.workMode, d.excitement, d.interviews, d.todos], ['', '', '', 0, [], []]);
});

test('J-10: the first move past Saved with no applied date fills it with that day; a date already there stays', () => {
  const { applyStatusChange } = edits;
  const moved = applyStatusChange(job(), 'applied', T);
  assert.equal(moved.appliedDate, '2026-09-22');
  assert.equal(moved.status, 'applied');
  const kept = applyStatusChange(job({ appliedDate: '2026-09-01' }), 'interview', T);
  assert.equal(kept.appliedDate, '2026-09-01');
  assert.equal(applyStatusChange(job(), 'rejected', T).appliedDate, '', 'rejected from saved: never applied');
});

test('status history integrity: a change appends exactly one entry; the same status, or none of ours, changes nothing', () => {
  const { applyStatusChange } = edits;
  const j = job();
  const moved = applyStatusChange(j, 'interview', T);
  assert.deepEqual(moved.statusHistory, [{ status: 'saved', changedAt: 1000 }, { status: 'interview', changedAt: T }]);
  assert.equal(moved.updatedAt, T);
  assert.equal(j.statusHistory.length, 1, 'the input is never changed');
  assert.equal(applyStatusChange(j, 'saved', T), j, 'unchanged: the same job');
  assert.equal(applyStatusChange(j, 'ghosted', T), j, 'not a status: ignored');
  assert.equal(applyStatusChange(j, 'Phone Screen', T).status, 'phone_screen', 'a label names its id');
  // A job with no history starts one from its own status, then the change.
  const bare = applyStatusChange(job({ statusHistory: undefined }), 'applied', T);
  assert.deepEqual(bare.statusHistory.map((h) => h.status), ['saved', 'applied']);
});

// ── J-02: the form writes only what it edited ────────────────────────────────────────────────

test('J-02: formPatch returns the edited form fields only — never todos, history, id or an unedited status', () => {
  const { formPatch, jobFormValues } = edits;
  assert.equal(typeof formPatch, 'function');
  const start = jobFormValues(job({ status: 'applied' }), NOW);
  const form = { ...start, role: 'Senior Dev' };
  assert.deepEqual(formPatch(start, form), { role: 'Senior Dev' });
  assert.deepEqual(formPatch(start, { ...start }), {});
  assert.deepEqual(formPatch(start, { ...form, status: 'offer', notes: '<p>x</p>' }), { role: 'Senior Dev', status: 'offer', notes: '<p>x</p>' });
  // Even a form object that carries them (as the old one did) never writes them.
  const stale = { ...form, id: 'other', todos: [], statusHistory: [], createdAt: 1, updatedAt: 2 };
  assert.deepEqual(formPatch(start, stale), { role: 'Senior Dev' });
});

test('J-02: jobFormValues — a job\'s editable fields, blanks for the missing ones; a new job\'s defaults', () => {
  const { jobFormValues } = edits;
  const v = jobFormValues(job({ company: null, excitement: 3, source: 'referral' }), NOW);
  assert.equal(v.company, '');
  assert.equal(v.excitement, 3);
  assert.equal(v.source, 'referral');
  assert.equal(v.appliedDate, '', 'an existing job\'s blank date is not prefilled — it would look saved');
  assert.equal('todos' in v || 'statusHistory' in v || 'id' in v, false);
  const fresh = jobFormValues(null, NOW);
  assert.deepEqual([fresh.status, fresh.appliedDate, fresh.company], ['applied', '2026-09-22', '']);
});

test('J-10: on a new job\'s form the untouched applied date follows the status picked; a date the user chose stays', () => {
  const { jobFormValues, withFormStatus } = edits;
  const fresh = jobFormValues(null, NOW);
  const saved = withFormStatus(fresh, 'saved', { isNew: true, now: NOW });
  assert.equal(saved.appliedDate, '');
  assert.equal(withFormStatus(saved, 'interview', { isNew: true, now: NOW }).appliedDate, '2026-09-22');
  const chosen = { ...fresh, appliedDate: '2026-09-01' };
  assert.equal(withFormStatus(chosen, 'saved', { isNew: true, now: NOW }).appliedDate, '2026-09-01');
  const existing = jobFormValues(job({ status: 'applied', appliedDate: '2026-09-22' }), NOW);
  assert.equal(withFormStatus(existing, 'saved', { isNew: false, now: NOW }).appliedDate, '2026-09-22', 'an existing job\'s date is the user\'s');
});

test('applyEdits: fields merge, updatedAt moves, id / createdAt / history cannot be written, a status goes through applyStatusChange', () => {
  const { applyEdits } = edits;
  const j = job();
  const out = applyEdits(j, { role: 'Lead', id: 'x', createdAt: 5, statusHistory: [], updatedAt: 9, status: 'applied' }, T);
  assert.deepEqual([out.id, out.role, out.createdAt, out.updatedAt, out.status, out.appliedDate], ['j1', 'Lead', 1000, T, 'applied', '2026-09-22']);
  assert.deepEqual(out.statusHistory.map((h) => h.status), ['saved', 'applied']);
  assert.deepEqual(out.todos, j.todos, 'what the edit did not name is kept');
});

// ── J-26 · J-27: tasks ───────────────────────────────────────────────────────────────────────

test('J-26: a task whose text matches another — even a completed one — is added (recurring follow-ups)', () => {
  const { addTodo } = edits;
  const todos = [{ id: 't1', text: 'Send thank-you email', done: true }];
  const next = addTodo(todos, '  Send thank-you email ');
  assert.equal(next.length, 2);
  assert.deepEqual([next[1].text, next[1].done], ['Send thank-you email', false]);
  assert.notEqual(next[1].id, 't1');
  assert.equal(addTodo(todos, '   '), todos, 'nothing typed: the same list');
});

test('J-27: toggleTodo stamps completedAt when a task is ticked and clears it when unticked', () => {
  const { toggleTodo } = edits;
  const todos = [{ id: 'a', text: 'x', done: false }, { id: 'b', text: 'y', done: true, completedAt: 5 }];
  const ticked = toggleTodo(todos, 'a', T);
  assert.deepEqual(ticked[0], { id: 'a', text: 'x', done: true, completedAt: T });
  const unticked = toggleTodo(ticked, 'b', T);
  assert.deepEqual(unticked[1], { id: 'b', text: 'y', done: false });
  assert.equal(unticked[0], ticked[0], 'the other task is the same object');
});

// ── J-29: the demo job ───────────────────────────────────────────────────────────────────────
import { deadlineState, endOfLocalDay } from '../../src/utils/dates.js';

test('J-29: the demo job\'s dates agree with each other and with today — history after the applied day, a deadline ahead', () => {
  const { demoJobs } = edits;
  const [demo] = demoJobs(NOW);
  assert.equal(demo.id, 'demo_1', 'the id links and tests open it by');
  assert.equal(deadlineState(demo.deadline, NOW), null, 'not overdue on the first visit (nor "due soon")');
  const appliedStart = endOfLocalDay(demo.appliedDate).getTime() - 24 * 60 * 60 * 1000 + 1;
  const times = demo.statusHistory.map((h) => h.changedAt);
  for (const t of times) assert.ok(t >= appliedStart && t <= T, `${new Date(t).toISOString()} between the applied day and now`);
  assert.deepEqual(times, [...times].sort((a, b) => a - b), 'in order');
  assert.deepEqual(demo.statusHistory.map((h) => h.status), ['saved', 'applied', 'phone_screen', 'interview']);
  assert.equal(demo.createdAt, times[0]);
  assert.equal(demo.updatedAt, times.at(-1));
  assert.match(demo.notes, /^<p>/, 'notes in the editor\'s format (J-03)');
  const later = demoJobs(new Date(2027, 0, 5));
  assert.equal(deadlineState(later[0].deadline, new Date(2027, 0, 5)), null, 'relative to the day it is made');
});

// ── moveInList: the board's drag (array order is the rank) ───────────────────────────────────

test('moveInList: before another job, or last; a status change adds one history entry; nothing moved is the same array', () => {
  const { moveInList } = edits;
  const list = ['a', 'b', 'c', 'd'].map((id) => job({ id, company: id, status: 'applied', statusHistory: [{ status: 'applied', changedAt: 1 }] }));
  const ids = (l) => l.map((j) => j.id);
  assert.deepEqual(ids(moveInList(list, 'd', { beforeId: 'b' }, T)), ['a', 'd', 'b', 'c']);
  assert.deepEqual(ids(moveInList(list, 'a', { beforeId: 'd' }, T)), ['b', 'c', 'a', 'd']);
  assert.deepEqual(ids(moveInList(list, 'b', { beforeId: null }, T)), ['a', 'c', 'd', 'b'], 'no beforeId: last');
  assert.deepEqual(ids(moveInList(list, 'b', { beforeId: 'nope' }, T)), ['a', 'c', 'd', 'b'], 'an unknown beforeId: last');
  assert.equal(moveInList(list, 'b', { beforeId: 'c' }, T), list, 'already there: the same array');
  assert.equal(moveInList(list, 'd', {}, T), list, 'already last');
  assert.equal(moveInList(list, 'zzz', { status: 'offer' }, T), list, 'no such job');
  const moved = moveInList(list, 'c', { status: 'interview', beforeId: 'a' }, T);
  assert.deepEqual(ids(moved), ['c', 'a', 'b', 'd']);
  assert.deepEqual(moved[0].statusHistory.map((h) => h.status), ['applied', 'interview']);
  assert.equal(moved[0].updatedAt, T);
  const reordered = moveInList(list, 'c', { status: 'applied', beforeId: 'a' }, T);
  assert.equal(reordered[0], list[2], 'the same status: the job itself, untouched — a reorder is not an edit');
});

// ── An edit that changes nothing is not an edit ──────────────────────────────────────────────
// Clicking the job's current pipeline step, Save Changes with nothing changed, or a field's pencil
// opened and closed stamped `updatedAt` now: the job jumped to the top of the list's default
// "last updated" order, and a later backup import skipped it as older.

test('applyEdits returns the job itself when no value changes — no new updatedAt', () => {
  const job = { id: 'a', company: 'Acme', role: 'Dev', status: 'applied', todos: [{ id: 't', text: 'x', done: false }],
    statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1 };
  assert.equal(edits.applyEdits(job, {}, 999), job);
  assert.equal(edits.applyEdits(job, { status: 'applied' }, 999), job, 'the current status again');
  assert.equal(edits.applyEdits(job, { role: 'Dev', company: 'Acme' }, 999), job);
  assert.equal(edits.applyEdits(job, { id: 'other', updatedAt: 5 }, 999), job, 'keys an edit may not write change nothing');
  assert.equal(edits.applyEdits(job, { todos: job.todos }, 999), job);
  // A real change still counts, and stamps the time.
  assert.equal(edits.applyEdits(job, { role: 'Lead' }, 999).updatedAt, 999);
  assert.equal(edits.applyEdits(job, { todos: [...job.todos] }, 999).updatedAt, 999, 'a new to-do list is a write');
  assert.equal(edits.applyEdits(job, { location: '' }, 999).updatedAt, 999, 'a field the job lacked, set');
});
