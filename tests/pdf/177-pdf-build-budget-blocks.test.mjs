// R2-142 (docs/tracking/STATUS.md, "thousands of short blocks in one field"): the PDF worker's budget was
// 20 s plus 250 ms an entry, however much text the entries held, so a sound build of a long résumé was given up
// on at 20 s and Export failed with it. react-pdf lays each paragraph and bullet out again for every page after
// it, so a résumé's time follows its pages times its blocks (measured on CI, one field: 1 000 bullets of 100
// characters 6.6 s, 2 000 bullets 23.4 s, 4 800 bullets of 20 characters 52.7 s). pdfBuildTimeoutMs now adds 15 ms
// for each paragraph or bullet past the first 300, up to 4 000 of them: a résumé of ordinary length gets the
// budget it always had (tests/pdf/126 pins that), a big one gets room past what it measured at, and a hang is
// still found. Counts blocks, never time. Fictional text.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

let build;
before(async () => { await setup(); build = await loadModule('/src/utils/pdfBuild.js'); });
after(teardown);

const BASE = 20_000;
const ENTRY = 250;
const BLOCK = 15;
const bullets = (n) => `<ul>${'<li>Cut the claims backlog</li>'.repeat(n)}</ul>`;
const job = (descriptions, resume = {}, kind = 'resume') => ({
  kind,
  resume: { sections: [{ items: descriptions.map((description) => ({ description })) }], ...resume },
});

describe('the worker budget counts the paragraphs and bullets of a résumé (R2-142)', () => {
  it('a résumé of ordinary length gets the budget it always had: the base and the entries', () => {
    const j = job([bullets(40)], { personal: { summary: '<p>One.</p><p>Two.</p><p>Three.</p>' } });
    assert.equal(build.pdfBuildTimeoutMs(j), BASE + ENTRY);
    assert.equal(build.pdfBuildTimeoutMs(job([bullets(300)])), BASE + ENTRY, 'the first 300 blocks cost nothing');
  });

  it('each block past the first 300 adds 15 ms', () => {
    assert.equal(build.pdfBuildTimeoutMs(job([bullets(301)])), BASE + ENTRY + BLOCK);
    assert.equal(build.pdfBuildTimeoutMs(job([bullets(1300)])), BASE + ENTRY + 1000 * BLOCK);
  });

  it('the blocks of every entry and of the summary add up', () => {
    const j = job([bullets(500), bullets(500), bullets(500)], { personal: { summary: '<p>a</p><p>b</p>' } });
    assert.equal(build.pdfBuildTimeoutMs(j), BASE + 3 * ENTRY + (1502 - 300) * BLOCK);
  });

  it('cold doubles the base, not the blocks', () => {
    assert.equal(build.pdfBuildTimeoutMs(job([bullets(1300)]), true), 2 * BASE + ENTRY + 1000 * BLOCK);
  });

  it('up to 4 000 blocks are counted, so a worker that never answers is still given up on', () => {
    assert.equal(build.pdfBuildTimeoutMs(job([bullets(100_000)])), BASE + ENTRY + 4000 * BLOCK);
  });

  it('the budget leaves room past what the builds measured on CI took', () => {
    // 2 000 bullets of 100 characters: 23.4 s; 4 800 bullets of 20 characters: 52.7 s.
    assert.ok(build.pdfBuildTimeoutMs(job([bullets(2000)])) >= 1.5 * 23_400);
    assert.ok(build.pdfBuildTimeoutMs(job([bullets(4800)])) >= 1.4 * 52_700);
  });

  it('a letter prints no entries and no blocks of a résumé: the base', () => {
    assert.equal(build.pdfBuildTimeoutMs(job([bullets(2000)], {}, 'letter')), BASE);
  });

  it('a résumé of odd shapes gets the base and throws nothing', () => {
    for (const resume of [{}, { sections: null }, { sections: [null] }, { sections: [{ items: null }] }, { sections: [{ items: [null, 7, 'x', { description: 5 }] }] }, { sections: [{ items: [{ description: bullets(2) }] }], personal: null }]) {
      const ms = build.pdfBuildTimeoutMs({ kind: 'resume', resume });
      assert.ok(ms >= BASE && ms <= BASE + 4 * ENTRY, `${JSON.stringify(resume)}: ${ms}`);
    }
    assert.equal(build.pdfBuildTimeoutMs(undefined), BASE);
    assert.equal(build.pdfBuildTimeoutMs({ kind: 'resume' }), BASE);
  });
});
