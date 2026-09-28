// R4-DOUT-11 — Languages in Word printed "English — Native" and ignored Section Options → Level. The PDF
// (LanguagesSection, PdfSidebarColumn) prints the language and its proficiency apart, no dash — the
// proficiency at the right of the column, beside it on Compact, a gap away when centred — and Level Dots
// or Bar draws its mark in the accent in front of the proficiency (the Sidebar's side column: on a line
// under them). Word now prints the same: a right tab (no " — "), and the level as glyphs in the accent —
// Dots "●●●○○", Bar "▰▰▰▱▱" — for a proficiency the scale knows. Markdown and ATS text stay words only.
// Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, renderDocx, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const LANGS = [
  { language: 'Portuguese', proficiency: 'Native' },
  { language: 'English', proficiency: 'Fluent' },
  { language: 'Spanish', proficiency: 'Conversational' },
  // A proficiency the scale does not know: its words, no mark.
  { language: 'Latin', proficiency: 'Reading only' },
];

const cv = (template, levelStyle, extra = {}) => resume({
  template,
  settings: { accentColor: '#aa3300' },
  sections: [section('languages', LANGS, { ...(levelStyle ? { levelStyle } : {}), ...extra })],
});

/** The paragraph that starts with `language`. */
const para = (doc, language) => doc.paragraphs.find((p) => p.text.startsWith(language));

describe('Word: Languages print as the PDF does — no dash, the level as glyphs (R4-DOUT-11)', () => {
  it('Level Text (unset): the proficiency at a right tab, no " — "', async () => {
    const doc = await renderDocx(cv('classic'));
    assert.ok(doc.texts.includes('Portuguese\tNative'), doc.texts.join(' | '));
    assert.ok(doc.texts.includes('Latin\tReading only'), doc.texts.join(' | '));
    for (const l of LANGS) assert.ok(!para(doc, l.language).text.includes(' — '), para(doc, l.language).text);
    assert.match(para(doc, 'Portuguese').xml, /<w:tab w:val="right" w:pos="\d+"\/>/);
  });

  it('one column: the proficiency\'s right tab is the dates\' own, flush with the right margin as the PDF\'s now is (R4-DOUT-14)', async () => {
    const doc = await renderDocx(resume({
      template: 'classic',
      sections: [experience([{ company: 'Harbourlight' }]), section('languages', LANGS, { columns: 1 })],
    }));
    const tabOf = (p) => /<w:tab w:val="right" w:pos="(\d+)"\/>/.exec(p.xml)?.[1];
    const date = tabOf(doc.paragraphs.find((p) => p.text.includes('Harbourlight')));
    assert.ok(date, 'the entry\'s date is at a right tab');
    assert.equal(tabOf(para(doc, 'Portuguese')), date, 'no 12 pt inset');
  });

  it('Level Dots: five dots, the level\'s filled, in the accent in front of the proficiency; nothing for an unknown one', async () => {
    const doc = await renderDocx(cv('classic', 'dots'));
    for (const want of ['Portuguese\t●●●●● Native', 'English\t●●●●○ Fluent', 'Spanish\t●●●○○ Conversational', 'Latin\tReading only']) {
      assert.ok(doc.texts.includes(want), `${want}: ${doc.texts.join(' | ')}`);
    }
    const run = doc.xml.split('</w:r>').find((r) => r.includes('>●●●●○<'));
    assert.ok(run, 'the dots are a run of their own');
    assert.match(run, /<w:color w:val="aa3300"\/>/i);
  });

  it('Level Bar: a five-step bar filled to the level', async () => {
    const doc = await renderDocx(cv('classic', 'bar'));
    assert.ok(doc.texts.includes('Spanish\t▰▰▰▱▱ Conversational'), doc.texts.join(' | '));
    assert.ok(doc.texts.includes('Latin\tReading only'), doc.texts.join(' | '));
  });

  it('the Sidebar\'s side column: the mark on a line of its own under the language and its proficiency', async () => {
    const doc = await renderDocx(cv('sidebar', 'dots'));
    assert.ok(doc.texts.includes('English\tFluent\n●●●●○'), doc.texts.join(' | '));
  });

  it('centred, and on Compact: the proficiency beside the language, a gap away, no tab', async () => {
    for (const r of [cv('classic', 'dots', { alignment: 'center' }), cv('compact', 'dots')]) {
      const doc = await renderDocx(r);
      assert.ok(doc.texts.includes('English ●●●●○ Fluent'), `${r.template}: ${doc.texts.join(' | ')}`);
      assert.doesNotMatch(para(doc, 'English').xml, /<w:tab w:val="right"/);
    }
  });

  it('Markdown and ATS text stay words only, the same with a Level as without', async () => {
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
    const plain = cv('classic');
    for (const style of ['dots', 'bar']) {
      const drawn = { ...plain, sections: plain.sections.map((x) => ({ ...x, settings: { ...x.settings, levelStyle: style } })) };
      for (const [name, out] of [['Markdown', generateMarkdownResume], ['ATS text', generateAtsPlainText]]) {
        assert.doesNotMatch(out(drawn), /[●○▰▱]/, `${style} ${name}`);
        assert.equal(out(drawn), out(plain), `${style} ${name}`);
      }
    }
  });
});
