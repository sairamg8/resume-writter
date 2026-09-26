// R2-137 — the header's band in Word. The PDF (= the preview) prints Modern's header on its accent
// banner and the two-column Sidebar's on its panel colour; the Word résumé printed both on the white
// page, in the page's colours, and the Export menu said so. Now Word draws the band as the letter's
// letterhead already did: a table shaded in the band's fill — Modern's inside the margins, padded by
// Banner top & bottom and Banner sides; the Sidebar's running 15 pt into the margins — holding the
// photo, name, title and contacts (and Modern's summary) in the colours the PDF prints there.
// The letter's contacts sat under the name at Right of Name, its default Fields Position, where the
// PDF sets them beside it: now a two-cell table, the letter's Name ↔ Contacts (contactsSideGap)
// between them, framed by the band or the rule; under the name where a name word would not fit.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, drawState, readDocx, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const ACCENT = '#e11d48';
const NAME = 'Pat Sample';
const TITLE = 'Staff Engineer';
const EMAIL = 'pat@example.com';
const SUMMARY = 'Summarising';
/** A 2 × 2 JPEG, as the editor stores an upload. */
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAACAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AGn//2Q==';

const cv = (template, settings = {}, personal = {}, coverLetter = {}) => resume({
  template,
  settings: { accentColor: ACCENT, ...settings },
  personal: { name: NAME, title: TITLE, email: EMAIL, phone: '+1 555 0100', summary: `<p>${SUMMARY} ten years</p>`, hiddenFields: [], ...personal },
  coverLetter: { body: '<p>Dear Sarah,</p>', date: '2026-01-15', ...coverLetter },
  sections: [experience([{}])],
});

async function docx(r, letter = false) {
  const { renderResumeDocx, renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  return readDocx(new Uint8Array(await (await (letter ? renderCoverLetterDocx : renderResumeDocx)(r)).arrayBuffer()));
}

/** The .docx's tables, in order: their properties, column widths and cells (xml, text, fill, margins). */
function tables(xml) {
  return [...xml.matchAll(/<w:tbl>(.*?)<\/w:tbl>/gs)].map(([, tbl]) => ({
    xml: tbl,
    start: xml.indexOf(tbl),
    tblPr: /<w:tblPr>(.*?)<\/w:tblPr>/s.exec(tbl)?.[1] || '',
    columns: [...tbl.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) => Number(m[1])),
    rows: [...tbl.matchAll(/<w:tr>(.*?)<\/w:tr>/gs)].map(([, tr]) => [...tr.matchAll(/<w:tc>(.*?)<\/w:tc>/gs)].map(([, tc]) => {
      const tcPr = /<w:tcPr>(.*?)<\/w:tcPr>/s.exec(tc)?.[1] || '';
      const mar = /<w:tcMar>(.*?)<\/w:tcMar>/s.exec(tcPr)?.[1] || '';
      const side = (k) => Number(new RegExp(`<w:${k} w:type="dxa" w:w="(-?\\d+)"\\/>`).exec(mar)?.[1] ?? NaN);
      return {
        xml: tc,
        text: [...tc.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''),
        fill: /<w:shd [^>]*w:fill="([0-9a-fA-F]{6})"/.exec(tcPr)?.[1]?.toLowerCase() ?? null,
        margins: { top: side('top'), left: side('left'), bottom: side('bottom'), right: side('right') },
      };
    })),
  }));
}
/** The table that holds `text`, or undefined. */
const tableWith = (xml, text) => tables(xml).find((t) => t.xml.includes(`>${text}`));
/** The colour of the run that prints `text`, 'rrggbb'. */
const colourOf = (xml, text) => (xml.split('</w:r>').find((run) => run.includes(`>${text}`)) || '').match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase();
/** Within 2 per channel: the PDF stores an opacity in 255ths. */
const near = (a, b) => a && b && [0, 2, 4].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 2);

/** The colour the PDF draws `word` in, opaque on `ground` (its band). */
async function pdfOn(bytes, word, ground) {
  const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
  const [hit] = await drawState(bytes, word);
  assert.ok(hit, `"${word}" in the PDF`);
  return solid(hit.fill, hit.alpha, ground).slice(1).toLowerCase();
}

