// Unit tests for importing a job file (src/utils/jobImport.js): reading the file (J-23: a read error
// said nothing), what the text holds, merging it into the list without duplicating what is already
// there (J-04), and the message the tracker shows. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readImportFile, jobsFromText, mergeImport, importMessage } from '../../src/utils/jobImport.js';

const job = (id, company, extra = {}) => ({
  id, company, role: 'Dev', status: 'applied', todos: [], statusHistory: [{ status: 'applied', changedAt: 1 }],
  createdAt: 1, updatedAt: 1, ...extra,
});

// ── J-23: the browser cannot read the file ───────────────────────────────────────────────────

/** A FileReader stand-in that ends the way `outcome` says: 'load', 'error', 'abort' or 'throw'. */
const fakeReader = (outcome, text = '[]') => class {
  readAsText() {
    if (outcome === 'throw') throw new Error('gone');
    queueMicrotask(() => {
      if (outcome === 'load') { this.result = text; this.onload?.({ target: this }); } else this[`on${outcome}`]?.({ target: this });
    });
  }
};

/** readImportFile as a promise of what it reported: ['text', …] or ['error', …]. */
const read = (outcome, text) => new Promise((resolve) => {
  readImportFile({}, { onText: (t) => resolve(['text', t]), onError: (e) => resolve(['error', e]) }, fakeReader(outcome, text));
});

test('J-23: a file the browser cannot read says so — error, abort, or a reader that throws', async () => {
  for (const outcome of ['error', 'abort', 'throw']) {
    assert.deepEqual(await read(outcome), ['error', 'Could not read that file.'], outcome);
  }
  assert.deepEqual(await read('load', '[{"company":"A"}]'), ['text', '[{"company":"A"}]']);
});

// ── what the text holds ──────────────────────────────────────────────────────────────────────

test('jobsFromText: a list, an export object, or one job; else a message', () => {
  assert.deepEqual(jobsFromText('[{"company":"A"}]'), { list: [{ company: 'A' }] });
  assert.deepEqual(jobsFromText('{"jobs":[{"company":"B"}],"dataVersion":2}'), { list: [{ company: 'B' }] });
  assert.deepEqual(jobsFromText('{"company":"C","role":"Dev"}'), { list: [{ company: 'C', role: 'Dev' }] });
  assert.match(jobsFromText('{ nope').error, /Could not parse/);
  for (const t of ['{}', '"text"', '42', 'null', '{"jobs":"x"}']) assert.match(jobsFromText(t).error, /No job applications/, t);
});

// ── J-04: merging ────────────────────────────────────────────────────────────────────────────

test('J-04: mergeImport skips what is here already, keeps free ids, replaces with newer copies only', () => {
  const here = [job('a', 'Acme', { updatedAt: 10 }), job('b', 'Beta', { updatedAt: 10 })];
  const r = mergeImport(here, [
    { ...here[0] }, // the same job: skipped
    job('b', 'Beta GmbH', { updatedAt: 30 }), // newer: replaces, in its place
    job('c', 'Gamma'), // a free id: kept
    job('c', 'Gamma'), // the file's own duplicate: skipped
    job('a', 'Acme (old)', { updatedAt: 3 }), // older: skipped
    { company: 'NoId' }, // no id: a new one
  ], 99);
  assert.deepEqual([r.added, r.updated, r.skipped, r.lossy], [2, 1, 3, false]);
  assert.deepEqual(r.jobs.map((j) => j.company), ['Acme', 'Beta GmbH', 'Gamma', 'NoId']);
  assert.deepEqual(r.jobs.slice(0, 3).map((j) => j.id), ['a', 'b', 'c']);
  assert.match(r.jobs[3].id, /^job_./);
  assert.equal(r.jobs[3].status, 'saved');
  assert.equal(r.jobs[3].updatedAt, 99, 'no time of its own: now');
  assert.equal(r.jobs[2].updatedAt, 1, 'its own time kept: importing it again is a no-op');
  assert.equal(here.length, 2, 'the input is never changed');
});

