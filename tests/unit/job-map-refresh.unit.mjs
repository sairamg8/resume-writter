// The Job Map refresh (tools/job-map): the documents it writes are the ones the page reads, and a crawl
// that lost most of the roles is refused instead of replacing good data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPANY_CHUNK, dataToDocs, staleIds, shrunkTooFar, total } from '../../tools/job-map/docs.mjs';
import { chunkIds } from '../../src/utils/jobMapData.js';

const data = (companies, counts, chunks = {}) => ({ meta: { crawled: '2026-10-08', counts, companies: Array.from({ length: companies }, (_, i) => [`C${i}`]) }, chunks });

test('the company chunk size is the one the page reads with', () => {
  const io = readFileSync(new URL('../../src/utils/jobMapIo.js', import.meta.url), 'utf8');
  assert.equal(Number(/const COMPANY_CHUNK = (\d+)/.exec(io)[1]), COMPANY_CHUNK);
});

test('dataToDocs: role chunks, then company chunks, the meta document last', () => {
  const docs = dataToDocs(data(COMPANY_CHUNK + 1, { US: 2 }, { 'US-0': [[0, 'engineering', 'ui', 'senior', 'T', 'L', 'u', '', 0]] }));
  assert.deepEqual(docs.map((d) => d.id), ['US-0', 'companies-0', 'companies-1', 'meta']);
  assert.equal(JSON.parse(docs[0].data.json).length, 1);
  assert.equal(JSON.parse(docs[1].data.json).length, COMPANY_CHUNK);
  assert.equal(JSON.parse(docs[2].data.json).length, 1);
  assert.deepEqual(docs[3].data, { crawled: '2026-10-08', counts: { US: 2 }, companyChunks: 2 });
});

test('the role chunk ids written are the ones the page asks for', () => {
  const rows = Array.from({ length: 1201 }, () => [0]);
  const chunks = { 'US-0': rows.slice(0, 1200), 'US-1': rows.slice(1200) };
  const ids = dataToDocs(data(1, { US: 1201 }, chunks)).map((d) => d.id);
  for (const id of chunkIds('US', 1201)) assert.ok(ids.includes(id), id);
});

test('staleIds: documents the new data does not write any more', () => {
  const docs = dataToDocs(data(1, { US: 1 }, { 'US-0': [[0]] }));
  assert.deepEqual(staleIds(['US-0', 'US-1', 'IN-0', 'companies-0', 'companies-1', 'meta'], docs), ['US-1', 'IN-0', 'companies-1']);
});

test('shrunkTooFar: a 40% drop or worse is refused, growth and a first upload are not', () => {
  assert.equal(total({ US: 3, IN: 2 }), 5);
  assert.equal(shrunkTooFar({ US: 100 }, { US: 61 }), false);
  assert.equal(shrunkTooFar({ US: 100 }, { US: 59 }), true);
  assert.equal(shrunkTooFar({ US: 100 }, { US: 500 }), false);
  assert.equal(shrunkTooFar(undefined, { US: 1 }), false);
  assert.equal(shrunkTooFar({ US: 100 }, {}), true);
});
