// Header Customization → Header Bottom Border and Thickness in the Word résumé (FIDB-51-VF3-NB2).
// Classic, Minimal and Executive draw the rule under the whole header — name, title, contacts and
// summary — in the accent at its Thickness, its Text ↔ Border gap under the text, in the PDF (= the
// preview). The .docx drew none of it, and instead a fixed grey 0.5 pt line above the summary that
// no PDF prints. The Word letter follows the rule since af1292a; now the résumé does too.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderDocx, loadModule, TEMPLATES } from './harness.mjs';
import { painted } from './extractors.mjs';

before(setup);
after(teardown);

const RULED = ['classic', 'minimal', 'executive'];
const BANDED = ['modern', 'sidebar'];
const ACCENT = '#e11d48';
const SUMMARY = '<p>Ten years of shipping</p>';

const cv = (template, settings = {}, summary = SUMMARY) => resume({
  template,
  sections: [],
  settings: { accentColor: ACCENT, ...settings },
  personal: { name: 'Pat Sample', title: 'Staff Engineer', email: 'pat@example.com', summary, hiddenFields: [] },
});
const ON = (width, extra = {}) => ({ showHeaderBorder: true, headerBorderWidth: width, ...extra });

/** The rules the PDF draws across the page: [{ colour, width }]. */
async function pdfRules(r) {
  return (await painted(await render(r)))
    .filter((p) => p.paint === 'stroke' && p.x1 - p.x0 > 300 && p.y1 - p.y0 < 1)
    .map((p) => ({ colour: p.colour.toLowerCase(), width: Math.round(p.width * 100) / 100 }));
}
/**
 * The .docx paragraphs' bottom borders, top down: [{ colour, size, before, text, last }] — every
 * paragraph, empty ones too (readDocx's `paragraphs` leaves those out; a rule is one).
 */
async function wordRules(r) {
  const all = (await renderDocx(r)).xml.split('</w:p>').slice(0, -1);
  return all.flatMap((xml, index) => {
    const b = /<w:bottom w:val="(\w+)" w:color="([0-9a-fA-F]{6})" w:sz="(\d+)" w:space="(\d+)"\/>/.exec(xml);
    if (!b) return [];
    const text = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    return [{ colour: `#${b[2].toLowerCase()}`, size: Number(b[3]), before: Number(/<w:spacing [^>]*w:before="(\d+)"/.exec(xml)?.[1] ?? 0), text, last: index === all.length - 1 }];
  });
}
/** Word's border size, eighths of a point, as Word takes it (2–96). */
const eighths = (pt) => Math.min(96, Math.max(2, Math.round(pt * 8)));

describe('the Word résumé draws the header\'s bottom rule where the PDF does (FIDB-51-VF3-NB2)', () => {
  it('Classic, Minimal and Executive, border on: one rule under the whole header, in the PDF\'s colour and Thickness', async () => {
    for (const template of RULED) {
      for (const width of [1, 2, 6]) {
        for (const summary of [SUMMARY, '']) {
          const at = `${template}, ${width} pt, ${summary ? 'a summary' : 'no summary'}`;
          const r = cv(template, ON(width), summary);
          const [pdf] = await pdfRules(r);
          assert.deepEqual(pdf, { colour: ACCENT, width }, `${at}: the PDF`);
          const word = await wordRules(r);
          assert.equal(word.length, 1, `${at}: one rule in Word: ${JSON.stringify(word)}`);
          assert.deepEqual([word[0].colour, word[0].size, word[0].text, word[0].last], [pdf.colour, eighths(width), '', true], `${at}: Word's rule`);
        }
      }
    }
  });

  it('the rule sits the header\'s Text ↔ Border gap under the text: 12 pt unset, a set one as the PDF prints it', async () => {
    const { resolveTemplateSettings } = await loadModule('/src/templates/pdf/shared/templateSettings.js');
    for (const template of RULED) {
      for (const headerRuleGap of [undefined, 0, 8, 40, 1000]) {
        const settings = ON(2, headerRuleGap === undefined ? {} : { headerRuleGap });
        const gap = resolveTemplateSettings({ accentColor: ACCENT, ...settings }, template).headerGaps.headerRuleGap;
        const [rule] = await wordRules(cv(template, settings));
        assert.equal(rule.before, Math.round(gap * 20), `${template}, ${headerRuleGap} px: ${gap} pt above the rule`);
      }
    }
  });

  it('border off, Modern and Sidebar, a Thickness no rule is drawn at: no rule in Word as in the PDF — and no grey line above the summary', async () => {
    const cases = [
      ...RULED.flatMap((t) => [[t, { showHeaderBorder: false }], [t, ON(-3)], [t, ON('abc')]]),
      ...BANDED.flatMap((t) => [[t, ON(6)], [t, { showHeaderBorder: false }], [t, {}]]),
    ];
    for (const [template, settings] of cases) {
      const at = `${template} ${JSON.stringify(settings)}`;
      const r = cv(template, settings);
      assert.deepEqual(await pdfRules(r), [], `${at}: the PDF draws none`);
      assert.deepEqual(await wordRules(r), [], `${at}: Word draws none`);
    }
  });

  it('nothing stored (older builds, imported files): each template\'s own — Word draws a rule exactly where its PDF does', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const template of TEMPLATES) {
      const bare = cv(template);
      delete bare.settings.showHeaderBorder;
      delete bare.settings.headerBorderWidth;
      const old = { ...bare, updatedAt: 5 };
      delete old.dataVersion;
      for (const [label, r] of [['unset', bare], ['saved by 4bc56fe', normalizeResume(old)]]) {
        const pdf = await pdfRules(r);
        const word = await wordRules(r);
        assert.deepEqual(word.map((w) => [w.colour, w.size]), pdf.map((p) => [p.colour, eighths(p.width)]), `${template}, ${label}`);
      }
    }
  });
});
