// ATS-7, option A (the owner, 2026-09-25): every résumé page after the first carries "Name · Page N" in its
// top margin, drawn before anything else on the page, so `pdftotext -raw` — which writes a page's words in
// drawing order and puts the form feed straight after the last one — joins the header, not a section heading
// that opens the page, to the page before. Pinned on every template: page 1 carries none; each later page
// carries it as the first text drawn, flush right, inside the top margin and clear of the page's text; a
// one-page résumé and a margin with no room carry none; Word prints the same line in a header on every page
// but the first, and the cover letter has none.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, overlaps, loadModule, unzipEntry, TEMPLATES, MM } from './harness.mjs';
import { hasPdftotext, pdftotext } from './extractors.mjs';

before(setup);
after(teardown);

const NAME = 'Pat Lee';
const CASES = [
  ...TEMPLATES.map((template) => ({ label: template, template, settings: {} })),
  { label: 'sidebar single column', template: 'sidebar', settings: { sidebarSingleColumn: true } },
];

/** One job of `bullets` one-line bullets, then Skills: two pages or more on every template at 70. */
function build(c, { bullets = 70, settings = {}, name = NAME } = {}) {
  const lis = Array.from({ length: bullets }, (_, i) => `<li>Shipped release ${i + 1} of the checkout service.</li>`).join('');
  return resume({
    template: c.template,
    settings: { ...c.settings, ...settings },
    personal: { name, title: 'Engineer', email: 'pat@example.com' },
    sections: [
      experience([{ role: 'Staff Engineer', company: 'Northwind Traders', startDate: '03/2019', endDate: '', current: true, description: `<ul>${lis}</ul>` }]),
      section('skills', [{ category: 'Languages', skills: 'TypeScript, SQL, Go' }]),
    ],
  });
}

const PAGE_MARK = /· Page \d+$|^Page \d+$/;

/** The page's first text drawn, with every run on its line (pdf.js keeps drawing order). */
function firstLine(page) {
  const [first] = page.items;
  if (!first) return { text: '', items: [] };
  const items = page.items.filter((t) => Math.abs(t.y - first.y) < 0.5).sort((a, b) => a.x - b.x);
  // Runs that touch join as they are; a gap between two is a space.
  const text = items.reduce((out, t, i) => out + (i && t.x - (items[i - 1].x + items[i - 1].w) > 0.5 ? ' ' : '') + t.str, '');
  return { text: text.replace(/\s+/g, ' ').trim(), items };
}

/** The top margin the page prints with, pt (the template's resolved margin). */
async function marginPt(r) {
  const { resolveTemplateSettings } = await loadModule('/src/templates/pdf/shared/templateSettings.js');
  const { pageMargins } = await loadModule('/src/constants/pageMargins.js');
  const s = resolveTemplateSettings(r.settings, r.template);
  return { v: pageMargins(s).v * MM, h: pageMargins(s).h * MM };
}

describe('every page after the first carries "Name · Page N" (ATS-7)', () => {
  for (const c of CASES) {
    it(`${c.label}: first text drawn on pages 2+, flush right in the top margin, clear of the text; none on page 1`, async () => {
      const r = build(c);
      const pages = await read(await render(r));
      assert.ok(pages.length >= 2, `${c.label}: ${pages.length} page(s) — the fixture must run past one`);
      assert.deepEqual(pages[0].items.filter((t) => PAGE_MARK.test(t.str.trim())).map((t) => t.str), [], 'page 1 carries no running header');
      const m = await marginPt(r);
      for (let i = 1; i < pages.length; i += 1) {
        const p = pages[i];
        const line = firstLine(p);
        assert.equal(line.text, `${NAME} · Page ${i + 1}`, `page ${i + 1}: the first text drawn`);
        for (const t of line.items) {
          // Baseline to the margin line: the caption's descenders (under 2 pt at 7.5 pt) stay above the text.
          assert.ok(t.y - 2 > p.H - m.v, `page ${i + 1}: "${t.str}" at ${(p.H - t.y).toFixed(1)} pt from the top, the margin is ${m.v.toFixed(1)}`);
          assert.ok(t.y + t.h < p.H, `page ${i + 1}: "${t.str}" runs off the paper`);
        }
        const right = Math.max(...line.items.map((t) => t.x + t.w));
        assert.ok(Math.abs(right - (p.W - m.h)) < 1.5, `page ${i + 1}: ends at ${right.toFixed(1)}, the right margin at ${(p.W - m.h).toFixed(1)}`);
        const hits = overlaps(p).filter(([a, b]) => line.items.some((t) => t.str === a || t.str === b));
        assert.deepEqual(hits, [], `page ${i + 1}: the header overlaps the page's text`);
      }
    });
  }

  it('Poppler -raw joins the header, not the page\'s own first line, to the page before', async (t) => {
    if (!hasPdftotext) { t.skip('pdftotext not installed'); return; }
    for (const c of CASES) {
      const bytes = await render(build(c));
      const [, raw] = pdftotext(bytes).find(([name]) => name.includes('-raw'));
      const [, second] = raw.split('\f');
      assert.ok(second.trimStart().startsWith(`${NAME} · Page 2`), `${c.label}: page 2 under -raw opens "${second.slice(0, 60)}"`);
    }
  });

  it('with no name it reads "Page 2"', async () => {
    const pages = await read(await render(build({ template: 'classic', settings: {} }, { name: '' })));
    assert.equal(firstLine(pages[1]).text, 'Page 2');
  });
});

