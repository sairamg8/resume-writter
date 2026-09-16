// Design → Header → Text Alignment "Center" in the Word résumé (ONB-3): it centres what the PDF
// (= the preview) centres. Classic, Minimal and Executive centre the name, the job title, the
// contact line and the summary; their .docx printed all four flush left whatever was stored.
// Modern's banner and the Sidebar's column take no alignment, in the PDF as in Word.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderDocx, read, itemsWith, loadModule } from './harness.mjs';

before(setup);
after(teardown);

/** Templates whose header takes Header Customization's alignment; Modern and Sidebar do not. */
const STYLED = ['classic', 'minimal', 'executive'];
const FIXED = ['modern', 'sidebar'];
const NAME = 'Pat Sample';
const TITLE = 'Staff Engineer';
const EMAIL = 'pat@example.com';
const SUMMARY = 'Summarising';
/** The header's parts, by a word each prints. */
const PARTS = { name: NAME, title: TITLE, contacts: EMAIL, summary: SUMMARY };

const cv = (template, settings = {}, personal = {}) => resume({
  template,
  settings,
  personal: {
    name: NAME, title: TITLE, email: EMAIL, phone: '+1 555 0100', location: 'Berlin, Germany',
    summary: `<p>${SUMMARY} ten years of shipping</p>`, hiddenFields: [], ...personal,
  },
});

const jc = (p) => /<w:jc w:val="(\w+)"\/>/.exec(p.xml)?.[1] || null;
/** The .docx paragraph that prints `needle`. */
function para(doc, needle) {
  const p = doc.paragraphs.find((q) => q.text.includes(needle));
  assert.ok(p, `"${needle}" in ${JSON.stringify(doc.texts)}`);
  return p;
}
/** Each header part's Word alignment (null: left). */
async function wordAligns(r) {
  const doc = await renderDocx(r);
  return Object.fromEntries(Object.entries(PARTS).map(([part, needle]) => [part, jc(para(doc, needle))]));
}
/** Each header part's x in the PDF, pt: where its first word starts. */
async function pdfXs(r) {
  const pages = await read(await render(r));
  return Object.fromEntries(Object.entries(PARTS).map(([part, needle]) => {
    const [hit] = itemsWith(pages, needle.split(' ')[0]);
    assert.ok(hit, `"${needle}" in the PDF`);
    return [part, hit.x];
  }));
}
/** Which parts the PDF centres: those that move right of where the Left header prints them. */
async function pdfCentred(template, settings, personal) {
  const [left, r] = await Promise.all([pdfXs(cv(template, { headerAlign: 'left' }, personal)), pdfXs(cv(template, settings, personal))]);
  return Object.fromEntries(Object.keys(PARTS).map((part) => [part, r[part] - left[part] > 20]));
}
const all = (value) => Object.fromEntries(Object.keys(PARTS).map((part) => [part, value]));

