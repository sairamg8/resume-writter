// Fonts are fetched and parsed once a session, not once a build (R2-142, PERF-1). Every keystroke's
// preview is a new PDF build; the plan feared each one fetched the WOFF files again and parsed them
// into fontkit fonts again. It does not: react-pdf keeps each registered face's load (its fetch and
// its fontkit font) for good, and pdfFontLoader registers a family once. This pins it, for the
// bundled Noto Sans and for a subset only some text needs (latin-ext), over builds of different
// résumés and of the letter: the second build of each fetches no font file, and every face is the
// very font object the first build parsed. It also reports what a cold and a warm build cost here,
// the harness PERF-1 asked for (numbers in the test's diagnostics; no timing is asserted).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, experience, render, renderCover } from './harness.mjs';

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
  it('a second build fetches no font file, and every face is the font object the first build parsed', async (t) => {
    const { Font } = await loadModule('@react-pdf/renderer');
    const realFetch = globalThis.fetch;
    const fetched = [];
    globalThis.fetch = (url, ...rest) => { if (/\.woff2?$/.test(String(url))) fetched.push(String(url)); return realFetch(url, ...rest); };
    try {
      const faces = (family) => (Font.getRegisteredFonts()[family]?.sources || []).map((s) => s.data).filter(Boolean);
      const time = async (fn) => { const t0 = performance.now(); const out = await fn(); return [out, Math.round(performance.now() - t0)]; };

      const [, cold] = await time(() => render(long(8, ' in Kraków and Łódź')));
      const first = fetched.length;
      const noto = faces('NotoSans');
      const ext = faces('NotoSans latin-ext');
      assert.ok(noto.length > 0 && ext.length > 0, 'the build loaded Noto Sans and its latin-ext subset');
      assert.ok(first >= noto.length + ext.length, `the first build fetched its faces (${first})`);

      const [bytes, warm] = await time(() => render(long(8, ' in Gdańsk')));
      const [, other] = await time(() => render(long(3)));
      await renderCover(long(1, ' — Wrocław'));
      assert.deepEqual(fetched.slice(first), [], 'the later builds fetched font files again');
      assert.ok(faces('NotoSans').every((f, i) => f === noto[i]), 'Noto Sans was parsed again');
      assert.ok(faces('NotoSans latin-ext').every((f, i) => f === ext[i]), 'its latin-ext subset was parsed again');
      t.diagnostic(`font files fetched: ${first} by the first build, 0 after; build of a ${Math.ceil(bytes.length / 1024)} kB résumé: cold ${cold} ms, warm ${warm} ms, a shorter one ${other} ms`);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
