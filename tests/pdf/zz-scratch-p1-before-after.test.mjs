// SCRATCH (a throwaway measurement, removed again in the next commit): a 200 000-character paragraph built with and
// without splitHugeBlocks (the cut that landed as typing-freeze 7b), with the call counts of textkit's line breaker.
// It prints "P1B ..." lines; it asserts nothing.
import { before, after, describe, it } from 'node:test';
import fs from 'node:fs';
import inspector from 'node:inspector';
import { createRequire } from 'node:module';
import { setup, teardown, resume, experience, render, loadModule } from './harness.mjs';

before(setup);
after(teardown);

function rng(seed) {
  let a = seed;
  return () => { a = (Math.imul(a, 1103515245) + 12345) & 0x7fffffff; return a / 0x7fffffff; };
}
function words(n, seed = 7) {
  const rand = rng(seed);
  const parts = [];
  let len = 0;
  while (len < n) {
    let w = '';
    for (let i = 2 + Math.floor(rand() * 9); i > 0; i -= 1) w += String.fromCharCode(97 + Math.floor(rand() * 26));
    parts.push(w);
    len += w.length + 1;
  }
  return parts.join(' ').slice(0, n).trim();
}
const pagesOf = (bytes) => (Buffer.from(bytes).toString('latin1').match(/\/Type \/Page(?!s)/g) || []).length;
const description = (html) => resume({ template: 'classic', sections: [experience([{ description: html }])] });

describe('P1B scratch', () => {
  it('a long paragraph, with and without the cut: time and textkit call counts', { timeout: 40 * 60 * 1000 }, async () => {
    const require = createRequire(import.meta.url);
    const textkitFile = require.resolve('@react-pdf/textkit');
    const source = fs.readFileSync(textkitFile, 'utf8');
    const lineOf = (offset) => source.slice(0, offset).split('\n').length;
    const session = new inspector.Session();
    session.connect();
    const post = (m, p) => new Promise((res, rej) => session.post(m, p, (e, r) => (e ? rej(e) : res(r))));
    await post('Profiler.enable');
    const counted = async (fn) => {
      await post('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
      await fn();
      const { result } = await post('Profiler.takePreciseCoverage');
      await post('Profiler.stopPreciseCoverage');
      const script = result.find((s) => s.url.endsWith('/@react-pdf/textkit/lib/textkit.js'));
      const out = {};
      for (const f of script?.functions || []) {
        const count = f.ranges[0].count;
        if (count) out[`${f.functionName || 'anon'}:${lineOf(f.ranges[0].startOffset)}`] = count;
      }
      return out;
    };
    const watch = ['computeCost:', 'computeSum:', 'slice$1:', 'sliceRuns:', 'advanceWidthBetween$1:', 'advanceWidthBetween:', 'getNextBreakpoint:', 'applyBestFit:', 'linebreak:', 'breakLines:', 'getNodes:', 'layoutParagraph:', 'linebreaker:', 'breakpoint:'];

    await render(description('<p>warm up</p>'));
    const split = await loadModule('/src/templates/pdf/shared/splitHugeBlock.js');
    const real = split.splitHugeBlocks;
    let overridden = true;
    const setSplit = (fn) => {
      try { Object.defineProperty(split, 'splitHugeBlocks', { value: fn, configurable: true, enumerable: true, writable: true }); } catch (e) { overridden = false; console.log(`P1B override failed: ${e.message}`); }
    };
    for (const mode of ['split', 'unsplit']) {
      setSplit(mode === 'split' ? real : (blocks) => blocks);
      if (!overridden) break;
      let prev = null;
      for (const n of [12_500, 25_000, 50_000, 100_000, 200_000]) {
        const html = `<p>${words(n)}</p>`;
        const start = performance.now();
        const bytes = await render(description(html));
        const ms = performance.now() - start;
        console.log(`P1B mode=${mode} chars=${n} ms=${ms.toFixed(0)} pages=${pagesOf(bytes)} ratio=${prev ? (ms / prev).toFixed(2) : '-'}`);
        const growth = prev ? ms / prev : 2.2;
        prev = ms;
        const counts = await counted(async () => { await render(description(html)); });
        console.log(`P1B counts mode=${mode} chars=${n} ${Object.entries(counts).filter(([k]) => watch.some((w) => k.startsWith(w))).map(([k, v]) => `${k}=${v}`).join(' ')}`);
        if (ms * Math.max(2.1, Math.min(4.5, growth + 0.2)) > 50_000) { console.log(`P1B mode=${mode} stops after ${n}`); break; }
      }
    }
    setSplit(real);
    await post('Profiler.disable');
    session.disconnect();
  });
});
