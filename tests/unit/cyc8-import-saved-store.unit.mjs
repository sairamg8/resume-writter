// CYC8-S13: importing a saved store (the file "Download the copy" saves from a recovery notice): each
// readable résumé goes through the given importResume once, an entry that is not a résumé or that the
// import refuses is counted and left out, and no more than MAX_BACKUP_RESUMES come in. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BACKUP_RESUMES, importSavedStore, savedStoreMessage } from '../../src/utils/importBackup.js';

const r = (n) => ({ id: `r${n}`, name: `CV ${n}`, personal: { name: `Person ${n}` }, sections: [] });

test('each readable résumé is imported once, in order; the keep flag marks only the first of a copy that names no original; the rest are counted', () => {
  const calls = [];
  const importResume = (data, options) => { calls.push([data.id, options]); return `new_${data.id}`; };
  const result = importSavedStore({ resumes: [r(1), null, { id: 'x' }, r(2), 'text'] }, importResume, { keep: true });
  assert.deepEqual(calls, [['r1', { keep: true }], ['r2', { keep: false }]]); // S13: not every résumé of the copy is an original
  assert.deepEqual(result, { added: 2, unreadable: 3, over: 0, ids: ['new_r1', 'new_r2'] });
});

test('one the import refuses is counted as unreadable, and the others still come in', () => {
  const importResume = (data) => { if (data.id === 'r2') throw new Error('bad'); return data.id; };
  const quiet = console.error;
  console.error = () => {};
  try {
    const result = importSavedStore({ resumes: [r(1), r(2), r(3)] }, importResume);
    assert.deepEqual(result, { added: 2, unreadable: 1, over: 0, ids: ['r1', 'r3'] });
  } finally { console.error = quiet; }
});

test('no more than the cap come in; the rest are counted', () => {
  const list = Array.from({ length: MAX_BACKUP_RESUMES + 5 }, (_, i) => r(i));
  let n = 0;
  const result = importSavedStore({ resumes: list }, () => { n += 1; return `id${n}`; });
  assert.equal(n, MAX_BACKUP_RESUMES);
  assert.equal(result.added, MAX_BACKUP_RESUMES);
  assert.equal(result.over, 5);
  assert.match(savedStoreMessage(result), /Only the first 100 were imported; 5 more were left out/);
});

test('the message counts what came in and what was left out', () => {
  assert.equal(savedStoreMessage({ added: 1, unreadable: 0, over: 0 }), 'Imported 1 résumé from the saved copy as a new résumé.');
  assert.match(savedStoreMessage({ added: 3, unreadable: 2, over: 0 }), /Imported 3 résumés .* 2 entries could not be read and were left out\./);
  assert.match(savedStoreMessage({ added: 0, unreadable: 2, over: 0 }), /no résumé that could be read/);
});
