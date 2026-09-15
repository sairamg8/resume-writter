// Unit tests for src/utils/oldSamples.js: which sample copy an old build flagged holds nothing the
// owner wrote (V2OWNER-DATA-8). Run: yarn test:unit. What the sync then does with each, through
// the engine and a fake Firestore: tests/pdf/18-cloud-sync-old-samples.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSampleId, isUntouchedSample, sampleFingerprint, UNTOUCHED } from '../../src/utils/oldSamples.js';
import { oldSampleCopies } from '../fixtures/oldSampleCopies.js';

/** `value` with every object's keys in reverse order: how another reader may hand them back. */
const reversed = (value) => (Array.isArray(value) ? value.map(reversed) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).reverse().map((k) => [k, reversed(value[k])])) : value);
const classic = () => oldSampleCopies().find((r) => r.id === 'demo_classic' && r.settings.itemGap === 8);

test('the baked fingerprints are exactly those of the copies the old builds stored — none missing, none extra', () => {
  const prints = {};
  for (const copy of oldSampleCopies()) (prints[copy.id] ||= []).push(sampleFingerprint(copy));
  assert.deepEqual(Object.keys(prints).toSorted(), Object.keys(UNTOUCHED).toSorted());
  for (const [id, list] of Object.entries(prints)) assert.deepEqual(list.toSorted(), UNTOUCHED[id].toSorted(), id);
  assert.equal(oldSampleCopies().length, 13);
});

test('every copy an old build stored is untouched, whatever the sync stamped on it and in whatever key order', () => {
  for (const copy of oldSampleCopies()) {
    assert.equal(isUntouchedSample(copy), true, `${copy.id} as stored`);
    const flagged = { ...copy, updatedAt: 1757858393000, dataVersion: 8, deleted: true, restoredAt: 5 };
    assert.equal(isUntouchedSample(reversed(flagged)), true, `${copy.id} flagged, stamped, keys reversed`);
  }
});

test('any edit is an edit: a word, a bullet, the name, a colour, the template, a section more or less, a mark', () => {
  const edits = {
    'personal name': (r) => { r.personal.name = 'Sairam'; },
    'a bullet': (r) => { r.sections[0].items[0].description += ' Led the team.'; },
    'the résumé name': (r) => { r.name = 'My CV'; },
    'a colour': (r) => { r.settings.accentColor = '#0f766e'; },
    'the template': (r) => { r.template = 'modern'; },
    'a section hidden': (r) => { r.sections[1].visible = false; },
    'a section removed': (r) => { r.sections.pop(); },
    'the letter': (r) => { r.coverLetter.body = '<p>Dear Sam,</p>'; },
    'a field added': (r) => { r.personal.github = 'github.com/me'; },
    'kept as an original': (r) => { r.keep = true; },
  };
  assert.equal(isUntouchedSample(classic()), true);
  for (const [what, edit] of Object.entries(edits)) {
    const copy = classic();
    edit(copy);
    assert.equal(isUntouchedSample(copy), false, what);
  }
});

test('a copy is judged against its own sample: Classic\'s content under Modern\'s id is an edit', () => {
  assert.equal(isUntouchedSample({ ...classic(), id: 'demo_modern' }), false);
  assert.equal(isUntouchedSample({ ...classic(), id: 'demo_unknown' }), false);
});

test('a flag with no résumé under it (the flag of a copy the cloud never had) holds nothing: untouched', () => {
  assert.equal(isUntouchedSample({ id: 'demo_minimal', deleted: true }), true);
  assert.equal(isUntouchedSample({ id: 'demo_minimal', deleted: true, updatedAt: 5, dataVersion: 8 }), true);
  // Not a whole résumé, but something someone wrote: kept, never judged a stub.
  assert.equal(isUntouchedSample({ id: 'demo_minimal', deleted: true, name: 'Notes' }), false);
});

test('isSampleId: the ids the old builds gave the samples, and no other', () => {
  assert.deepEqual(['demo_classic', 'demo_x', 'resume_demo_1', 'original_private', '', null].map(isSampleId), [true, true, false, false, false, false]);
});