describe('the Word résumé draws Modern\'s and the Sidebar\'s header on its band (R2-137)', () => {
  it('Modern: one shaded table in the accent, padded 15 / 18 pt, holding the name, title, contacts and summary', async () => {
    const { wordContentTwips } = await loadModule('/src/utils/wordExportUtils.js');
    const r = cv('modern');
    const { xml } = await docx(r);
    const band = tableWith(xml, NAME);
    assert.ok(band, 'the header is in a table');
    const cells = band.rows.flat();
    assert.deepEqual(cells.map((c) => c.fill), cells.map(() => ACCENT.slice(1)), 'every cell shaded in the accent');
    for (const text of [NAME, TITLE, EMAIL, SUMMARY]) assert.ok(cells.some((c) => c.text.includes(text)), `${text} on the band`);
    assert.equal(band.columns.reduce((a, b) => a + b, 0), wordContentTwips(r.settings), 'as wide as the page\'s text');
    assert.doesNotMatch(band.tblPr, /<w:tblInd /, 'inside the margins');
    const [text] = band.rows[0];
    const [summary] = band.rows.at(-1);
    assert.deepEqual([text.margins.top, text.margins.left, text.margins.right], [300, 360, 360], 'Banner top 15 pt, sides 18 pt');
    assert.equal(summary.margins.bottom, 300 - 20, 'its padding under the summary, less the summary\'s own 1 pt');
    assert.ok(!xml.slice(band.start + band.xml.length).split('PROFESSIONAL')[0].includes(SUMMARY), 'the summary is not printed again under it');
  });

  it('Modern: Banner top & bottom and Banner sides pad the band', async () => {
    const band = tableWith((await docx(cv('modern', { headerPadY: 40, headerPadX: 40 }, { summary: '' }))).xml, NAME);
    const [text] = band.rows[0];
    // 30 pt; under the contacts, less their own 4 pt after them.
    assert.deepEqual(text.margins, { top: 600, left: 600, bottom: 600 - 80, right: 600 });
  });

  it('Modern: the name, title, contacts and summary in the colours the PDF prints on the banner', async () => {
    for (const settings of [{}, { nameColor: '#fde68a', jobTitleColor: '#bfdbfe' }, { headerTextColor: '#fef3c7' }]) {
      const r = cv('modern', settings);
      const { xml } = await docx(r);
      const bytes = await render(r);
      for (const [text, word] of [[NAME, 'Pat'], [TITLE, 'Staff'], [EMAIL, EMAIL], [SUMMARY, SUMMARY]]) {
        const [pdf, got] = [await pdfOn(bytes, word, ACCENT), colourOf(xml, text)];
        assert.ok(near(got, pdf), `${JSON.stringify(settings)} ${text}: Word ${got}, the PDF ${pdf}`);
      }
    }
  });

  it('Modern: a photo beside the name sits on the band, ringed white as on the banner; the summary spans the band under both', async () => {
    const { xml } = await docx(cv('modern', { photoBorder: 'accent' }, { photo: JPEG }));
    const band = tableWith(xml, NAME);
    const [photo, text] = band.rows[0];
    assert.match(photo.xml, /<w:drawing>/);
    assert.ok(text.text.includes(NAME));
    assert.deepEqual([photo.fill, text.fill], [ACCENT.slice(1), ACCENT.slice(1)]);
    assert.equal(photo.margins.left, 360, 'Banner sides left of the photo');
    const [summary] = band.rows[1];
    assert.match(summary.xml, /<w:gridSpan w:val="2"\/>/);
    assert.ok(summary.text.includes(SUMMARY));
    const ring = /<a:ln w="\d+"[^>]*>.*?<a:srgbClr val="(\w+)"/s.exec(photo.xml)?.[1]?.toLowerCase();
    assert.equal(ring, 'ffffff', 'the accent ring reads on the accent banner');
  });

  it('Sidebar: shaded in the panel colour, running 15 pt into the margins; About Me and the summary on the page under it', async () => {
    const { wordContentTwips } = await loadModule('/src/utils/wordExportUtils.js');
    const r = cv('sidebar');
    const { xml } = await docx(r);
    const band = tableWith(xml, NAME);
    assert.ok(band, 'the header is in a table');
    const [cell] = band.rows[0];
    assert.equal(cell.fill, '1e293b');
    assert.match(band.tblPr, /<w:tblInd w:type="dxa" w:w="-300"\/>/);
    assert.equal(band.columns[0], wordContentTwips(r.settings) + 600);
    assert.deepEqual([cell.margins.left, cell.margins.right, cell.margins.top], [300, 300, 300], 'its text on the margins');
    assert.ok(cell.text.includes(EMAIL) && !cell.text.includes(SUMMARY), 'the contacts on the band, the summary not');
    const bytes = await render(r);
    for (const [text, word] of [[NAME, 'Pat'], [TITLE, 'Staff'], [EMAIL, EMAIL]]) {
      const [pdf, got] = [await pdfOn(bytes, word, '#1e293b'), colourOf(xml, text)];
      assert.ok(near(got, pdf), `${text}: Word ${got}, the PDF ${pdf}`);
    }
    const after = xml.slice(band.start + band.xml.length);
    assert.ok(after.indexOf('ABOUT ME') >= 0 && after.indexOf('ABOUT ME') < after.indexOf(SUMMARY), 'About Me over the summary, after the band');
  });

  it('guard: Classic, Banner and the Sidebar\'s Single · ATS-safe print their header on the page, as before', async () => {
    for (const [template, settings] of [['classic', {}], ['banner', {}], ['sidebar', { sidebarSingleColumn: true }]]) {
      const { xml } = await docx(cv(template, settings));
      assert.equal(tableWith(xml, NAME), undefined, `${template} ${JSON.stringify(settings)}: no band`);
    }
  });
});

