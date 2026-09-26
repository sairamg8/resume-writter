// The Word exports' contact line prints what the PDF (= the preview) prints (FIDB-51-VF1-NB1).
// The résumé's .docx printed "a  |  b  |  c" in a fixed #64748b whatever Design → Contact Style
// and Text colour: Bullet printed bars, and the values ignored the Text colour the PDF's header
// prints them in. The letter's .docx printed its Bar and Bullet marks on the white page in the
// values' grey, where the PDF draws its light greys. Word draws no icons, so Icon prints as Bar.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, renderDocx, drawState, readDocx, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const ACCENT = '#e11d48';
const CONTACTS = { email: 'pat@example.com', phone: '+1 555 0100', location: 'Berlin, Germany' };
const EMAIL = CONTACTS.email;
/** Templates whose header takes Contact Style (Header Customization); Modern and Sidebar draw icons. */
const STYLED = ['classic', 'minimal', 'executive'];
const BANDED = ['modern', 'sidebar'];
const STYLES = ['icon', 'bar', 'bullet'];
/** The page's Bar grey: what Word prints Icon's stand-in bars in on the white page. */
const BAR_GREY = 'cccccc';
const MARK = /^\s*[|•]\s*$/;

const cv = (template, settings = {}) => resume({
  template,
  settings: { accentColor: ACCENT, ...settings },
  personal: { name: 'Pat Sample', title: 'Staff Engineer', ...CONTACTS, hiddenFields: [] },
  coverLetter: { body: '<p>Dear Sarah,</p>', date: '2026-01-15' },
});

/** The .docx paragraph that prints the contacts, as its values' and its marks' [text, colour] runs. */
function contactLine(doc) {
  const p = doc.paragraphs.find((q) => q.text.includes(EMAIL));
  assert.ok(p, doc.texts.join(' | '));
  const runs = p.xml.split('</w:r>')
    .map((run) => [run.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/)?.[1], run.match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase()])
    .filter(([text]) => text !== undefined);
  return { values: runs.filter(([t]) => !MARK.test(t)), marks: runs.filter(([t]) => MARK.test(t)) };
}
/** The marks' glyphs and colours, each once. */
const distinct = (runs) => [...new Set(runs.map(([t, c]) => `${t.trim()} ${c}`))];
const letterDocx = async (r) => {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  return readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
};
/** A letter on `template`'s band with `settings`, its contacts one line of Icon (printed as bars). */
const bandLetter = (template, settings) => {
  const r = cv(template, settings);
  r.coverLetter = { ...r.coverLetter, headerStyle: 'icon', headerLayout: 'justify' };
  return r;
};
/** The PDF's fill for `needle`'s runs, each once, without '#'. */
const fills = async (bytes, needle) => [...new Set((await drawState(bytes, needle)).map((h) => h.fill.slice(1)))];

