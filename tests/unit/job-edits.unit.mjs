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
