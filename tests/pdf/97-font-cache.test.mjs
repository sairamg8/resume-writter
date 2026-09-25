// Fonts are fetched and parsed once a session, not once a build (R2-142, part of PERF-1). Every
// keystroke's preview is a new PDF build; react-pdf keeps each registered face's load (its fetch and
// its fontkit font) for good, and pdfFontLoader registers a family once. This is a guard, not PERF-1's
// fix: PERF-1's cost is fontkit re-inflating a WOFF font's glyf table once per glyph laid out
// (fontkit's WOFFFont._getTableStream), which no cache here touches — that part is still open. It pins, for the
// bundled Noto Sans and for a subset only some text needs (latin-ext), over builds of different
// résumés and of the letter: the builds after the first fetch no font file — and react-pdf parses a
// face only as its fetch arrives, so none is parsed again either. It also reports what a cold and a warm build cost here,
// the harness PERF-1 asked for (numbers in the test's diagnostics; no timing is asserted).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, renderCover } from './harness.mjs';

before(setup);
after(teardown);

/** A résumé of `n` entries, long enough for a few pages; `extra` adds text that needs another subset. */
const long = (n, extra = '') => resume({
  template: 'classic',
  personal: { summary: `<p>Ships reliable services${extra}.</p>` },
  sections: [experience(Array.from({ length: n }, (_, i) => ({
    role: `Engineer ${i + 1}`,
    description: `<ul>${'<li>Cut the checkout page load by forty percent across three markets and two platforms</li>'.repeat(6)}</ul>`,
  })))],
});

describe('fonts are fetched and parsed once a session, not per build (R2-142, PERF-1)', () => {
  it('the builds after the first fetch no font file, so none is parsed again', async (t) => {
    const realFetch = globalThis.fetch;
    const fetched = [];
    globalThis.fetch = (url, ...rest) => { if (/\.woff2?$/.test(String(url))) fetched.push(String(url)); return realFetch(url, ...rest); };
    try {
      const time = async (fn) => { const t0 = performance.now(); const out = await fn(); return [out, Math.round(performance.now() - t0)]; };

      const [, cold] = await time(() => render(long(8, ' in Kraków and Łódź')));
      const first = fetched.length;
      assert.ok(fetched.some((u) => /noto-sans-latin-\d/.test(u)) && fetched.some((u) => /noto-sans-latin-ext-/.test(u)),
        `the first build fetched Noto Sans and its latin-ext subset (${fetched.map((u) => u.split('/').pop()).join(', ')})`);

      const [bytes, warm] = await time(() => render(long(8, ' in Gdańsk')));
      const [, other] = await time(() => render(long(3)));
      await renderCover(long(1, ' — Wrocław'));
      assert.deepEqual(fetched.slice(first), [], 'the later builds fetched font files again');
      t.diagnostic(`font files fetched: ${first} by the first build, 0 after; build of a ${Math.ceil(bytes.length / 1024)} kB résumé: cold ${cold} ms, warm ${warm} ms, a shorter one ${other} ms`);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
