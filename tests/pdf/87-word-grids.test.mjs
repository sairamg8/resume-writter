// Section Options → Grids in the Word résumé (R2-070, R2-061). The PDF lays a section's entries out
// `cols` to a row (RenderColGrid, the Timeline's rail, the Sidebar page's cards) — Grids 2 on a job,
// up to 4 on skills; Languages and References two to a row unless set to one — each cell 48 %, 31 %
// or 23 % of the column wide, the cells spread to both edges. Word printed every section one entry
// under another, whatever Grids said. Now a grid is a borderless table of those columns, the entries
// in reading order, row by row; the Sidebar's side column stays one column, as its PDF prints it.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allItems, renderDocx, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

/** Two entries of every section with Grids, each led by a word of its own. */
const TYPES = {
  experience: [{ company: 'Alphaco', role: 'Lead', startDate: '2019', endDate: '2020' }, { company: 'Betaco', role: 'Dev', startDate: '2017', endDate: '2018' }],
  education: [{ institution: 'Alphauni', degree: 'BA' }, { institution: 'Betauni', degree: 'MA' }],
  skills: [{ category: 'Alphaskill', skills: 'Go' }, { category: 'Betaskill', skills: 'Rust' }],
  projects: [{ name: 'Alphaproj' }, { name: 'Betaproj' }],
  certifications: [{ name: 'Alphacert' }, { name: 'Betacert' }],
  awards: [{ title: 'Alphaaward' }, { title: 'Betaaward' }],
  volunteering: [{ role: 'Alphavol', org: 'Org' }, { role: 'Betavol', org: 'Org' }],
  custom: [{ title: 'Alphacustom' }, { title: 'Betacustom' }],
  languages: [{ language: 'Alphalang', proficiency: 'Native' }, { language: 'Betalang', proficiency: 'Fluent' }],
  references: [{ name: 'Alpharef', jobTitle: 'CTO' }, { name: 'Betaref', jobTitle: 'CEO' }],
};
const lead = (type, i) => `${i ? 'Beta' : 'Alpha'}${{ experience: 'co', education: 'uni', skills: 'skill', projects: 'proj', certifications: 'cert', awards: 'award', volunteering: 'vol', custom: 'custom', languages: 'lang', references: 'ref' }[type]}`;
/** The Sidebar's side column (SIDEBAR_COLUMN_TYPES): one column in its PDF, whatever Grids says. */
const SIDE = ['skills', 'education', 'languages', 'certifications', 'references'];

const cv = (template, columns) => resume({
  template,
  personal: { name: 'Robin Sample', title: 'Engineer' },
  sections: Object.entries(TYPES).map(([type, items]) => section(type, items, columns === undefined ? {} : { columns }, type === 'custom' ? { title: 'Extra' } : {})),
});

/** The .docx's tables: each one's column widths (twips) and its rows, each a list of its cells' text. */
function tables(xml) {
  return [...xml.matchAll(/<w:tbl>(.*?)<\/w:tbl>/gs)].map(([, tbl]) => ({
    xml: tbl,
    columns: [...tbl.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) => Number(m[1])),
    rows: [...tbl.matchAll(/<w:tr>(.*?)<\/w:tr>/gs)].map(([, tr]) => [...tr.matchAll(/<w:tc>(.*?)<\/w:tc>/gs)].map(([, tc]) => ({
      xml: tc,
      text: [...tc.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''),
    }))),
  }));
}

/** Does the PDF print entry 2 beside entry 1: their first words on one baseline, well apart. */
function pdfBeside(items, type) {
  const [a, b] = [0, 1].map((i) => items.find((t) => t.str.toUpperCase().includes(lead(type, i).toUpperCase())));
  assert.ok(a && b, `${type}: both entries in the PDF`);
  return Math.abs(a.y - b.y) < 3 && b.x - a.x > 60;
}

/** Does Word print entry 2 beside entry 1: in the next cell of the same table row. */
function wordBeside(xml, type) {
  const has = (cell, i) => cell.text.toUpperCase().includes(lead(type, i).toUpperCase());
  return tables(xml).some((t) => t.rows.some((row) => row.some((c, k) => has(c, 0) && row[k + 1] && has(row[k + 1], 1))));
}

