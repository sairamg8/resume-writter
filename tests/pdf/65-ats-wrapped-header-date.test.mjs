// ATS-5: a header that wraps beside its right-aligned date. The date sat level with the header's
// FIRST line (the row was top-aligned), so the readers that rebuild lines by position — Poppler's
// reading order and -layout, pdf.js lines — read "…Director of Product 03/2022 – Present" and then
// "Design & Research": the title, the company or a certification's name split around the date. Now
// the date sits on the header's LAST line, on its baseline — the rule Title "Side by side" already
// followed. The fuzz's corner makes it bite: a large entry font and wide margins (ats-fuzz seed
// cases). -raw reads content order and is ATS-4's.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, read, render, allText, resume, section, experience } from './harness.mjs';
import { hasPdftotext, pdftotext } from './extractors.mjs';
import { truthBlocks, score, problems } from './ats-parse.mjs';
import { pdfjsLineText } from './ats-fields.mjs';

before(setup);
after(teardown);

const CORNER = { fontSizeBase: 12, fontSizeEntryDelta: 2, marginH: 28 };
const JOB = { company: 'Wide World Importers & Sons', location: 'São Paulo, BR', startDate: '03/2022', endDate: '', current: true, description: '<ul><li>Led the design and research teams.</li></ul>' };
const CASES = [
  { titleStyle: 'stacked', titleOrder: 'role', role: 'Director of Product Design & Research, Platform Engineering and Developer Productivity' },
  { titleStyle: 'inline', titleOrder: 'company', role: 'Director of Product Design & Research' },
];

/** Every reader that orders text by position (not -raw), as [name, text]. */
async function positional(bytes) {
  const pages = await read(bytes);
  return [['pdf.js', allText(pages)], ['pdf.js lines', pdfjsLineText(pages)], ...pdftotext(bytes).filter(([n]) => !n.includes('-raw'))];
}

async function problemsOf(r) {
  const blocks = truthBlocks(r).filter((b) => b.id !== 'contact' && b.id !== 'summary');
  return (await positional(await render(r))).flatMap(([n, text]) => problems(n, score(blocks, text)));
}

describe('a wrapped entry header reads whole beside its date (ATS-5)', () => {
  for (const template of ['classic', 'minimal', 'modern', 'executive', 'sidebar']) {
    for (const c of CASES) {
      it(`${template}${template === 'sidebar' ? ' (single column)' : ''}: Title ${c.titleStyle}, ${c.titleOrder} first`, async (t) => {
        if (!hasPdftotext) { t.skip('pdftotext not installed'); return; }
        const r = resume({
          template,
          settings: { ...CORNER, ...(template === 'sidebar' ? { sidebarSingleColumn: true } : {}) },
          sections: [experience([{ ...JOB, role: c.role }], { titleStyle: c.titleStyle, titleOrder: c.titleOrder })],
        });
        assert.deepEqual(await problemsOf(r), []);
      });
    }
  }

  it('classic: a long certification name reads whole beside its dates', async (t) => {
    if (!hasPdftotext) { t.skip('pdftotext not installed'); return; }
    const r = resume({
      template: 'classic', settings: CORNER,
      sections: [section('certifications', [{ name: 'AWS Certified Solutions Architect – Professional and Security Specialty', issuer: 'Amazon Web Services Training and Certification', date: '05/2023', expiry: '05/2026' }])],
    });
    assert.deepEqual(await problemsOf(r), []);
  });

  // The two-column Sidebar's card prints its date a little smaller than its title; it inherited the
  // page's taller line box, which set it 1.6 pt above a one-line title's baseline and 4.9 pt above a
  // wrapped one's last line. A date in another size sits 0.3 pt below (PdfItemHeader.jsx BELOW_PT).
  for (const [template, settings] of [['classic', CORNER], ['sidebar', {}]]) {
    it(`${template}: the date sits on the baseline of the wrapped title's last line`, async () => {
      const c = CASES[0];
      const r = resume({ template, settings, sections: [experience([{ ...JOB, role: c.role }], { titleStyle: c.titleStyle, titleOrder: c.titleOrder })] });
      const [page] = await read(await render(r));
      const words = c.role.split(' ');
      const title = page.items.filter((i) => /Bold/.test(i.font) && words.some((w) => i.str.includes(w)));
      const date = page.items.find((i) => i.str.includes('03/2022'));
      assert.ok(title.length >= 2, `the title wraps (${title.length} line(s))`);
      const last = Math.min(...title.map((i) => i.y));
      assert.ok(Math.abs(date.y - last) <= 0.5, `date baseline ${date.y.toFixed(2)} vs the title's last line ${last.toFixed(2)}`);
    });
  }
});
