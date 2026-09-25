// R2-147 × R2-148 — a PDF the app printed with Design → Page numbers on imports without them: Import's PDF
// reader leaves out each page's "Page n of N" footer and the running header "Name · Page N" (ATS-7) that
// opens every page after the first. Both used to be read as résumé text, into the entries' descriptions.
// A line that only looks like them — not the page's first or last line, or with another page's number —
// is kept.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, TEMPLATES } from './harness.mjs';
import { pdfLines, pdfLinesOfPages } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

let ctx;
before(async () => { ctx = await setup(); });
after(teardown);

const NAME = 'Pat Lee';
const lis = (from) => Array.from({ length: 40 }, (_, i) => `<li>Shipped release ${from + i} of the checkout service.</li>`).join('');
const cv = (template) => resume({
  template,
  settings: { pageNumbers: true },
  personal: { name: NAME, title: 'Engineer', email: 'pat@example.com' },
  sections: [experience([
    { role: 'Staff Engineer', company: 'Northwind Traders', startDate: '03/2019', endDate: '12/2021', description: `<ul>${lis(1)}</ul>` },
    { role: 'Engineer', company: 'Contoso Freight', startDate: '03/2015', endDate: '02/2019', description: `<ul>${lis(41)}</ul>` },
  ])],
});
const FURNITURE = /(^|· )Page \d+( of \d+)?$/;

describe('Import leaves out the page numbers and running headers of the app\'s own PDF (R2-147)', () => {
  it('every template: no "Page n of N" and no "Name · Page N" among the lines read', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      const lines = await pdfLines(await render(cv(template)), ctx.pdfjs);
      const breaks = lines.filter((l) => l.text === '').length;
      if (breaks < 2) wrong.push(`${template}: the fixture is one page`);
      for (const l of lines) if (FURNITURE.test(l.text.trim())) wrong.push(`${template}: "${l.text}"`);
    }
    assert.deepEqual(wrong, []);
  });

  it('Classic: the imported résumé has both jobs, every bullet once, and no page furniture', async () => {
    const r = resumeFromText(await pdfLines(await render(cv('classic')), ctx.pdfjs));
    const json = JSON.stringify(r);
    assert.doesNotMatch(json, /Page \d+ of \d+/);
    assert.doesNotMatch(json, new RegExp(`${NAME} · Page`));
    const jobs = r.sections.find((s) => s.type === 'experience');
    assert.equal(jobs?.items.length, 2);
    const bullets = jobs.items.flatMap((it) => [...String(it.description).matchAll(/Shipped release (\d+) of/g)].map((m) => Number(m[1])));
    assert.deepEqual(bullets, Array.from({ length: 80 }, (_, i) => i + 1));
  });

  it('only the page\'s own first or last line, with its own number, is left out', () => {
    // pdf.js items, y from the page's foot: a line each, top to bottom.
    const page = (...texts) => texts.map((str, i) => ({ str, x: 50, y: 800 - i * 20, w: 100, h: 10 }));
    const read = (pages) => pdfLinesOfPages(pages).map((l) => l.text).filter(Boolean);
    assert.deepEqual(read([page('Pat Lee', 'Page 2 of 3', 'Wrote Page 2 of the guide', 'Page 1 of 2')]),
      ['Pat Lee', 'Page 2 of 3', 'Wrote Page 2 of the guide'], 'page 1: its footer out; another page\'s number stays');
    assert.deepEqual(read([page('Pat Lee'), page('Pat Lee · Page 2', 'Page 2', 'Skills', 'Page 2 of 2')]),
      ['Pat Lee', 'Page 2', 'Skills'], 'page 2: its running header and footer out; a "Page 2" line inside the page stays');
    assert.deepEqual(read([page('Page 1', 'Summary', 'Page 3 of 3')]), ['Page 1', 'Summary', 'Page 3 of 3'],
      'page 1 has no running header, and "Page 3 of 3" is not its number');
  });
});