describe('Word résumé: Design → Header alignment "Center" centres what the PDF centres (ONB-3)', () => {
  it('Classic, Minimal and Executive: the name, title, contact line and summary are centred, as the PDF centres them', async () => {
    for (const template of STYLED) {
      for (const contactStyle of ['icon', 'bar', 'bullet']) {
        const settings = { headerAlign: 'center', contactStyle };
        const at = `${template}, ${contactStyle}`;
        assert.deepEqual(await pdfCentred(template, settings), all(true), `${at}: the PDF centres the whole header`);
        assert.deepEqual(await wordAligns(cv(template, settings)), all('center'), `${at}: Word`);
      }
    }
  });

  it('Modern and Sidebar: a stored "center" moves nothing in the PDF and nothing in Word', async () => {
    for (const template of FIXED) {
      assert.deepEqual(await pdfCentred(template, { headerAlign: 'center' }), all(false), `${template}: the PDF ignores it`);
      assert.deepEqual(await wordAligns(cv(template, { headerAlign: 'center' })), all(null), `${template}: Word`);
    }
  });

  it('Name & Title "Inline", one contact per line, no title or no summary: whatever the header prints is centred', async () => {
    for (const template of STYLED) {
      for (const settings of [{ headerLayout: 'inline' }, { contactLayout: 'single' }, { contactLayout: '2grid' }]) {
        const aligns = await wordAligns(cv(template, { headerAlign: 'center', ...settings }));
        assert.deepEqual(aligns, all('center'), `${template} ${JSON.stringify(settings)}`);
      }
      const doc = await renderDocx(cv(template, { headerAlign: 'center' }, { title: '', summary: '' }));
      assert.equal(doc.paragraphs.some((p) => p.text.includes(SUMMARY) || p.text.includes(TITLE)), false, `${template}: nothing to print`);
      assert.deepEqual([jc(para(doc, NAME)), jc(para(doc, EMAIL))], ['center', 'center'], `${template}: name and contacts, no title or summary`);
      // A summary the user hid prints nowhere; the rest stays centred.
      const hid = await renderDocx(cv(template, { headerAlign: 'center' }, { hiddenFields: ['summary'] }));
      assert.equal(hid.paragraphs.some((p) => p.text.includes(SUMMARY)), false, `${template}: hidden summary`);
      assert.deepEqual([NAME, TITLE, EMAIL].map((n) => jc(para(hid, n))), ['center', 'center', 'center'], `${template}: hidden summary, the rest`);
    }
  });

  it('a centred summary centres its paragraphs and lists; a block aligned in the editor keeps its alignment, as in the PDF', async () => {
    const summary = `<p>${SUMMARY} plain</p><p style="text-align: right;">Righty</p><ul><li>Listed</li></ul><ol><li>Numbered</li></ol>`;
    const aligns = async (headerAlign) => {
      const doc = await renderDocx(cv('classic', { headerAlign }, { summary }));
      return Object.fromEntries([`${SUMMARY} plain`, 'Righty', 'Listed', '1.\tNumbered'].map((t) => [t, jc(para(doc, t))]));
    };
    assert.deepEqual(await aligns('center'), { [`${SUMMARY} plain`]: 'center', Righty: 'right', Listed: 'center', '1.\tNumbered': 'center' });
    // Guard: left, only what the editor aligned is aligned (as before).
    assert.deepEqual(await aligns('left'), { [`${SUMMARY} plain`]: null, Righty: 'right', Listed: null, '1.\tNumbered': null });
    // The PDF: the right-aligned block ends at the right margin whatever the header's alignment.
    for (const headerAlign of ['left', 'center']) {
      const pages = await read(await render(cv('classic', { headerAlign }, { summary })));
      const [righty] = itemsWith(pages, 'Righty');
      assert.ok(pages[0].W - (righty.x + righty.w) < 60, `${headerAlign}: Righty at the right margin (x ${righty.x})`);
    }
  });

  // Guard: unset, Left, or a value the app never writes (imported JSON) print left, as the PDF does.
  it('unset, "left" or an unknown alignment prints the header left in the PDF and in Word (guard)', async () => {
    for (const template of STYLED) {
      for (const headerAlign of [undefined, null, '', 'left', 'right', 'Center']) {
        const at = `${template}, headerAlign ${JSON.stringify(headerAlign)}`;
        const r = cv(template);
        if (headerAlign === undefined) delete r.settings.headerAlign;
        else r.settings.headerAlign = headerAlign;
        const xs = await pdfXs(r);
        const left = await pdfXs(cv(template, { headerAlign: 'left' }));
        assert.deepEqual(xs, left, `${at}: the PDF prints it left`);
        assert.deepEqual(await wordAligns(r), all(null), `${at}: Word`);
      }
    }
  });

  it('a centred header saved by an older build (no dataVersion, 4bc56fe) loads and exports centred', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const template of [...STYLED, ...FIXED]) {
      const old = { ...cv(template, { headerAlign: 'center' }), updatedAt: 5 };
      delete old.dataVersion;
      const r = normalizeResume(old);
      assert.equal(r.settings.headerAlign, 'center', `${template}: kept`);
      const expected = STYLED.includes(template) ? 'center' : null;
      assert.deepEqual(await wordAligns(r), all(expected), `${template}: Word`);
      assert.deepEqual(await pdfCentred(template, r.settings), all(expected === 'center'), `${template}: PDF`);
    }
  });
});
