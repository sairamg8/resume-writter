// The letterhead's rule is the résumé header's (V2FIDB-51-2). The Cover Letter panel says the
// letter's header style follows the résumé template, and the letterhead follows the header's
// alignment and colours — but its rule was fixed per look: a Classic résumé with Personal Info →
// Header Customization → Header Bottom Border off (every new résumé's) printed no rule while its
// letter printed a 2.5 pt one, and at Thickness 6 the résumé's rule was 6 pt, the letter's still
// 2.5 pt (Minimal's hairline and Executive's double rule, whatever either control said).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, read, allItems, loadModule, readDocx, TEMPLATES } from './harness.mjs';
import { drawing, painted } from './extractors.mjs';

before(setup);
after(teardown);

const ACCENT = '#e11d48';
const RULE_LOOKS = ['classic', 'minimal', 'executive'];

/** A résumé on `template` with a letterhead's worth of header and a letter; no sections, so the header rule is its only wide stroke. */
const make = (template, settings) => resume({
  template,
  settings: { accentColor: ACCENT, ...settings },
  personal: { name: 'Pat Sample', title: 'Staff Engineer', email: 'pat@example.com', phone: '+1 555 0100', hiddenFields: [] },
  coverLetter: { body: '<p>Dear Sarah,</p>', date: '2026-01-15' },
});

/** Page 1's horizontal strokes across the text column — rules — as "colour/thickness", top down. */
const rulesOf = async (bytes) => (await painted(bytes))
  .filter((p) => p.paint === 'stroke' && p.x1 - p.x0 > 400 && p.y1 - p.y0 < 1)
  .sort((a, b) => b.y0 - a.y0)
  .map((p) => `${p.colour}/${p.width}`);

/** The rules the résumé's header and its letter's letterhead print for `settings`. */
async function both(template, settings) {
  const r = make(template, settings);
  return { resume: await rulesOf(await render(r)), letter: await rulesOf(await renderCover(r)) };
}

/** Header Bottom Border and Thickness as the résumé stores them; undefined is a résumé saved or imported without the setting. */
const ON = (headerBorderWidth) => ({ showHeaderBorder: true, headerBorderWidth });
const OFF = (headerBorderWidth) => ({ showHeaderBorder: false, headerBorderWidth });

/** The Word letter of `template` with `settings`. */
async function docx(template, settings) {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  return readDocx(new Uint8Array(await (await renderCoverLetterDocx(make(template, settings))).arrayBuffer()));
}

