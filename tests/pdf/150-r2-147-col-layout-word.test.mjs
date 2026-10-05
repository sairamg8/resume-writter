// R2-147-col — the Word file of the Sidebar's column layout (Design → Template → Layout). Word has no side
// column: the Sidebar's .docx prints its header on a band and its sections one after another, in their
// order — so Details Left, Right and Top and the column's width print the same file (the documented
// fallback, docs/knowledge/06-templates-export.md). Mixed is drawn as the PDF draws it: the main sections
// first, then the short ones two to a row, a borderless table a row whose cells start where the PDF's
// columns do, each section laid out at its cell's width with one entry to a row. Before this, Word printed
// a Mixed résumé as the side-column one, its short sections in their stored order.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

/** Skills stored first, before Experience: Mixed prints it after the main sections. */
const cv = (settings = {}) => resume({
  template: 'sidebar',
  settings,
  personal: { name: 'Avery Stone', title: 'Platform Engineer', email: 'avery@example.com' },
  sections: [
    section('skills', [{ category: 'Coding', skills: 'TypeScript, Go, SQL' }]),
    experience([{ company: 'Northwind', role: 'Staff Engineer', description: '<p>Led the billing platform rewrite.</p>' }]),
    section('education', [{ institution: 'University of Porto', degree: 'MSc Informatics', startDate: '09/2012', endDate: '06/2014' }]),
    section('languages', [{ language: 'Portuguese', proficiency: 'Native' }, { language: 'English', proficiency: 'Fluent' }]),
  ],
});

const TWIPS_PER_MM = 1440 / 25.4;
const PAPER = Math.round(210 * TWIPS_PER_MM); // A4's width, twips (11906)
const MARGIN = Math.round(18 * TWIPS_PER_MM); // a new résumé's Left / Right margin, twips
const tables = (xml) => xml.split('<w:tbl>').slice(1).map((t) => t.split('</w:tbl>')[0]);
const at = (texts, re) => texts.findIndex((t) => re.test(t.trim()));

describe('Word prints the Sidebar\'s column layout where it can (R2-147-col)', () => {
  it('Mixed: the main sections first, then the short ones two to a row, in cells where the PDF\'s columns start', async () => {
    const [plain, mixed] = [await renderDocx(cv()), await renderDocx(cv({ layoutColumns: 'mixed' }))];
    assert.ok(at(plain.texts, /^skills$/i) < at(plain.texts, /^professional experience$/i), 'the side column page: sections in their order');
    const order = [/^professional experience$/i, /^skills$/i, /^education$/i, /^languages$/i].map((re) => at(mixed.texts, re));
    assert.ok(order.every((i) => i >= 0), `every title prints: ${order}`);
    assert.deepEqual([...order].sort((a, b) => a - b), order, 'Experience, then Skills, Education, Languages');
    // Two rows: [Skills | Education] and [Languages | —], each a table of two cells beside the header's band —
    // and no more: Languages (Grids 2 stored) prints one to a line, no grid table inside its cell.
    const rows = tables(mixed.xml).slice(tables(plain.xml).length);
    assert.equal(rows.length, 2, 'two rows of two, no table inside them');
    const left = Math.round(PAPER * 0.38) - MARGIN;
    for (const row of rows) {
      const cols = [...row.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) => Number(m[1]));
      assert.deepEqual(cols, [left, PAPER - 2 * MARGIN - left], 'the left cell runs to 38 % of the paper, the right one the rest');
      assert.equal((row.match(/<w:tc>/g) || []).length, 2, 'two cells');
    }
    assert.match(rows[0], /SKILLS/i);
    assert.match(rows[0], /EDUCATION/i);
    assert.match(rows[1], /LANGUAGES/i);
    // Education, in the right cell, puts its dates at the cell's text edge (its padding off), not the page's.
    const rightText = PAPER - 2 * MARGIN - left - Math.round(14 * 20);
    assert.match(rows[0], new RegExp(`<w:tab w:val="right" w:pos="${rightText}"/>`), 'the dates\' tab at the right cell\'s text edge');
  });

  it('Width sets Mixed\'s left cell', async () => {
    const { xml } = await renderDocx(cv({ layoutColumns: 'mixed', layoutSideWidth: 30 }));
    const row = tables(xml).at(-1);
    const left = Math.round(PAPER * 0.3) - MARGIN;
    assert.deepEqual([...row.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) => Number(m[1])), [left, PAPER - 2 * MARGIN - left]);
  });

  it('Details Left, Right and Top and the column\'s width print the same Word file: Word has no side column', async () => {
    const base = (await renderDocx(cv())).xml;
    for (const settings of [{ layoutColumns: 'two', layoutDetails: 'left', layoutSideWidth: 38 }, { layoutDetails: 'right' }, { layoutDetails: 'top' }, { layoutSideWidth: 26 }]) {
      assert.equal((await renderDocx(cv(settings))).xml, base, JSON.stringify(settings));
    }
  });
});
