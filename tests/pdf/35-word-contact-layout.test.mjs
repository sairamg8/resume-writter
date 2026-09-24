// Design → Contact Layout in the Word résumé (FIDB-51-VF1-NB1-NB2). Classic, Minimal and Executive
// print Single as one contact a line and 2 Grid as two a row in the PDF (= the preview); their .docx
// printed every layout as one paragraph "a  •  b  •  c". Word has no cells: Single is a paragraph a
// value, 2 Grid a paragraph a row, its second value at a tab stop where the PDF's second cell starts
// (centred: centre tab stops at the two cells' centres). A value wider than its cell pushes the next
// one along in Word, where the PDF would print it on a row of its own — never over it.
// Modern's banner and the Sidebar's column take no Contact Layout, in the PDF as in Word.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderDocx, read, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const STYLED = ['classic', 'minimal', 'executive'];
const FIXED = ['modern', 'sidebar'];
const PERSONAL = { name: 'Pat Sample', title: 'Staff Engineer', email: 'pat@example.com', phone: '+1 555 0100', location: 'Berlin, Germany', website: 'pat.dev', hiddenFields: [] };
const VALUES = ['pat@example.com', '+1 555 0100', 'Berlin, Germany', 'pat.dev'];
const FIVE = { ...PERSONAL, linkedin: 'https://linkedin.com/in/pat' };
const isContact = (s) => /pat@|555|Berlin|pat\.dev|linkedin/.test(s);

const cv = (template, settings = {}, personal = PERSONAL) => resume({ template, settings, personal });

/** A paragraph's pieces in order: its text runs' text, and '\t' for a tab (the paragraph's own properties left out). */
function tokens(p) {
  const body = p.xml.replace(/<w:pPr>.*?<\/w:pPr>/s, '');
  return [...body.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>/g)].map((m) => (m[1] === undefined ? '\t' : m[1]));
}
/** The contact paragraphs of a .docx: each as its cells (split at tabs, marks and blank lead cells dropped), tab stops and alignment. */
async function wordRows(r) {
  const doc = await renderDocx(r);
  return doc.paragraphs.filter((p) => isContact(p.text)).map((p) => {
    const cells = tokens(p).join('').split('\t').map((c) => c.replace(/•/g, '').trim()).filter(Boolean);
    const stops = [...p.xml.matchAll(/<w:tab w:val="(\w+)" w:pos="(\d+)"\/>/g)].map((m) => [m[1], Number(m[2])]);
    return { cells, stops, jc: /<w:jc w:val="(\w+)"\/>/.exec(p.xml)?.[1] || null, bullets: (tokens(p).join('').match(/•/g) || []).length };
  });
}
/** The PDF's contact rows, top down: each row's values left to right (bullets dropped). */
async function pdfRows(r) {
  const [page] = await read(await render(r));
  const rows = new Map();
  for (const t of page.items.filter((i) => isContact(i.str))) {
    const y = [...rows.keys()].find((k) => Math.abs(k - t.y) < 2) ?? t.y;
    rows.set(y, [...(rows.get(y) || []), t]);
  }
  return [...rows.entries()].sort((a, b) => b[0] - a[0])
    .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.str.replace(/•/g, '').trim()).filter(Boolean));
}
/**
 * Word's content width, pt: the paper less its left and right margins — Design → Spacing's, 18 mm
 * unless `settings` set one (wordExport.js buildDocument, R2-062) — in the whole twips Word takes.
 */
async function contentPt(settings) {
  const { PAGE_SIZES, pageSizeOf } = await loadModule('/src/constants/pageSize.js');
  return (PAGE_SIZES[pageSizeOf(settings)].twips.width - 2 * Math.round(((settings.marginH ?? 18) * 1440) / 25.4)) / 20;
}
const twips = (pt) => Math.round(pt * 20);
/** 2 Grid's geometry, as the PDF lays it out: cells of 46 % of the row, 24 px (18 pt) between them. */
const CELL = 0.46;
const GAP = 18;