/** Word's last letterhead line (the contacts): its bottom border's attributes, or null, and its spacing after, pt. */
function lastLine(doc) {
  const xml = doc.paragraphs[doc.texts.indexOf('15 January 2026') - 1].xml;
  const m = /<w:bottom ([^>]*)\/>/.exec(xml.split('</w:pBdr>')[0]);
  const border = m && Object.fromEntries([...m[1].matchAll(/w:(\w+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
  return { border, after: Number(/<w:spacing [^>]*w:after="(\d+)"/.exec(xml)?.[1]) / 20 };
}

describe('the letterhead\'s rule follows Header Bottom Border and its Thickness (V2FIDB-51-2)', () => {
  it('border on: Classic, Minimal and Executive letters draw the résumé\'s rule — its accent, at its Thickness — and nothing else', async () => {
    for (const template of RULE_LOOKS) {
      for (const width of [undefined, 1, 2, 6, 12]) {
        const at = `${template}, Thickness ${width}`;
        const got = await both(template, ON(width));
        assert.deepEqual(got.resume, [`${ACCENT}/${width || 2}`], `${at}: the résumé`);
        assert.deepEqual(got.letter, got.resume, `${at}: the letter draws the résumé's rule`);
      }
    }
  });

  it('border off: a Classic letter draws no rule, as its résumé; Minimal keeps its hairline and Executive its double rule; Thickness changes nothing', async () => {
    const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const own = { classic: [], minimal: [`${solid(ACCENT, 0.4)}/0.75`], executive: [`${ACCENT}/0.75`, `${ACCENT}/0.75`] };
    for (const template of RULE_LOOKS) {
      for (const width of [undefined, 6]) {
        const got = await both(template, OFF(width));
        assert.deepEqual(got.resume, [], `${template}, Thickness ${width}: the résumé draws none`);
        assert.deepEqual(got.letter, own[template], `${template}, Thickness ${width}: the letter`);
      }
    }
  });

  // Guard: a résumé saved or imported without the setting draws the template's design — Classic
  // its rule (headerBorderOn) — and its letter now draws that same rule.
  it('a résumé stored without the setting: the letter draws what its résumé draws', async () => {
    const unset = { showHeaderBorder: undefined, headerBorderWidth: undefined };
    assert.deepEqual(await both('classic', unset), { resume: [`${ACCENT}/2`], letter: [`${ACCENT}/2`] }, 'classic');
    for (const template of ['minimal', 'executive']) {
      assert.deepEqual((await both(template, unset)).letter, (await both(template, OFF())).letter, `${template}: its own mark, as with the border off`);
    }
  });

  // The editor offers 1–12 pt; an imported résumé can store anything. Before, the letter ignored
  // the Thickness; reading it must not print a rule the résumé does not, or make Word's export throw
  // (a -3 wrote w:sz="-24": "Must be a positive integer").
  it('an imported Thickness: the letter draws what the résumé draws, and Word writes a border it takes (¼–12 pt)', async () => {
    for (const [width, drawn, sz] of [[50, 50, '96'], ['6', 6, '48'], [0.5, 0.5, '4'], [0.1, 0.1, '2'], [-3, null, null], ['abc', null, null]]) {
      const at = `Thickness ${JSON.stringify(width)}`;
      const got = await both('classic', ON(width));
      assert.deepEqual(got.resume, drawn == null ? [] : [`${ACCENT}/${drawn}`], `${at}: the résumé`);
      assert.deepEqual(got.letter, got.resume, `${at}: the letter`);
      assert.equal(lastLine(await docx('classic', ON(width))).border?.sz ?? null, sz, `${at}: Word`);
    }
    // Minimal and Executive keep their own mark where the résumé draws no rule.
    for (const template of ['minimal', 'executive']) {
      assert.deepEqual((await both(template, ON(-3))).letter, (await both(template, OFF())).letter, `${template}: -3`);
    }
  });

  it('the rule sits between the contacts and the date, and moves the letter down by its own thickness only', async () => {
    const dateY = (pages) => allItems(pages).find((t) => t.str === '15 January 2026').y;
    for (const template of RULE_LOOKS) {
      const off = await read(await renderCover(make(template, OFF())));
      for (const width of [2, 6]) {
        const bytes = await renderCover(make(template, ON(width)));
        const pages = await read(bytes);
        const contact = allItems(pages).find((t) => t.str.includes('pat@example.com'));
        const [rule] = (await painted(bytes)).filter((p) => p.paint === 'stroke' && p.x1 - p.x0 > 400);
        assert.ok(rule.y1 < contact.y && rule.y0 > dateY(pages), `${template} ${width}: the rule (y ${rule.y0.toFixed(1)}) under the contacts (${contact.y.toFixed(1)}), above the date (${dateY(pages).toFixed(1)})`);
        const shift = { classic: width, minimal: width - 0.75, executive: width - (0.75 + 1.5 + 0.75) }[template];
        assert.ok(Math.abs(dateY(off) - dateY(pages) - shift) < 0.05, `${template} ${width}: the date moves ${(dateY(off) - dateY(pages)).toFixed(2)} pt, expected ${shift}`);
      }
    }
  });

  // Guard: Modern's banner and the Sidebar panel take no rule, on the résumé or the letter.
  it('Modern and Sidebar: the controls change nothing on the letter — its band, no rule', async () => {
    for (const template of ['modern', 'sidebar']) {
      const page = async (settings) => drawing(await renderCover(make(template, settings)));
      const base = await page(OFF());
      for (const settings of [ON(6), ON(), { showHeaderBorder: undefined }]) assert.equal(await page(settings), base, `${template} ${JSON.stringify(settings)}`);
      assert.deepEqual(await rulesOf(await renderCover(make(template, ON(6)))), [], `${template}: no rule`);
    }
  });

  it('Word: the letterhead\'s bottom border is the PDF\'s rule — the résumé\'s at its Thickness when on; with no rule, the PDF\'s gap under the letterhead', async () => {
    const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const rule = (val, sz, color) => ({ val, sz: String(sz), color: color.slice(1), space: '12' });
    for (const template of RULE_LOOKS) {
      for (const width of [1, 6, 12]) {
        assert.deepEqual(lastLine(await docx(template, ON(width))), { border: rule('single', width * 8, ACCENT), after: 16 }, `${template} on, ${width} pt`);
      }
    }
    // The PDF puts the letterhead's 12 pt pad and its 16 pt gap under the text with or without a rule.
    assert.deepEqual(lastLine(await docx('classic', OFF(6))), { border: null, after: 28 }, 'classic off: no border, the PDF\'s 28 pt under it');
    assert.deepEqual(lastLine(await docx('minimal', OFF(6))), { border: rule('single', 6, solid(ACCENT, 0.4)), after: 16 }, 'minimal off: its hairline');
    assert.deepEqual(lastLine(await docx('executive', OFF(6))), { border: rule('double', 6, ACCENT), after: 16 }, 'executive off: its double rule');
    for (const template of TEMPLATES.filter((t) => !RULE_LOOKS.includes(t))) {
      assert.equal(lastLine(await docx(template, ON(6))).border.color, lastLine(await docx(template, OFF())).border.color, `${template}: the band, not a rule`);
    }
  });
});
