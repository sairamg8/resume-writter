// Design → Spacing in the Word résumé and letter (R2-062): the page margins, Line Height, Between
// Sections, Between Items and the three Page Fit presets that set them. Word printed fixed 0.75 in
// margins, single line spacing and fixed gaps, so the .docx of a résumé tuned to fit one page in the
// PDF could run to two, and every Spacing control left it byte-identical.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, section, renderDocx, readDocx, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

/** mm as Word's twips (1/1440 in). */
const mm = (n) => Math.round((n * 1440) / 25.4);
/** A Design → Spacing px value as twips: × 0.75 pt, × 20. */
const px = (n) => n * 15;
/** The docDefaults' space after a paragraph that sets none (wordExport.js buildDocument). */
const DEFAULT_AFTER = 40;
/** The three Smart Page Fit presets, as DesignPanel.jsx's buttons store them. */
const PRESETS = {
  '1-Page Fit': { marginV: 10, marginH: 14, sectionGap: 10, itemGap: 5, lineHeightValue: 1.35 },
  Balanced: { marginV: 14, marginH: 18, sectionGap: 16, itemGap: 8, lineHeightValue: 1.5 },
  Spacious: { marginV: 20, marginH: 22, sectionGap: 22, itemGap: 12, lineHeightValue: 1.65 },
};

const letterDocx = async (r) => {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  return readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
};

/** The page's margins, top right bottom left, twips. */
function margins(xml) {
  const tag = /<w:pgMar [^>]*\/>/.exec(xml)?.[0] || '';
  return ['top', 'right', 'bottom', 'left'].map((side) => Number(new RegExp(`w:${side}="(-?\\d+)"`).exec(tag)?.[1]));
}

/** Every body paragraph, the empty ones too: its text and its paragraph spacing, twips. */
function paras(xml) {
  return xml.split('<w:body>')[1].split('</w:p>').slice(0, -1).map((p) => {
    const spacing = /<w:spacing ([^>]*)\/>/.exec(/<w:pPr>(.*?)<\/w:pPr>/s.exec(p)?.[1] || '')?.[1] || '';
    const num = (k) => { const m = new RegExp(`w:${k}="(-?\\d+)"`).exec(spacing); return m ? Number(m[1]) : undefined; };
    return {
      text: [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''),
      before: num('before') ?? 0, after: num('after') ?? DEFAULT_AFTER, line: num('line'), rule: /w:lineRule="(\w+)"/.exec(spacing)?.[1],
      tabs: [...p.matchAll(/<w:tab w:val="(\w+)" w:pos="(\d+)"\/>/g)].map((m) => [m[1], Number(m[2])]),
    };
  });
}

/** Does the paragraph's text hold `text`, in any case (Title case "Abc" or "ABC")? */
const holds = (p, text) => p.text.toUpperCase().includes(text.toUpperCase());

/**
 * The space Word leaves between the paragraph whose text holds `from` (its last such) and the next
 * one whose text holds `to` (a title that leads with the role holds the company too), twips: the one's space after, the other's space before, and
 * each empty paragraph between them — which must be exactly as tall as it says (an empty paragraph
 * of auto height is a whole line of text the PDF does not print).
 */
function space(ps, from, to) {
  const a = ps.findLastIndex((p) => holds(p, from));
  const b = ps.findIndex((p, i) => i > a && holds(p, to));
  assert.ok(a >= 0 && b > a, `"${from}" then "${to}" in ${JSON.stringify(ps.map((p) => p.text))}`);
  let total = ps[a].after + ps[b].before;
  for (const p of ps.slice(a + 1, b)) {
    assert.equal(p.text, '', `only spacing between "${from}" and "${to}"`);
    assert.equal(p.rule, 'exact', `an empty paragraph between "${from}" and "${to}" is exactly its space tall`);
    total += p.before + p.line + p.after;
  }
  return total;
}