describe('where it is left out', () => {
  for (const c of CASES) {
    it(`${c.label}: a one-page résumé carries none`, async () => {
      const pages = await read(await render(build(c, { bullets: 3 })));
      assert.equal(pages.length, 1);
      assert.deepEqual(pages[0].items.filter((t) => PAGE_MARK.test(t.str.trim())).map((t) => t.str), []);
    });
  }

  it('a top margin with no room for it (3 mm): none, on any page', async () => {
    for (const c of CASES) {
      const pages = await read(await render(build(c, { settings: { marginV: 3 } })));
      assert.ok(pages.length >= 2, c.label);
      const marks = pages.flatMap((p) => p.items).filter((t) => PAGE_MARK.test(t.str.trim()));
      assert.deepEqual(marks.map((t) => t.str), [], c.label);
    }
  });
});

describe('Word prints the same running header', () => {
  async function docx(r, cover = false) {
    const { renderResumeDocx, renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const blob = await (cover ? renderCoverLetterDocx(r) : renderResumeDocx(r));
    const buffer = Buffer.from(await blob.arrayBuffer());
    const xml = unzipEntry(buffer, 'word/document.xml');
    const rels = unzipEntry(buffer, 'word/_rels/document.xml.rels');
    const sectPr = xml.slice(xml.lastIndexOf('<w:sectPr'));
    const refs = [...sectPr.matchAll(/<w:headerReference [^>]*w:type="(\w+)"[^>]*r:id="([^"]+)"|<w:headerReference [^>]*r:id="([^"]+)"[^>]*w:type="(\w+)"/g)]
      .map((m) => ({ type: m[1] || m[4], id: m[2] || m[3] }));
    const headers = Object.fromEntries(refs.map(({ type, id }) => {
      const target = rels.match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${id}"`));
      return [type, unzipEntry(buffer, `word/${target[1] || target[2]}`)];
    }));
    return { sectPr, headers };
  }
  const textOf = (xml) => [...String(xml).matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');

  it('a header on every page but the first: "Name · Page " and the page number, flush right', async () => {
    const { sectPr, headers } = await docx(build({ template: 'classic', settings: {} }));
    assert.match(sectPr, /<w:titlePg\/>|<w:titlePg w:val="(true|1)"\/>/, 'the first page takes its own (empty) header');
    assert.ok(headers.default, 'a default header');
    assert.equal(textOf(headers.default), `${NAME} · Page `);
    assert.match(headers.default, /PAGE/, 'the page number is a PAGE field');
    assert.match(headers.default, /<w:jc w:val="(right|end)"\/>/);
    assert.ok(!headers.first || textOf(headers.first) === '', 'page 1 prints none');
    const [, distance] = sectPr.match(/w:header="(\d+)"/) || [];
    const [, top] = sectPr.match(/w:top="(\d+)"/) || [];
    assert.ok(Number(distance) > 0 && Number(distance) < Number(top), `the header (${distance}) prints inside the top margin (${top})`);
  });

  it('none where the margin has no room, and none on the cover letter', async () => {
    const tight = await docx(build({ template: 'classic', settings: {} }, { settings: { marginV: 3 } }));
    assert.deepEqual(Object.keys(tight.headers), []);
    assert.doesNotMatch(tight.sectPr, /titlePg/);
    const letter = await docx(build({ template: 'classic', settings: {} }), true);
    assert.deepEqual(Object.keys(letter.headers), []);
  });
});
