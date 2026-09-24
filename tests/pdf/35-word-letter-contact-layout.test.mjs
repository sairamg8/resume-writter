// Cover Letter → Contact Layout in the Word letter (FIDB-51-VF1-NB1-NB2-NB1). The letter's PDF (= the
// preview) lays its contacts out as Single (one a line) or 2 Grid (two a row), as the résumé's
// header does; its .docx always printed them as one line — R1-10 had taken that as a simplification,
// which the résumé's .docx no longer makes (c7cd15a). Both now read contactRows (wordExportContacts.js).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, renderCover, read, loadModule, readDocx, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const PERSONAL = { name: 'Pat Sample', title: 'Staff Engineer', email: 'pat@example.com', phone: '+1 555 0100', location: 'Berlin, Germany', website: 'pat.dev', hiddenFields: [] };
const VALUES = ['pat@example.com', '+1 555 0100', 'Berlin, Germany', 'pat.dev'];
const isContact = (s) => /pat@|555|Berlin|pat\.dev/.test(s);

const letter = (template, coverLetter = {}, settings = {}) => resume({
  template, settings: { accentColor: '#e11d48', ...settings }, personal: PERSONAL,
  coverLetter: { body: '<p>Dear Sarah,</p>', date: '2026-01-15', fieldsPosition: 'below-all', ...coverLetter },
});

/** The letter's contact paragraphs: cells (split at tabs, marks dropped), tab stops, alignment, bullets. */
async function wordRows(r) {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  const doc = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
  return doc.paragraphs.filter((p) => isContact(p.text)).map((p) => {
    const body = p.xml.replace(/<w:pPr>.*?<\/w:pPr>/s, '');
    const text = [...body.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>/g)].map((m) => (m[1] === undefined ? '\t' : m[1])).join('');
    return {
      cells: text.split('\t').map((c) => c.replace(/•/g, '').trim()).filter(Boolean),
      stops: [...p.xml.matchAll(/<w:tab w:val="(\w+)" w:pos="(\d+)"\/>/g)].map((m) => m[1]),
      jc: /<w:jc w:val="(\w+)"\/>/.exec(p.xml)?.[1] || null,
      bullets: (text.match(/•/g) || []).length,
    };
  });
}
/** The letter PDF's contact rows, top down (bullets dropped). */
async function pdfRows(r) {
  const [page] = await read(await renderCover(r));
  const rows = new Map();
  for (const t of page.items.filter((i) => isContact(i.str))) {
    const y = [...rows.keys()].find((k) => Math.abs(k - t.y) < 2) ?? t.y;
    rows.set(y, [...(rows.get(y) || []), t]);
  }
  return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.str.replace(/•/g, '').trim()).filter(Boolean));
}

describe('the Word letter prints Cover Letter → Contact Layout (FIDB-51-VF1-NB1-NB2-NB1)', () => {
  it('every template: Single a paragraph a contact, 2 Grid a paragraph a row of two — the letter PDF\'s rows', async () => {
    for (const template of TEMPLATES) {
      for (const headerStyle of ['bullet', 'icon']) {
        for (const headerLayout of ['single', '2grid']) {
          const at = `${template} ${headerStyle} ${headerLayout}`;
          // Left-aligned: every template's own letterhead but Academic's, which is centred (T8).
          const r = letter(template, { headerLayout, headerStyle }, { headerAlign: 'left' });
          const rows = await wordRows(r);
          assert.deepEqual(rows.map((row) => row.cells), await pdfRows(r), `${at}: the PDF's rows`);
          assert.deepEqual(rows.map((row) => row.cells), headerLayout === 'single' ? VALUES.map((v) => [v]) : [VALUES.slice(0, 2), VALUES.slice(2)], at);
          assert.deepEqual(rows.map((row) => row.stops.length), rows.map(() => (headerLayout === '2grid' ? 1 : 0)), `${at}: tab stops`);
          assert.equal(rows.reduce((n, row) => n + row.bullets, 0), headerStyle === 'bullet' ? 4 : 0, `${at}: bullets`);
        }
      }
    }
  });

  it('a centred letterhead: Single centres each contact; 2 Grid centres each value on its cell by centre tab stops', async () => {
    for (const template of ['classic', 'minimal', 'executive']) {
      const single = await wordRows(letter(template, { headerLayout: 'single' }, { headerAlign: 'center' }));
      assert.deepEqual(single.map((row) => row.jc), VALUES.map(() => 'center'), `${template} single`);
      const grid = await wordRows(letter(template, { headerLayout: '2grid' }, { headerAlign: 'center' }));
      assert.deepEqual(grid.map((row) => [row.stops, row.jc]), [[['center', 'center'], null], [['center', 'center'], null]], `${template} 2grid`);
    }
  });

  it('Justify, unset (the résumé\'s layout) and an unknown layout: one line, as before', async () => {
    for (const template of TEMPLATES) {
      for (const headerLayout of ['justify', undefined, 'rows']) {
        const rows = await wordRows(letter(template, { headerLayout, headerStyle: 'bar' }));
        assert.deepEqual(rows.map((row) => row.cells), [[VALUES.join('  |  ')]], `${template} ${headerLayout}`);
      }
      // Unset takes the résumé's own Contact Layout (letterContactFormat), in the PDF and in Word.
      const inherited = letter(template, {}, { contactLayout: 'single' });
      assert.deepEqual((await wordRows(inherited)).map((row) => row.cells), await pdfRows(inherited), `${template}: the résumé's Single`);
    }
  });
});
