// S13: for a demo account the Dashboard Import offers "Import as my original", and a saved copy of the whole store
// (importBackup.js) applied that to every résumé in the file, so a copy of twenty résumés became twenty originals that come back
// after each deletion. The flag now marks only the résumés the copy itself marks as originals (`keep: true`); a copy that marks
// none still honours the choice with the one that was open in it (`activeId`), else the first. Without the choice nothing is marked,
// whatever the file says (a file never makes an original by itself: useResumeStore.importResume).
// Run: node --test tests/unit/392-cycA-import-store-original.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importSavedStore } from '../../src/utils/importBackup.js';

const r = (n, extra = {}) => ({ id: `r${n}`, name: `CV ${n}`, personal: { name: `Person ${n}` }, sections: [], ...extra });

/** The keep flag each résumé of `store` was imported with, by id. */
function flags(store, options) {
  const seen = {};
  importSavedStore(store, (data, { keep }) => { seen[data.id] = keep; return data.id; }, options);
  return seen;
}

test('as my original marks the résumés the copy marks as originals, and no other', () => {
  const store = { resumes: [r(1), r(2, { keep: true }), r(3), r(4, { keep: true })], activeId: 'r1' };
  assert.deepEqual(flags(store, { keep: true }), { r1: false, r2: true, r3: false, r4: true });
});

test('a copy that marks none: the choice goes to the résumé that was open in it', () => {
  const store = { resumes: [r(1), r(2), r(3)], activeId: 'r2' };
  assert.deepEqual(flags(store, { keep: true }), { r1: false, r2: true, r3: false });
});

test('a copy that marks none and names no open résumé: the first one', () => {
  assert.deepEqual(flags({ resumes: [r(1), r(2)], activeId: 'gone' }, { keep: true }), { r1: true, r2: false });
});

test('the open one is chosen among those imported (an entry that is not a résumé, or past the cap, does not count)', () => {
  const store = { resumes: [{ id: 'r9' }, r(1), r(2)], activeId: 'r9' };
  assert.deepEqual(flags(store, { keep: true }), { r1: true, r2: false });
});

test('without the choice nothing is marked, whatever the copy says', () => {
  const store = { resumes: [r(1, { keep: true }), r(2)], activeId: 'r1' };
  assert.deepEqual(flags(store, {}), { r1: false, r2: false });
  assert.deepEqual(flags(store, { keep: false }), { r1: false, r2: false });
});

test('a copy with nothing readable imports nothing and marks nothing', () => {
  const result = importSavedStore({ resumes: [{ id: 'x' }] }, () => assert.fail('nothing to import'), { keep: true });
  assert.equal(result.added, 0);
});