test('J-04: a job with an id already here, different, and no time to compare, is kept as a copy — nothing is dropped', () => {
  const here = [job('a', 'Acme')];
  const theirs = { id: 'a', company: 'Acme from elsewhere', status: 'offer' };
  const r = mergeImport(here, [theirs], 5);
  assert.deepEqual([r.added, r.updated, r.skipped], [1, 0, 0]);
  assert.equal(r.jobs[0], here[0]);
  assert.notEqual(r.jobs[1].id, 'a');
  assert.equal(r.jobs[1].company, 'Acme from elsewhere');
});

test('J-04: what could not be read is reported as lossy; entries that are not jobs are left out', () => {
  const r = mergeImport([], [null, 'x', job('a', 'A', { todos: [null] })], 5);
  assert.deepEqual([r.added, r.lossy], [1, true]);
  assert.deepEqual(r.jobs[0].todos, []);
});

test('J-04: importMessage — counts in a status message; nothing found is an error', () => {
  assert.deepEqual(importMessage({ added: 2, updated: 0, skipped: 0, lossy: false }),
    { kind: 'success', text: 'Imported 2 job applications.' });
  assert.deepEqual(importMessage({ added: 1, updated: 1, skipped: 3, lossy: false }),
    { kind: 'success', text: 'Imported 1 job application, updated 1, skipped 3 already in the tracker.' });
  assert.deepEqual(importMessage({ added: 0, updated: 0, skipped: 4, lossy: false }),
    { kind: 'success', text: 'Nothing new: the 4 job applications in that file are already in the tracker.' });
  assert.deepEqual(importMessage({ added: 1, updated: 0, skipped: 0, lossy: true }),
    { kind: 'warning', text: 'Imported 1 job application; what could not be read in the file was left out.' });
  assert.deepEqual(importMessage({ added: 0, updated: 2, skipped: 1, lossy: false }),
    { kind: 'success', text: 'Updated 2 job applications, skipped 1 already in the tracker.' });
  assert.equal(importMessage({ added: 0, updated: 0, skipped: 1 }).text, 'Nothing new: the job application in that file is already in the tracker.');
  assert.deepEqual(importMessage({ added: 0, updated: 0, skipped: 0, lossy: false }),
    { kind: 'error', text: 'No job applications found in that file.' });
});

// ── A file without times: re-importing it never duplicates ───────────────────────────────────
// A hand-made file, or one from another tool, has no createdAt / updatedAt. Each import stamped
// its jobs with that import's time, so the copy already here never compared equal, and every
// re-import added another copy of every job under a new id.

test('a job with no times in the file is skipped, not copied, when the file is imported again', () => {
  const file = [{ id: 'x1', company: 'Acme', role: 'Dev', status: 'applied', todos: [{ text: 'Call' }] }];
  const first = mergeImport([], file, 1000);
  assert.equal(first.added, 1);
  const second = mergeImport(first.jobs, file, 2000);
  const third = mergeImport(second.jobs, file, 3000);
  assert.deepEqual([second.added, second.updated, second.skipped], [0, 0, 1]);
  assert.deepEqual([third.added, third.updated, third.skipped], [0, 0, 1]);
  assert.deepEqual(third.jobs.map((j) => j.id), ['x1']);
  assert.equal(third.jobs[0].updatedAt, 1000, 'the job here is left as it was');
});

test('a changed job with no times in the file is still kept, as a copy: nothing is dropped', () => {
  const first = mergeImport([], [{ id: 'x1', company: 'Acme', role: 'Dev', status: 'applied' }], 1000);
  const changed = mergeImport(first.jobs, [{ id: 'x1', company: 'Acme', role: 'Lead', status: 'applied' }], 2000);
  assert.equal(changed.added, 1);
  assert.deepEqual(changed.jobs.map((j) => j.role), ['Dev', 'Lead']);
});