describe('the Word résumé prints Design → Contact Layout (FIDB-51-VF1-NB1-NB2)', () => {
  it('Single: one paragraph a contact, in the PDF\'s order; a bullet before each under Bullet, none under Icon or Bar', async () => {
    for (const template of STYLED) {
      for (const contactStyle of ['bullet', 'icon', 'bar']) {
        for (const headerAlign of ['left', 'center']) {
          const at = `${template} ${contactStyle} ${headerAlign}`;
          const r = cv(template, { contactLayout: 'single', contactStyle, headerAlign });
          const rows = await wordRows(r);
          assert.deepEqual(rows.map((row) => row.cells), (await pdfRows(r)), `${at}: the PDF's rows`);
          assert.deepEqual(rows.map((row) => row.cells), VALUES.map((v) => [v]), at);
          assert.deepEqual(rows.map((row) => row.bullets), VALUES.map(() => (contactStyle === 'bullet' ? 1 : 0)), `${at}: marks`);
          assert.deepEqual(rows.map((row) => row.jc), VALUES.map(() => (headerAlign === 'center' ? 'center' : null)), `${at}: alignment`);
        }
      }
    }
  });

  it('2 Grid: a paragraph a row of two, the second at a tab stop where the PDF\'s second cell starts — on A4 and US Letter', async () => {
    for (const template of STYLED) {
      for (const pageSize of ['A4', 'LETTER']) {
        for (const contactStyle of ['bullet', 'icon']) {
          const at = `${template} ${pageSize} ${contactStyle}`;
          const r = cv(template, { contactLayout: '2grid', contactStyle, pageSize });
          const rows = await wordRows(r);
          assert.deepEqual(rows.map((row) => row.cells), await pdfRows(r), `${at}: the PDF's rows`);
          assert.deepEqual(rows.map((row) => row.cells), [VALUES.slice(0, 2), VALUES.slice(2)], at);
          const w = await contentPt({ pageSize });
          for (const row of rows) assert.deepEqual(row.stops, [['left', twips(CELL * w + GAP)]], `${at}: the second cell's tab stop`);
          assert.deepEqual(rows.map((row) => row.bullets), [2, 2].map((n) => (contactStyle === 'bullet' ? n : 0)), `${at}: marks`);
        }
      }
    }
  });

  it('2 Grid centred: each value centred on its cell\'s centre; an odd last contact centred on the line, as the PDF prints it', async () => {
    for (const template of STYLED) {
      const r = cv(template, { contactLayout: '2grid', contactStyle: 'bullet', headerAlign: 'center' }, FIVE);
      const rows = await wordRows(r);
      assert.deepEqual(rows.map((row) => row.cells), await pdfRows(r), `${template}: the PDF's rows`);
      const w = await contentPt({});
      const offset = (w - (2 * CELL * w + GAP)) / 2;
      const centres = [['center', twips(offset + (CELL * w) / 2)], ['center', twips(offset + CELL * w + GAP + (CELL * w) / 2)]];
      assert.deepEqual(rows.slice(0, 2).map((row) => [row.stops, row.jc]), [[centres, null], [centres, null]], `${template}: the rows of two`);
      assert.deepEqual([rows[2].cells, rows[2].stops, rows[2].jc], [['linkedin.com/in/pat'], [], 'center'], `${template}: the fifth, alone`);
    }
  });

  it('Justify (and a layout the panel never writes) keeps one line; Modern and Sidebar keep one line whatever is stored', async () => {
    const line = () => [VALUES.join('  |  ')];
    for (const template of STYLED) {
      for (const contactLayout of [undefined, 'justify', 'rows']) {
        const rows = await wordRows(cv(template, { contactLayout, contactStyle: 'bar' }));
        assert.deepEqual(rows.map((row) => [row.cells, row.stops]), [[line(), []]], `${template} ${contactLayout}`);
      }
    }
    for (const template of FIXED) {
      for (const contactLayout of ['single', '2grid']) {
        const r = cv(template, { contactLayout, contactStyle: 'bullet' });
        assert.deepEqual(await pdfRows(r), await pdfRows(cv(template, { contactStyle: 'bullet' })), `${template} ${contactLayout}: the PDF ignores it`);
        const rows = await wordRows(r);
        assert.deepEqual([rows.length, rows[0].stops], [1, []], `${template} ${contactLayout}: Word`);
      }
    }
  });

  it('a hidden contact is left out of every row; a résumé saved by an older build with Single exports one a line', async () => {
    const hidden = { ...PERSONAL, hiddenFields: ['phone'] };
    const r = cv('classic', { contactLayout: '2grid', contactStyle: 'bullet' }, hidden);
    assert.deepEqual((await wordRows(r)).map((row) => row.cells), await pdfRows(r), 'hidden phone: the PDF\'s rows');
    assert.deepEqual((await wordRows(r)).map((row) => row.cells), [['pat@example.com', 'Berlin, Germany'], ['pat.dev']], 'hidden phone');
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const old = { ...cv('executive', { contactLayout: 'single', contactStyle: 'bullet' }), updatedAt: Date.UTC(2026, 7, 20) };
    delete old.dataVersion;
    const migrated = normalizeResume(old);
    assert.deepEqual((await wordRows(migrated)).map((row) => row.cells), await pdfRows(migrated), 'old Single: the PDF\'s rows');
  });
});
