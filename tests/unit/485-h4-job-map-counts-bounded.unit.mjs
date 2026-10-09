// Defect: any account the owner allowed can load a Job Map data file (firestore.rules lets it write), and
// every allowed account then reads its counts: a count of 1e9 for a country made the page ask for the 833 334
// chunk documents it names, and one `companyChunks` that large the same for the companies. checkData now
// refuses counts that are not numbers of roles, and chunkIds / chunkCount are bounded for data already saved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_COMPANY_CHUNKS, MAX_COUNTRY_ROWS, checkData, chunkCount, chunkIds } from '../../src/utils/jobMapData.js';

const row = ['0', 'engineering', 'x', 'senior', 'T', 'L', 'https://x/t', '', 0];
const file = (counts) => ({ meta: { counts, companies: [] }, chunks: { 'DE-0': [row] } });

test('checkData refuses a count that is not a number of roles', () => {
  assert.equal(checkData(file({ DE: 1 })), '');
  assert.equal(checkData(file({ DE: 0 })), '');
  assert.equal(checkData(file({ DE: MAX_COUNTRY_ROWS })), '');
  for (const bad of [1e9, -1, 2.5, NaN, Infinity, '12', null, MAX_COUNTRY_ROWS + 1]) {
    assert.match(checkData(file({ DE: bad })), /not numbers of roles/, String(bad));
  }
});

test('chunkIds names at most the chunks a country can hold, and none for a count that is no number', () => {
  assert.equal(chunkIds('US', 1e9).length, MAX_COUNTRY_ROWS / 1200, 'before: 833 334 documents');
  assert.deepEqual(chunkIds('US', Infinity), []);
  assert.deepEqual(chunkIds('US', NaN), []);
  assert.deepEqual(chunkIds('US', '5'), []);
  assert.deepEqual(chunkIds('US', -5), []);
  assert.deepEqual(chunkIds('US', 1201), ['US-0', 'US-1']);
});

test('chunkCount holds a stored chunk count to 0..max', () => {
  assert.equal(chunkCount(3, MAX_COMPANY_CHUNKS), 3);
  assert.equal(chunkCount(1e9, MAX_COMPANY_CHUNKS), MAX_COMPANY_CHUNKS);
  assert.equal(chunkCount(-4, MAX_COMPANY_CHUNKS), 0);
  assert.equal(chunkCount(undefined, MAX_COMPANY_CHUNKS), 0);
  assert.equal(chunkCount('7', MAX_COMPANY_CHUNKS), 0);
});
