// The Sidebar's summary in the Word résumé (FIDB-51-VF3-NB2-NB1-NB1). Its PDF (= the preview) prints
// the summary at the top of the main column under an "About Me" section title — Design → Title case
// and Section Headings, as every other title; the .docx printed the summary under the contacts with
// no title. Word now prints the title over it, as buildSection prints any other (buildSectionTitle).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderDocx, read, allItems, drawState, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const SUMMARY = '<p>Summarising ten years</p>';
const cv = (template, settings = {}, personal = {}) => resume({
  template, settings: { accentColor: '#e11d48', ...settings },
  personal: { name: 'Pat Sample', title: 'Engineer', email: 'pat@example.com', summary: SUMMARY, hiddenFields: [], ...personal },
});

/** The Word paragraph just before the summary's. */
async function titleBeforeSummary(r) {
  const { paragraphs } = await renderDocx(r);
  const i = paragraphs.findIndex((p) => p.text.includes('Summarising'));
  assert.ok(i > 0, 'a summary in Word');
  const p = paragraphs[i - 1];
  return { text: p.text, colour: `#${/<w:color w:val="([0-9a-fA-F]{6})"/.exec(p.xml.replace(/<w:pPr>.*?<\/w:pPr>/s, ''))?.[1]?.toLowerCase()}`, shading: /<w:shd /.test(p.xml), bottom: /<w:bottom /.test(p.xml) };
}

describe('the Word résumé prints the Sidebar\'s "About Me" over its summary, as the PDF does (FIDB-51-VF3-NB2-NB1-NB1)', () => {
  it('Sidebar: the title in the PDF\'s case and colour, and the heading style\'s look, right above the summary', async () => {
    const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    for (const [settings, text] of [[{}, 'ABOUT ME'], [{ sectionTitleCase: 'capitalize' }, 'About Me'], [{ headingStyle: 'box' }, 'ABOUT ME'], [{ headingStyle: 'ruled' }, 'ABOUT ME']]) {
      const r = cv('sidebar', settings);
      const bytes = await render(r);
      assert.ok(allItems(await read(bytes)).some((t) => t.str.includes(text.split(' ')[0])), `${JSON.stringify(settings)}: the PDF prints "${text}"`);
      const [ink] = await drawState(bytes, text.split(' ')[0]);
      const word = await titleBeforeSummary(r);
      assert.deepEqual([word.text, word.colour], [text, solid(ink.fill, ink.alpha).toLowerCase()], JSON.stringify(settings));
      if (settings.headingStyle === 'box') assert.ok(word.shading, 'box: shaded');
      if (settings.headingStyle === 'ruled') assert.ok(word.bottom, 'ruled: a rule');
    }
  });

  it('guard: no "About Me" in the other templates, or with the summary hidden or empty', async () => {
    for (const template of TEMPLATES.filter((t) => t !== 'sidebar')) {
      assert.notEqual((await titleBeforeSummary(cv(template))).text.toUpperCase(), 'ABOUT ME', template);
    }
    for (const personal of [{ hiddenFields: ['summary'] }, { summary: '' }]) {
      const doc = await renderDocx(cv('sidebar', {}, personal));
      assert.equal(doc.texts.some((t) => /about me/i.test(t)), false, JSON.stringify(personal));
    }
  });

  it('AUD-17: Sidebar in Single · ATS-safe mode prints no "About Me" and centres the header when headerAlign is center', async () => {
    const r = cv('sidebar', { sidebarSingleColumn: true, headerAlign: 'center' });
    const doc = await renderDocx(r);
    assert.equal(doc.texts.some((t) => /about me/i.test(t)), false, 'no About Me in single column');
    const nameP = doc.paragraphs.find((p) => p.text.includes('Pat Sample'));
    assert.ok(nameP, 'name paragraph exists');
    assert.ok(/<w:jc w:val="center"\/>/.test(nameP.xml), 'name paragraph should be centred in Word');
  });
});

