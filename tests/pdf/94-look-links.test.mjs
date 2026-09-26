// R2-147 — Design → Links (settings.linkStyle): every link the résumé prints — its contacts, an entry's
// URL, a link in the summary or a description, the cover letter's — prints Plain (the text around it,
// no underline: what every résumé printed before), Underline, or Accent (the accent colour; on Modern's
// banner, Banner's band and the Sidebar's column the tint of it that reads there), in the PDF (= the
// preview) on every template and in the Word export. The Markdown and ATS text print the words only,
// whatever the style. Unset — or a style this build does not offer — prints as Plain.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, renderCover, loadModule, unzipEntry, TEMPLATES } from './harness.mjs';
import { snapshot, fillsOf, item } from './parity/measure.mjs';
import { linkLook } from '../../src/utils/linkStyle.js';

before(setup);
after(teardown);

const EMAIL = 'avery@example.com';
const ACCENT = '#b4235a';
const SIDEBAR = '#1e293b';
const SUMMARY_LINK = 'the ledger notes';

const cv = (template, linkStyle, extra = {}) => resume({
  template,
  settings: { accentColor: ACCENT, sidebarBg: SIDEBAR, ...(linkStyle === undefined ? {} : { linkStyle }) },
  personal: {
    name: 'Avery Stone', email: EMAIL, website: 'avery.dev',
    summary: `<p>Engineer; see <a href="https://avery.dev/ledger">${SUMMARY_LINK}</a>.</p>`,
    ...extra.personal,
  },
  sections: [experience([{ description: '<p>Built the ledger.</p>' }]),
    section('projects', [{ name: 'Ledgerline', url: 'github.com/avery/ledgerline', description: '' }])],
});

const shot = async (r, cover = false) => {
  const bytes = cover ? await renderCover(r) : await render(r);
  return { bytes, ...(await snapshot(bytes)) };
};

/**
 * A line stroked under the run holding `text` (react-pdf's underline), on its page: flat, at most 4 pt
 * under its baseline, within the run and at least 10 pt long — a link inside a paragraph is part of its run.
 */
function underlined(snap, text) {
  const at = item(snap, text);
  assert.ok(at, `"${text}" prints`);
  return snap.paint.some((p) => p.paint === 'stroke' && p.page === at.page && p.y1 - p.y0 < 1.5
    && p.y1 <= at.y + 0.5 && p.y0 >= at.y - 4 && p.x0 >= at.x - 1 && p.x1 <= at.x + at.w + 1 && p.x1 - p.x0 > 10);
}

/** The colour behind the header's contacts on `template`: the banner, the band, the Sidebar's column; null on the white page. */
const GROUND = { modern: ACCENT, banner: ACCENT, sidebar: SIDEBAR };

