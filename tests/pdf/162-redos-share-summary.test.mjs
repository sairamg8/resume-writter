// Typing-freeze finding 7 (the sweep of what a paste or an import reaches): the share panel's summary line asked whether the summary held
// text by cutting its tags with /<[^>]*>/g, which read each "<" that no ">" followed to the end of it (100 000 of them,
// seconds; time squared). One pass now (replaceTags), with the same answer.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const LIMIT_MS = 1000;
const N = 100_000;

describe('the share panel names a long summary in linear time (typing-freeze 7)', () => {
  it('the share panel names a summary of "<" x 100 000 without reading it 100 000 times', async () => {
    const { publicSummary } = await loadModule('/src/utils/publicLink.js');
    const start = performance.now();
    const lines = publicSummary({ personal: { name: 'Pat', summary: '<'.repeat(N) }, sections: [] });
    const ms = performance.now() - start;
    assert.deepEqual(lines, ['Name: Pat', 'Your summary']);
    assert.ok(ms < LIMIT_MS, `publicSummary took ${ms.toFixed(0)} ms`);
    assert.deepEqual(publicSummary({ personal: { summary: '<p><br></p>' }, sections: [] }), [], 'markup alone is no summary');
    assert.deepEqual(publicSummary({ personal: { summary: '<>' }, sections: [] }), [], 'nor is an empty tag');
  });
});
