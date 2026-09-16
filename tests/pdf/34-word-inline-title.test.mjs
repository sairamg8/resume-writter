// Header Customization → Name & Title Layout "Inline" in the Word résumé (ONB-3-NB1). Classic,
// Minimal and Executive print "Pat Sample  Staff Engineer" on one baseline in the PDF (= the
// preview); their .docx always put the title on a line of its own under the name. The letter's
// Word letterhead has printed the line since V2FIDB-51-3 — the résumé now prints it the same way:
// a real space (the line reads and copies as words) widened to the PDF's gap.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderDocx, read, allItems, loadModule } from './harness.mjs';

before(setup);
after(teardown);

/** The templates whose header offers Name & Title Layout (hasHeaderControls); Modern and Sidebar do not. */
const STACKED = ['classic', 'minimal', 'executive'];
const FIXED = ['modern', 'sidebar'];
const NAME = 'Pat Sample';
const TITLE = 'Staff Engineer';
const EMAIL = 'pat@example.com';
/** Calibri's space, em (463 of its 2048 units): the .docx's font (wordExport.js buildDocument). */
const SPACE_EM = 463 / 2048;

const cv = (template, settings = {}, personal = {}) => resume({
  template,
  settings: { accentColor: '#e11d48', ...settings },
  personal: { name: NAME, title: TITLE, email: EMAIL, phone: '+1 555 0100', hiddenFields: [], ...personal },
});
const inline = (settings) => ({ headerLayout: 'inline', ...settings });
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/**
 * Minimal's name is letter-spaced -0.3 pt in the PDF, and its run's width ends with that spacing
 * after the last glyph; Word prints the name without it, so its gap is the setting's own.
 */
const NAME_TRACKING = { minimal: -0.3 };

/**
 * Where the PDF prints the title against the name: `dx` from the name's end, `dy` below its
 * baseline, `gap` the Name & Title Spacing it laid out (dx less the name's trailing tracking), pt.
 */
async function pdfLine(r) {
  const items = allItems(await read(await render(r)));
  const name = items.find((t) => t.str.includes('Pat'));
  const title = items.find((t) => t.str.includes('Staff'));
  const dx = title.x - (name.x + name.w);
  return { dx, dy: name.y - title.y, gap: dx - (NAME_TRACKING[r.template] || 0) };
}
/** A paragraph's runs, as { text, props } — props its <w:rPr> XML. */
const runs = (p) => p.xml.split('</w:r>')
  .map((run) => ({ text: /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/.exec(run)?.[1], props: /<w:rPr>.*<\/w:rPr>/s.exec(run)?.[0] || '' }))
  .filter((run) => run.text !== undefined);
const jc = (p) => /<w:jc w:val="(\w+)"\/>/.exec(p.xml)?.[1] || null;
/** The gap Word prints between the name and the title, pt: the space run's own width plus its character spacing. */
function wordGap(p) {
  const space = runs(p).find((run) => run.text === ' ');
  assert.ok(space, `a space between name and title in ${JSON.stringify(runs(p).map((run) => run.text))}`);
  const size = Number(/<w:sz w:val="(\d+)"\/>/.exec(space.props)?.[1]);
  const spacing = Number(/<w:spacing w:val="(-?\d+)"\/>/.exec(space.props)?.[1] ?? 0);
  return { pt: SPACE_EM * (size / 2) + spacing / 20, twips: spacing };
}