describe('Word: Section Options → Grids lays entries out side by side, as the PDF does (R2-070)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: entry 2 prints beside entry 1 in Word exactly where it does in the PDF — Grids 1, 2 and unset`, async () => {
      const wrong = [];
      for (const columns of [1, 2, undefined]) {
        const r = cv(template, columns);
        const items = allItems(await read(await render(r)));
        const { xml } = await renderDocx(r);
        for (const type of Object.keys(TYPES)) {
          const [pdf, word] = [pdfBeside(items, type), wordBeside(xml, type)];
          if (pdf !== word) wrong.push(`${template} Grids ${columns ?? 'unset'} ${type}: PDF ${pdf ? 'beside' : 'under'}, Word ${word ? 'beside' : 'under'}`);
        }
      }
      assert.deepEqual(wrong, []);
    });
  }

  it('the Sidebar\'s side column stays one column at Grids 2; its Single · ATS-safe page lays them out as Classic', async () => {
    const side = tables((await renderDocx(cv('sidebar', 2))).xml).flatMap((t) => t.rows.flat().map((c) => c.text)).join(' ');
    for (const type of SIDE) assert.ok(!side.includes(lead(type, 0)), `${type} in no table`);
    const single = cv('sidebar', 2);
    single.settings.sidebarSingleColumn = true;
    const { xml } = await renderDocx(single);
    for (const type of SIDE) assert.ok(wordBeside(xml, type), `${type} in two columns`);
  });

  it('Classic: a borderless table as wide as the page\'s text, its cells where the PDF\'s start, 48 %, 31 % and 23 % wide', async () => {
    const { PAGE_SIZES } = await loadModule('/src/constants/pageSize.js');
    const width = PAGE_SIZES.A4.twips.width - 2 * Math.round((18 * 1440) / 25.4);
    for (const [columns, share] of [[2, 0.48], [3, 0.31], [4, 0.23]]) {
      const skills = [1, 2, 3, 4, 5].map((n) => ({ category: `Group${n}`, skills: 'Go' }));
      const r = resume({ sections: [section('skills', skills, { columns })] });
      const [table] = tables((await renderDocx(r)).xml);
      assert.ok(table, `Grids ${columns}: a table`);
      assert.deepEqual(table.rows.map((row) => row.map((c) => c.text)), columns === 2
        ? [['Group1: Go', 'Group2: Go'], ['Group3: Go', 'Group4: Go'], ['Group5: Go', '']]
        : columns === 3 ? [['Group1: Go', 'Group2: Go', 'Group3: Go'], ['Group4: Go', 'Group5: Go', '']]
          : [['Group1: Go', 'Group2: Go', 'Group3: Go', 'Group4: Go'], ['Group5: Go', '', '', '']], `Grids ${columns}: row by row`);
      assert.equal(table.columns.reduce((a, b) => a + b, 0), width, `Grids ${columns}: the page's text width`);
      // Each cell's text box: where the column starts, as wide as the PDF's cell (its right margin the gap).
      const cell = Math.round(width * share);
      const gap = (width - columns * cell) / (columns - 1);
      let x = 0;
      table.columns.forEach((w, i) => {
        const right = Number(/<w:right w:w="(\d+)" w:type="dxa"\/>/.exec(table.rows[0][i].xml)?.[1] ?? 0);
        assert.ok(Math.abs(x - Math.round(i * (cell + gap))) <= 1, `Grids ${columns} cell ${i + 1} starts at ${x}`);
        assert.ok(Math.abs(w - right - cell) <= 1, `Grids ${columns} cell ${i + 1}: ${w - right} wide (want ${cell})`);
        x += w;
      });
      assert.doesNotMatch(table.xml, /w:val="(single|double|thick|dashed|dotted)"/, `Grids ${columns}: no borders`);
    }
  });

  it('a job\'s dates sit at the right edge of its cell, not the page\'s', async () => {
    const r = resume({ sections: [section('experience', TYPES.experience, { columns: 2 })] });
    const { xml } = await renderDocx(r);
    const [table] = tables(xml);
    const tab = Number(/<w:tab w:val="right" w:pos="(\d+)"\/>/.exec(table.rows[0][0].xml)?.[1]);
    const right = Number(/<w:right w:w="(\d+)" w:type="dxa"\/>/.exec(table.rows[0][0].xml)?.[1] ?? 0);
    assert.equal(tab, table.columns[0] - right);
  });
});