describe('the résumé\'s Word header prints the PDF\'s contact marks and colours (FIDB-51-VF1-NB1)', () => {
  it('Classic, Minimal and Executive: Bullet prints bullets and Bar bars, in the PDF\'s greys; the values in the PDF\'s colour; Icon prints as Bar', async () => {
    for (const template of STYLED) {
      for (const contactStyle of STYLES) {
        for (const textColor of ['#111111', '#1e3a8a', '#374151', '#7c2d12']) {
          const at = `${template}, ${contactStyle}, Text colour ${textColor}`;
          const r = cv(template, { contactStyle, textColor });
          const pdf = await render(r);
          const [value] = await fills(pdf, EMAIL);
          const [bars, bullets] = [await fills(pdf, '|'), await fills(pdf, '•')];
          const { values, marks } = contactLine(await renderDocx(r));
          assert.deepEqual([...new Set(values.map(([, c]) => c))], [value], `${at}: the values`);
          assert.equal(marks.length, 2, `${at}: a mark between each two values`);
          const expected = { icon: `| ${BAR_GREY}`, bar: `| ${bars[0]}`, bullet: `• ${bullets[0]}` }[contactStyle];
          assert.deepEqual(distinct(marks), [expected], `${at}: the marks (PDF bars ${bars}, bullets ${bullets})`);
        }
      }
    }
  });

  it('Modern and Sidebar: bars whatever Contact Style is stored (the PDF draws icons), on the band in its colours', async () => {
    for (const template of BANDED) {
      for (const contactStyle of STYLES) {
        for (const textColor of ['#1e3a8a', '#374151']) {
          const at = `${template}, ${contactStyle}, Text colour ${textColor}`;
          const r = cv(template, { contactStyle, textColor });
          const pdf = await render(r);
          assert.deepEqual([await fills(pdf, '|'), await fills(pdf, '•')], [[], []], `${at}: the PDF draws no marks`);
          // Word draws the band (R2-137): the values and bars in the band's colours, as the letter's
          // letterhead prints them on the same band with Icon (below: the Bar letter's PDF bars).
          const { values, marks } = contactLine(await renderDocx(r));
          const letter = contactLine(await letterDocx(bandLetter(template, { contactStyle, textColor })));
          assert.deepEqual([...new Set(values.map(([, c]) => c))], [...new Set(letter.values.map(([, c]) => c))], `${at}: the values`);
          assert.equal(marks.length, 2, `${at}: a bar between each two values`);
          assert.deepEqual(distinct(marks), distinct(letter.marks), `${at}: the marks`);
        }
      }
    }
  });

  it('saved data with no Contact Style or Text colour (older builds, imports) prints as its PDF: icons as bars, the template\'s own text grey', async () => {
    const { resolveTemplateSettings } = await loadModule('/src/templates/pdf/shared/templateSettings.js');
    const { letterGrey } = await loadModule('/src/templates/pdf/shared/letterhead.js');
    for (const template of [...STYLED, ...BANDED]) {
      for (const stored of [undefined, '', null]) {
        const r = cv(template);
        delete r.settings.textColor;
        if (stored === undefined) delete r.settings.contactStyle;
        else r.settings.contactStyle = stored;
        const at = `${template}, contactStyle ${JSON.stringify(stored)}`;
        const { values, marks } = contactLine(await renderDocx(r));
        if (BANDED.includes(template)) {
          // On the band (R2-137): the band's colours, as the Icon letter prints them there.
          const letter = contactLine(await letterDocx(bandLetter(template, r.settings)));
          assert.deepEqual([...new Set(values.map(([, c]) => c))], [...new Set(letter.values.map(([, c]) => c))], `${at}: the values`);
          assert.deepEqual(distinct(marks), distinct(letter.marks), `${at}: the marks`);
          continue;
        }
        const grey = STYLED.includes(template)
          ? (await fills(await render(r), EMAIL))[0]
          : letterGrey(resolveTemplateSettings(r.settings, template).textColor).slice(1);
        assert.deepEqual([...new Set(values.map(([, c]) => c))], [grey], `${at}: the values`);
        assert.deepEqual(distinct(marks), [`| ${BAR_GREY}`], `${at}: the marks`);
      }
    }
  });
});

describe('the letter\'s Word marks are the PDF\'s (FIDB-51-VF1-NB1)', () => {
  it('Classic, Minimal and Executive: Bar and Bullet in the page\'s greys the PDF draws, Icon as Bar; the values unchanged', async () => {
    for (const template of STYLED) {
      for (const headerStyle of STYLES) {
        for (const textColor of ['#111111', '#1e3a8a']) {
          const at = `${template} letter, ${headerStyle}, Text colour ${textColor}`;
          const r = cv(template, { textColor });
          r.coverLetter = { ...r.coverLetter, headerStyle, headerLayout: 'justify' };
          const pdf = await renderCover(r);
          const [value] = await fills(pdf, EMAIL);
          const [bars, bullets] = [await fills(pdf, '|'), await fills(pdf, '•')];
          const { values, marks } = contactLine(await letterDocx(r));
          assert.deepEqual([...new Set(values.map(([, c]) => c))], [value], `${at}: the values`);
          const expected = { icon: `| ${BAR_GREY}`, bar: `| ${bars[0]}`, bullet: `• ${bullets[0]}` }[headerStyle];
          assert.deepEqual(distinct(marks), [expected], `${at}: the marks (PDF bars ${bars}, bullets ${bullets})`);
        }
      }
    }
  });

  // Guard: on Modern's and the Sidebar's band Icon's bars already took the band's mark colour
  // (VFIDB-51-0) — the colour the PDF draws Bar's bars in there.
  it('Modern and Sidebar: Icon prints the bars the Bar letter\'s PDF draws on the band', async () => {
    for (const [template, settings] of [['modern', {}], ['modern', { accentColor: '#fde68a', headerTextColor: '#1e293b' }], ['sidebar', {}], ['sidebar', { sidebarBg: '#f1f5f9' }]]) {
      const at = `${template} ${JSON.stringify(settings)}`;
      const bar = cv(template, settings);
      bar.coverLetter = { ...bar.coverLetter, headerStyle: 'bar', headerLayout: 'justify' };
      const [drawn] = await fills(await renderCover(bar), '|');
      const icon = cv(template, settings);
      icon.coverLetter = { ...icon.coverLetter, headerStyle: 'icon', headerLayout: 'justify' };
      assert.deepEqual(distinct(contactLine(await letterDocx(icon)).marks), [`| ${drawn}`], at);
    }
  });
});