describe('Word résumé: Name & Title Layout "Inline" prints name and title on one line, as the PDF does (ONB-3-NB1)', () => {
  it('Classic, Minimal and Executive: one line, left or centred, name and title in the look they have stacked, the contacts below', async () => {
    for (const template of STACKED) {
      for (const headerAlign of ['left', 'center']) {
        const at = `${template}, ${headerAlign}`;
        const pdf = await pdfLine(cv(template, inline({ headerAlign })));
        assert.ok(pdf.dy < 3 && pdf.dx > 0, `${at}: the PDF prints one line (dy ${pdf.dy.toFixed(2)}, dx ${pdf.dx.toFixed(2)})`);
        const doc = await renderDocx(cv(template, inline({ headerAlign })));
        assert.deepEqual(doc.texts.slice(0, 2), [`${NAME} ${TITLE}`, `${EMAIL}  |  +1 555 0100`], `${at}: Word`);
        const stacked = await renderDocx(cv(template, { headerAlign, headerLayout: 'stack' }));
        const [head] = doc.paragraphs;
        const props = (p, text) => runs(p).find((run) => run.text === text)?.props;
        assert.equal(props(head, NAME), props(stacked.paragraphs[0], NAME), `${at}: the name's run`);
        assert.equal(props(head, TITLE), props(stacked.paragraphs[1], TITLE), `${at}: the title's run`);
        assert.equal(jc(head), headerAlign === 'center' ? 'center' : null, `${at}: alignment`);
      }
    }
  });

  it('Name & Title Spacing: Word\'s gap is the PDF\'s at every step of the control', async () => {
    for (const template of STACKED) {
      const twips = {};
      for (const headerInlineGap of [2, 8, 16, 24, 48]) {
        const at = `${template}, ${headerInlineGap} px`;
        const pdf = await pdfLine(cv(template, inline({ headerInlineGap })));
        const word = wordGap((await renderDocx(cv(template, inline({ headerInlineGap })))).paragraphs[0]);
        assert.ok(near(word.pt, pdf.gap, 0.05), `${at}: Word ${word.pt.toFixed(3)} pt, the PDF ${pdf.gap.toFixed(3)} pt`);
        twips[headerInlineGap] = word.twips;
      }
      assert.equal(twips[24] - twips[16], 120, `${template}: 8 px (6 pt) more is 120 twips`);
    }
  });

  // An imported file can carry anything: out of range prints at the range's end, not a number as
  // 8 px — the letterhead's rule (header_spacing_spec.md D9) — and the .docx always exports.
  it('a stored spacing outside its range prints at the range\'s end; one that is not a number prints 8 px', async () => {
    const gap = async (template, headerInlineGap) => wordGap((await renderDocx(cv(template, inline({ headerInlineGap })))).paragraphs[0]).twips;
    for (const template of STACKED) {
      assert.equal(await gap(template, 1000), await gap(template, 48), `${template}: 1000 px prints as 48`);
      assert.equal(await gap(template, -5), await gap(template, 2), `${template}: -5 px prints as 2`);
      const own = await gap(template, 8);
      for (const junk of ['abc', {}, null]) assert.equal(await gap(template, junk), own, `${template}: ${JSON.stringify(junk)} prints as 8 px`);
    }
  });

  // Guard: Stack, and a layout the panel never writes, stack as before; Modern's banner and the
  // Sidebar's column take no Name & Title Layout (Header Customization hides it) in the PDF or Word.
  it('Stack, an unset or unknown layout, Modern and Sidebar keep the title on its own line; no title leaves the name alone', async () => {
    for (const template of STACKED) {
      for (const headerLayout of ['stack', undefined, 'Inline', 'row']) {
        const doc = await renderDocx(cv(template, { headerLayout }));
        assert.deepEqual(doc.texts.slice(0, 2), [NAME, TITLE], `${template}, ${headerLayout}`);
      }
      const alone = await renderDocx(cv(template, inline(), { title: '' }));
      assert.deepEqual(runs(alone.paragraphs[0]).map((run) => run.text), [NAME], `${template}: no title, no trailing space`);
      assert.ok(alone.texts[1].startsWith(EMAIL), `${template}: no title, the contacts next`);
    }
    for (const template of FIXED) {
      const pdf = await pdfLine(cv(template, inline()));
      assert.ok(pdf.dy > 5, `${template}: the PDF stacks them (dy ${pdf.dy.toFixed(2)})`);
      assert.deepEqual((await renderDocx(cv(template, inline()))).texts.slice(0, 2), [NAME, TITLE], `${template}: Word`);
    }
  });

  it('a résumé saved with Inline by an older build (no dataVersion, 4bc56fe) loads and exports one line at the PDF\'s gap', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const template of STACKED) {
      // Every résumé since ATS_DEFAULTS stores headerInlineGap: 8; the oldest stored none.
      for (const headerInlineGap of [8, undefined]) {
        const saved = { ...cv(template, inline({ headerInlineGap })), updatedAt: Date.UTC(2026, 7, 20) };
        if (headerInlineGap === undefined) delete saved.settings.headerInlineGap;
        delete saved.dataVersion;
        const r = normalizeResume(saved);
        const doc = await renderDocx(r);
        assert.equal(doc.texts[0], `${NAME} ${TITLE}`, `${template}, ${headerInlineGap}: Word`);
        const pdf = await pdfLine(r);
        assert.ok(near(wordGap(doc.paragraphs[0]).pt, pdf.gap, 0.05), `${template}, ${headerInlineGap}: the PDF's ${pdf.gap.toFixed(2)} pt gap`);
      }
    }
  });
});
