// A WOFF face's glyf table is inflated once a session, not once per glyph of every build (R2-142, PERF-1).
// Every font the PDF prints is a .woff, and fontkit's WOFFFont inflated the whole compressed glyf table
// again each time it was asked for it: twice for every glyph a PDF embeds and once for a glyph's
// bounding box, so each keystroke's preview re-inflated each face's table once per glyph it printed.
// prepareFonts keeps the inflated bytes with the face (pdfFontLoader.js, inflateGlyfOnce). This loads
// the bundled Noto Sans before any build, counts every inflation of each face's glyf table over three
// builds (two résumés and a letter), and checks the PDFs still read as typed.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, renderCover, read, allText, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const long = (n, summary) => resume({
  template: 'classic',
  personal: { summary: `<p>${summary} <em>across three markets</em>.</p>` },
  sections: [experience(Array.from({ length: n }, (_, i) => ({
    role: `Engineer ${i + 1}`,
    description: `<ul>${'<li>Cut the checkout page load by forty percent for two platforms</li>'.repeat(4)}</ul>`,
  })))],
});

describe('a WOFF face inflates its glyf table once, not per glyph (R2-142, PERF-1)', () => {
  it('three builds inflate each Noto Sans face at most once, and the PDFs read as typed', async (t) => {
    const { prepareFonts } = await loadModule('/src/templates/pdf/shared/pdfFontLoader.js');
    // react-pdf's own font store, the one the app registers its faces in (the fixture re-exports it).
    const { Font } = await loadModule('/tests/fixtures/reactPdfFont.js');
    assert.deepEqual(await prepareFonts(['NotoSans']), ['NotoSans'], 'the bundled Noto Sans loads');
    const faces = [...new Set(Font.getRegisteredFonts().NotoSans.sources.map((s) => s.data).filter(Boolean))];
    assert.equal(faces.length, 6, 'Noto Sans has its six faces: 400, 500 and 700, upright and italic');

    const counts = faces.map((face) => {
      const glyf = face.directory.tables.glyf;
      assert.equal(face.type, 'WOFF');
      assert.ok(glyf.compLength < glyf.length, 'the face stores its glyf table compressed, so reading it inflates');
      const count = { asked: 0, inflated: 0 };
      // WOFFFont._getTableStream inflates by reading the table's compressed bytes from the file's stream.
      const readBuffer = face.stream.readBuffer.bind(face.stream);
      face.stream.readBuffer = (length) => {
        if (length === glyf.compLength - 2 && face.stream.pos === glyf.offset + 2) count.inflated += 1;
        return readBuffer(length);
      };
      const tableStream = face._getTableStream.bind(face);
      face._getTableStream = (tag) => {
        if (tag === 'glyf') count.asked += 1;
        return tableStream(tag);
      };
      return count;
    });

    const pdfs = [
      await render(long(6, 'Ships reliable services')),
      await render(long(3, 'Leads a small platform team')),
      await renderCover(long(1, 'Writes to hiring managers')),
    ];

    const [regular, , bold] = counts;
    assert.ok(regular.asked > 50 && bold.asked > 10,
      `the builds read the regular and bold faces' glyphs (glyf asked for ${counts.map((c) => c.asked).join(', ')} times)`);
    counts.forEach((c, i) => assert.ok(c.inflated <= 1,
      `face ${i} inflated its glyf table ${c.inflated} times for ${c.asked} reads over three builds`));
    t.diagnostic(`glyf reads per face: ${counts.map((c) => c.asked).join(', ')}; inflations: ${counts.map((c) => c.inflated).join(', ')}`);

    // The kept bytes are the table fontkit inflates itself.
    for (const face of faces) {
      const own = Object.getPrototypeOf(face)._getTableStream.call(face, 'glyf');
      assert.deepEqual(face._getTableStream('glyf').buffer, own.buffer, 'the kept glyf table is the inflated one');
    }

    const [first, second] = await Promise.all(pdfs.slice(0, 2).map(read));
    assert.match(allText(first), /Ships reliable services across three markets/);
    assert.match(allText(first), /Cut the checkout page load by forty percent for two platforms/);
    assert.match(allText(second), /Leads a small platform team across three markets/);
    assert.match(allText(second), /Engineer 3/);
  });
});