/** Two sections of two entries each, and the settings under test. */
const cv = (template, settings = {}, { first = {}, second = {} } = {}) => resume({
  template,
  settings,
  personal: { name: 'Pat Sample', title: 'Engineer', summary: '<p>Summary line.</p>' },
  sections: [
    experience([
      { company: 'Alpha', role: 'Lead', description: '<p>Alpha work.</p>' },
      { company: 'Beta', role: 'Dev', description: '<p>Beta work.</p>' },
    ], first),
    section('projects', [{ name: 'Gamma', description: '<p>Gamma work.</p>' }, { name: 'Delta', description: '<p>Delta work.</p>' }], second, { title: 'Projects' }),
  ],
  coverLetter: { body: '<p>Dear Sam,</p><p>Second paragraph.</p>' },
});

describe('Word: the page margins are Design → Spacing\'s (R2-062)', () => {
  for (const [label, docx] of [['résumé', renderDocx], ['letter', letterDocx]]) {
    it(`the ${label}: Top / Bottom and Left / Right, in mm, on every template`, async () => {
      const wrong = [];
      for (const template of TEMPLATES) {
        for (const [set, want] of [
          [{}, [mm(14), mm(18), mm(14), mm(18)]],
          [{ marginV: 35, marginH: 35 }, [mm(35), mm(35), mm(35), mm(35)]],
          [{ marginV: 0, marginH: 40 }, [0, mm(40), 0, mm(40)]],
          [PRESETS['1-Page Fit'], [mm(10), mm(14), mm(10), mm(14)]],
        ]) {
          const got = margins((await docx(cv(template, set))).xml);
          if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push(`${template} ${JSON.stringify(set)}: ${got} (want ${want})`);
        }
      }
      assert.deepEqual(wrong, []);
    });
  }

  it('the entry dates\' right tab sits on the right margin, whatever the margins and the paper', async () => {
    const { PAGE_SIZES } = await loadModule('/src/constants/pageSize.js');
    for (const pageSize of ['A4', 'LETTER']) {
      for (const marginH of [18, 35, 0]) {
        const ps = paras((await renderDocx(cv('classic', { pageSize, marginH }))).xml);
        const tabs = ps.filter((p) => p.text.startsWith('Alpha')).flatMap((p) => p.tabs);
        assert.deepEqual(tabs, [['right', PAGE_SIZES[pageSize].twips.width - 2 * mm(marginH)]], `${pageSize} ${marginH} mm`);
      }
    }
  });
});

describe('Word: Line Height (R2-062)', () => {
  /** A paragraph's line spacing: at least Line Height × its text size (twips), as the PDF's line box. */
  const lineOf = (ps, text) => {
    const p = ps.find((q) => holds(q, text));
    return p && `${p.rule}:${p.line}`;
  };

  it('descriptions, the summary and skills rows keep Line Height × their size between lines, on every template', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      for (const [lineHeightValue, fontSizeBase] of [[1, 11], [1.35, 11], [1.5, 11], [2, 12], [3, 10]]) {
        const r = cv(template, { lineHeightValue, fontSizeBase });
        r.sections.push(section('skills', [{ category: 'Tools', skills: 'Go, Rust' }]));
        r.sections[0].items[0].bullets = ['A legacy bullet'];
        const ps = paras((await renderDocx(r)).xml);
        const want = `atLeast:${Math.round(lineHeightValue * fontSizeBase * 20)}`;
        for (const text of ['Alpha work.', 'Summary line.', 'A legacy bullet', 'Tools']) {
          const got = lineOf(ps, text);
          if (got !== want) wrong.push(`${template} ${lineHeightValue}×${fontSizeBase} pt "${text}": ${got} (want ${want})`);
        }
      }
    }
    assert.deepEqual(wrong, []);
  });

  it('the letter\'s body keeps it too', async () => {
    for (const lineHeightValue of [1.2, 1.5, 2]) {
      const ps = paras((await letterDocx(cv('classic', { lineHeightValue }))).xml);
      for (const text of ['Dear Sam,', 'Second paragraph.']) {
        assert.equal(lineOf(ps, text), `atLeast:${Math.round(lineHeightValue * 11 * 20)}`, `${lineHeightValue}: "${text}"`);
      }
    }
  });
});