describe('the Word letter sets its contacts beside the name at Right of Name (R2-137)', () => {
  it('Right of Name (the default): a two-cell table — the name and title, then the contacts right-aligned, 12 pt apart', async () => {
    const { xml, texts } = await docx(cv('classic'), true);
    const head = tableWith(xml, NAME);
    assert.ok(head, 'a table');
    const [left, right] = head.rows[0];
    assert.equal(left.text, `${NAME}${TITLE}`);
    assert.ok(right.text.includes(EMAIL));
    assert.equal(right.margins.left, 240, 'the letter\'s own 12 pt');
    assert.match(right.xml, /<w:jc w:val="right"\/>/);
    assert.equal(left.fill, null, 'no band on Classic');
    assert.deepEqual(texts.slice(0, 3).map((t) => t.split(' ')[0]), ['Pat', 'Staff', 'pat@example.com'], 'it reads name, title, contacts');
    // Cover Letter → Header Layout → Name ↔ Contacts.
    const [, set] = tableWith((await docx(cv('classic', { contactsSideGap: 32 }), true)).xml, NAME).rows[0];
    assert.equal(set.margins.left, 480, '32 px = 24 pt');
  });

  it('a 2 Grid sits against the right margin, as wide as its two cells: the name side takes the rest', async () => {
    const head = tableWith((await docx(cv('classic', {}, {}, { headerLayout: '2grid' }), true)).xml, NAME);
    assert.ok(head, 'a table');
    const [name, contacts] = head.columns;
    assert.ok(contacts < name, `the contacts' column ${contacts} is narrower than the name's ${name}`);
    // Two 46 % cells and the 18 pt gap: at least the 225 pt row, plus the 12 pt Name ↔ Contacts.
    assert.ok(contacts >= (225 + 12) * 20 && contacts <= (260 + 12) * 20, String(contacts));
  });

  it('a 2 Grid beside a name and title that would wrap goes under the name, as the PDF\'s', async () => {
    const title = 'Senior Staff Software Engineer, Platform Infrastructure';
    const { xml } = await docx(cv('classic', {}, { title }, { headerLayout: '2grid' }), true);
    assert.equal(tables(xml).length, 0);
    // Single keeps them beside the name: its contacts need one item's width, not two cells'.
    assert.ok(tableWith((await docx(cv('classic', {}, { title }, { headerLayout: 'single' }), true)).xml, NAME));
  });

  it('Below Name, a centred letterhead, or a name word that does not fit beside the contacts: under the name, no table', async () => {
    for (const [settings, personal, coverLetter] of [
      [{}, {}, { fieldsPosition: 'below-name' }],
      [{ headerAlign: 'center' }, {}, {}],
      [{}, { name: 'M'.repeat(40) }, {}],
    ]) {
      const { xml } = await docx(cv('classic', settings, personal, coverLetter), true);
      assert.equal(tables(xml).length, 0, JSON.stringify([settings, personal, coverLetter]));
    }
  });

  it('Modern: both cells shaded in the accent, the band\'s padding the cells\' outer margins', async () => {
    const [left, right] = tableWith((await docx(cv('modern'), true)).xml, NAME).rows[0];
    assert.deepEqual([left.fill, right.fill], [ACCENT.slice(1), ACCENT.slice(1)]);
    assert.deepEqual([left.margins.top, left.margins.left, left.margins.bottom], [300, 360, 300]);
    assert.deepEqual([right.margins.right, right.margins.left], [360, 240]);
  });

  it('Sidebar: its band runs 15 pt into the margins', async () => {
    const head = tableWith((await docx(cv('sidebar'), true)).xml, NAME);
    assert.match(head.tblPr, /<w:tblInd w:type="dxa" w:w="-300"\/>/);
    assert.deepEqual(head.rows[0].map((c) => c.fill), ['1e293b', '1e293b']);
  });

  it('a rule: the table\'s bottom border, the Text ↔ Border gap under the text, the letter\'s 16 pt under it', async () => {
    const { xml } = await docx(cv('executive'), true);
    const head = tableWith(xml, NAME);
    const bottom = /<w:tblBorders>.*?<w:bottom ([^>]*)\/>/s.exec(head.tblPr)?.[1] || '';
    assert.match(bottom, /w:val="double"/);
    assert.match(bottom, new RegExp(`w:color="${ACCENT.slice(1)}"`, 'i'));
    assert.match(bottom, /w:sz="6"/);
    assert.deepEqual(head.rows[0].map((c) => c.margins.bottom), [240, 240], '12 pt over the rule');
    const gap = xml.slice(head.start + head.xml.length).split('</w:p>')[0];
    assert.match(gap, /w:line="320"/, 'a 16 pt gap under it');
  });
});