describe('Design → Links prints every link Plain, Underlined or in the accent (R2-147)', () => {
  it('every template: unset, Plain and a style this build does not offer print the same PDF', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      const unset = (await shot(cv(template, undefined))).drawing;
      for (const v of ['plain', 'bold']) if ((await shot(cv(template, v))).drawing !== unset) wrong.push(`${template}: ${v} prints differently from unset`);
    }
    assert.deepEqual(wrong, []);
  });

  it('every template: Underline strokes a line under the e-mail and the summary\'s link, Plain none', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      const [plain, under] = [await shot(cv(template, 'plain')), await shot(cv(template, 'underline'))];
      for (const text of [EMAIL, SUMMARY_LINK]) {
        if (underlined(plain, text)) wrong.push(`${template} plain: a line under "${text}"`);
        if (!underlined(under, text)) wrong.push(`${template} underline: no line under "${text}"`);
      }
    }
    assert.deepEqual(wrong, []);
  });

  it('every template and the letter: Underline and Accent print every word where Plain does — only the look changes', async () => {
    // Underline prints a contact as a run of a Text, not a Text in a Link box (ContactValue): the words
    // must stay where they were, on the page and in the Sidebar's column, whose values fit a line.
    const places = (snap) => snap.pages.flatMap((p, i) => p.items.map((t) => `${i} ${t.x.toFixed(1)},${t.y.toFixed(1)} ${t.str}`)).sort();
    const wrong = [];
    const long = { personal: { linkedin: 'linkedin.com/in/avery-stone-ledger-engineering', github: 'github.com/avery-stone' } };
    for (const template of TEMPLATES) {
      for (const cover of [false, true]) {
        if (cover && template !== 'classic' && template !== 'sidebar') continue;
        const plain = places(await shot(cv(template, 'plain', long), cover));
        for (const v of ['underline', 'accent']) {
          const got = places(await shot(cv(template, v, long), cover));
          if (JSON.stringify(got) !== JSON.stringify(plain)) {
            const moved = got.filter((x) => !plain.includes(x)).slice(0, 3);
            wrong.push(`${template}${cover ? ' letter' : ''} ${v}: ${moved.join(' | ')}`);
          }
        }
      }
    }
    assert.deepEqual(wrong, []);
  });

  it('every template: Accent paints the e-mail in the accent — on a banner, band or the Sidebar\'s column the tint of it that reads there', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      const r = await shot(cv(template, 'accent'));
      const want = linkLook('accent', ACCENT, GROUND[template] || null).color.toLowerCase();
      const got = await fillsOf(r.bytes, EMAIL);
      if (!got.length || got.some((c) => c.toLowerCase() !== want)) wrong.push(`${template}: "${EMAIL}" in ${got.join(', ')}, not ${want}`);
      if (underlined(r, EMAIL)) wrong.push(`${template}: a line under "${EMAIL}"`);
    }
    assert.deepEqual(wrong, []);
  });

  it('Classic: the summary\'s link and a project\'s URL take the style too', async () => {
    const accent = await shot(cv('classic', 'accent'));
    assert.deepEqual((await fillsOf(accent.bytes, SUMMARY_LINK)).map((c) => c.toLowerCase()), [ACCENT]);
    assert.ok(underlined(await shot(cv('classic', 'underline')), 'github.com/avery/ledgerline'), 'the project\'s URL is underlined');
  });

  it('the cover letter\'s contacts take the style, on its band the accent\'s readable tint', async () => {
    assert.ok(underlined(await shot(cv('classic', 'underline'), true), EMAIL), 'Classic letter: the e-mail is underlined');
    assert.ok(!underlined(await shot(cv('classic', 'plain'), true), EMAIL), 'Classic letter, Plain: no line');
    const modern = await shot(cv('modern', 'accent'), true);
    const want = linkLook('accent', ACCENT, ACCENT).color.toLowerCase();
    assert.deepEqual([...new Set((await fillsOf(modern.bytes, EMAIL)).map((c) => c.toLowerCase()))], [want]);
  });

  it('Word: Underline underlines the linked runs, Accent colours them; Plain and unset add neither', async () => {
    const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
    const links = async (linkStyle) => {
      const xml = unzipEntry(Buffer.from(await (await renderResumeDocx(cv('classic', linkStyle))).arrayBuffer()), 'word/document.xml') || '';
      return [...xml.matchAll(/<w:hyperlink\b[^>]*>([\s\S]*?)<\/w:hyperlink>/g)].map((m) => m[1]);
    };
    for (const v of [undefined, 'plain']) {
      const all = await links(v);
      assert.ok(all.some((x) => x.includes(EMAIL)) && all.some((x) => x.includes(SUMMARY_LINK)), `${v}: the e-mail and the summary's link are links`);
      assert.ok(all.every((x) => !/<w:u w:val="single"/.test(x)), `${v}: no underline`);
      assert.ok(all.every((x) => !x.includes(`w:val="${ACCENT.slice(1)}"`) || x.includes('ledgerline')), `${v}: no accent but the project's URL, as before`);
    }
    for (const x of (await links('underline'))) assert.match(x, /<w:u w:val="single"\/>/, 'underline: every link underlined');
    for (const x of (await links('accent'))) assert.match(x, new RegExp(`<w:color w:val="${ACCENT.slice(1)}"/>`), 'accent: every link in the accent');
  });

  it('Markdown and ATS text print the same words whatever the style', async () => {
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
    for (const v of ['underline', 'accent']) {
      assert.equal(generateMarkdownResume(cv('classic', v)), generateMarkdownResume(cv('classic', 'plain')), `Markdown, ${v}`);
      assert.equal(generateAtsPlainText(cv('classic', v)), generateAtsPlainText(cv('classic', 'plain')), `ATS text, ${v}`);
    }
  });
});

// The review of R2-147: Underline replaced a struck-through link's line-through with its underline in
// the PDF, while Word kept the strike and added the underline. Now both lines print.
describe('Underline over a struck-through link', () => {
  const STRUCK = 'the old ledger';
  /** The heights (rounded) of the flat lines stroked across the run holding `text`: an underline, a strike. */
  function linesAcross(snap, text) {
    const at = item(snap, text);
    assert.ok(at, `"${text}" prints`);
    return [...new Set(snap.paint.filter((p) => p.paint === 'stroke' && p.page === at.page && p.y1 - p.y0 < 1.5
      && Math.abs(p.y0 - at.y) < 12 && p.x0 >= at.x - 1 && p.x1 <= at.x + at.w + 1 && p.x1 - p.x0 > 10).map((p) => Math.round(p.y0)))];
  }
  const struckCv = (linkStyle) => cv('classic', linkStyle, { personal: { summary: `<p>See <a href="https://avery.dev/old"><s>${STRUCK}</s></a> first.</p>` } });

  it('keeps the strike and adds the underline', async () => {
    const plain = linesAcross(await shot(struckCv('plain')), STRUCK);
    const under = linesAcross(await shot(struckCv('underline')), STRUCK);
    assert.equal(plain.length, 1, `Plain: the strike alone (${plain})`);
    assert.equal(under.length, 2, `Underline: the strike and the underline (${under})`);
    assert.ok(under.includes(plain[0]), 'the strike where Plain draws it');
  });
});