describe('Word: Between Sections and Between Items (R2-062)', () => {
  it('Between Sections is the space from a section\'s last entry to the next title, on every template', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      const at = async (sectionGap) => space(paras((await renderDocx(cv(template, { sectionGap }))).xml), 'Beta work.', 'PROJECTS');
      const none = await at(0);
      for (const sectionGap of [10, 16, 40, 60]) {
        const got = (await at(sectionGap)) - none;
        if (got !== px(sectionGap)) wrong.push(`${template} ${sectionGap} px: ${got} twips more than at 0 (want ${px(sectionGap)})`);
      }
    }
    assert.deepEqual(wrong, []);
  });

  it('Between Items is the space between two entries — scaled by the section\'s Spacing preset, or its own Item gap', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      for (const [sectionSettings, scale] of [[{}, 1], [{ spacing: 'compact' }, 0.5], [{ spacing: 'relaxed' }, 1.75], [{ itemGap: 30 }, 0]]) {
        const at = async (itemGap) => space(paras((await renderDocx(cv(template, { itemGap }, { first: sectionSettings }))).xml), 'Alpha work.', 'Beta');
        const none = await at(0);
        for (const itemGap of [4, 8, 20, 40]) {
          const got = (await at(itemGap)) - none;
          if (got !== px(itemGap * scale)) wrong.push(`${template} ${JSON.stringify(sectionSettings)} ${itemGap} px: ${got} (want ${px(itemGap * scale)})`);
        }
      }
      const own = async (gap) => space(paras((await renderDocx(cv(template, { itemGap: 8 }, { first: { itemGap: gap } }))).xml), 'Alpha work.', 'Beta');
      const got = (await own(30)) - (await own(0));
      if (got !== px(30)) wrong.push(`${template}: the section's own Item gap of 30 px: ${got} (want ${px(30)})`);
    }
    assert.deepEqual(wrong, []);
  });

  it('Section Options → Spacing Override: After replaces Between Sections under the section, Before adds above its title', async () => {
    const at = async (settings, first, second) => space(paras((await renderDocx(cv('classic', settings, { first, second }))).xml), 'Beta work.', 'PROJECTS');
    const base = await at({ sectionGap: 0 }, {}, {});
    assert.equal((await at({ sectionGap: 16 }, { spaceAfter: 40 }, {})) - base, px(40), 'After 40 px, whatever Between Sections');
    assert.equal((await at({ sectionGap: 16 }, {}, { spaceBefore: 20 })) - base, px(16 + 20), 'Before 20 px, over Between Sections');
  });

  it('nothing follows the last section: no space under it to push a blank page', async () => {
    for (const template of TEMPLATES) {
      const ps = paras((await renderDocx(cv(template, { sectionGap: 60, itemGap: 40 }))).xml);
      assert.equal(ps.at(-1).text, 'Delta work.', `${template}: the document ends on the last entry`);
    }
  });

  it('each Page Fit preset reaches the .docx: margins, line height and both gaps', async () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      const doc = await renderDocx(cv('classic', preset));
      const ps = paras(doc.xml);
      const zero = paras((await renderDocx(cv('classic', { ...preset, sectionGap: 0, itemGap: 0 }))).xml);
      assert.deepEqual(margins(doc.xml), [mm(preset.marginV), mm(preset.marginH), mm(preset.marginV), mm(preset.marginH)], `${name}: margins`);
      assert.equal(ps.find((p) => p.text === 'Alpha work.').line, Math.round(preset.lineHeightValue * 11 * 20), `${name}: line height`);
      assert.equal(space(ps, 'Beta work.', 'PROJECTS') - space(zero, 'Beta work.', 'PROJECTS'), px(preset.sectionGap), `${name}: between sections`);
      assert.equal(space(ps, 'Alpha work.', 'Beta') - space(zero, 'Alpha work.', 'Beta'), px(preset.itemGap), `${name}: between items`);
    }
  });
});
