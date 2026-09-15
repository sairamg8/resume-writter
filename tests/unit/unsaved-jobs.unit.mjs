// Unit tests for the job list of a tab whose changes storage refused, when another tab saves its
// own (src/utils/unsavedJobs.js, R6-2). Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepUnsaved } from '../../src/utils/unsavedJobs.js';

const job = (id, company = id) => ({ id, company, status: 'saved' });
const ids = (jobs) => jobs.map((j) => j.id);

test('nothing unsaved here: the other tab\'s list, as it is', () => {
  const a = job('a'); const b = job('b');
  const stored = [a, b];
  const incoming = [job('a', 'A2'), job('c')];
  assert.equal(keepUnsaved(incoming, stored, stored), incoming);
  assert.equal(keepUnsaved(incoming, [a, b], [a, b]), incoming, 'a copy of the list with the same jobs');
});

test('a job added here that storage refused is kept, after the other tab\'s jobs', () => {
  const a = job('a');
  const stored = [a];
  const stripe = job('stripe');
  const incoming = [job('a'), job('other')];
  const out = keepUnsaved(incoming, [a, stripe], stored);
  assert.deepEqual(ids(out), ['a', 'other', 'stripe']);
  assert.equal(out[2], stripe);
  assert.equal(out[0], incoming[0], 'a job not changed here is the other tab\'s');
});

test('a job edited here keeps this tab\'s version in its place; one the other tab deleted comes back, at the end', () => {
  const a = job('a'); const b = job('b'); const c = job('c');
  const stored = [a, b, c];
  const aEdited = { ...a, role: 'Lead' };
  const cEdited = { ...c, role: 'QA' };
  const incoming = [job('a', 'A from the other tab'), job('b')]; // the other tab deleted c
  const out = keepUnsaved(incoming, [aEdited, b, cEdited], stored);
  assert.deepEqual(ids(out), ['a', 'b', 'c']);
  assert.equal(out[0], aEdited);
  assert.equal(out[1], incoming[1]);
  assert.equal(out[2], cEdited);
});

test('a job deleted here stays deleted, even when the other tab changed it; the other tab\'s deletes are taken', () => {
  const a = job('a'); const b = job('b'); const c = job('c');
  const stored = [a, b, c];
  const incoming = [job('a', 'A2'), job('b', 'B2'), job('d')]; // the other tab deleted c, added d
  const out = keepUnsaved(incoming, [a, c], stored); // this tab deleted b
  assert.deepEqual(ids(out), ['a', 'd']);
  assert.equal(out[0], incoming[0]);
});
