// R2-021: the ATS Check's section_grids warning is the PDF's layout, read back. Section Options →
// Grids 2 prints a section's entries two to a row, and the layout check used to certify a single
// column all the same. The checker now warns when a shown section of multi-line entries prints more
// than one per row (tests/unit/ats-section-grids.unit.mjs pins its rule); this test renders each case
// with the app's own react-pdf code and checks the warning is there exactly when the PDF puts two
// entries on one line — on every template, for every type the rule names, and not in the Sidebar's
// side column, which prints one column whatever Grids says.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, itemsWith, loadModule, TEMPLATES } from './harness.mjs';
import { hasPdftotext, pdftotext } from './extractors.mjs';

before(setup);
after(teardown);

/** Two entries of `type` whose headings carry FIRSTMARK and SECONDMARK, so each can be found on the page. */
const ENTRIES = {
  experience: [{ company: 'Firstmark Labs', role: 'Engineer', startDate: '01/2019', endDate: '12/2020' },
    { company: 'Secondmark Labs', role: 'Engineer', startDate: '01/2021', endDate: '12/2022' }],
  education: [{ institution: 'Firstmark University', degree: 'BSc' }, { institution: 'Secondmark University', degree: 'MSc' }],
  projects: [{ name: 'Firstmark Ledger' }, { name: 'Secondmark Atlas' }],
  volunteering: [{ org: 'Firstmark Club', role: 'Mentor' }, { org: 'Secondmark Bank', role: 'Driver' }],
  custom: [{ title: 'Firstmark Talk', subtitle: 'KubeCon' }, { title: 'Secondmark Paper', subtitle: 'VLDB' }],
};

/** A résumé on `template` whose `type` section prints in `columns` Grids. */
function sample(template, type, columns, settings = {}) {
  return resume({ template, settings, sections: [section(type, ENTRIES[type], { columns })] });
}

/** Whether the PDF prints the two entries on one line, side by side. */
async function sideBySide(r) {
  const pages = await read(await render(r));
  const [a] = itemsWith(pages, 'Firstmark');
  const [b] = itemsWith(pages, 'Secondmark');
  assert.ok(a && b, 'both entries print');
  return Math.abs(a.y - b.y) < 1 && Math.abs(a.x - b.x) > 20;
}

async function warns(r) {
  const { analyzeAtsScore } = await loadModule('/src/utils/atsChecker.js');
  return analyzeAtsScore(r).categories.layout.items.some((i) => i.id === 'section_grids');
}

describe('R2-021: the layout check warns exactly when the PDF prints entries side by side', () => {
  for (const template of TEMPLATES) {
    it(`${template}: experience in Grids 2 prints two jobs to a line and warns; Grids 1 neither`, async () => {
      const grid = sample(template, 'experience', 2);
      assert.equal(await sideBySide(grid), true, 'Grids 2 prints the jobs side by side');
      assert.equal(await warns(grid), true, 'and the layout check says so');
      const flat = sample(template, 'experience', 1);
      assert.equal(await sideBySide(flat), false);
      assert.equal(await warns(flat), false);
    });
  }

  for (const type of ['education', 'projects', 'volunteering', 'custom']) {
    it(`classic: ${type} in Grids 2 prints side by side and warns`, async () => {
      const r = sample('classic', type, 2);
      assert.equal(await sideBySide(r), true);
      assert.equal(await warns(r), true);
    });
  }

  it('the Sidebar\'s side column prints education one under another whatever Grids says, and does not warn', async () => {
    const side = sample('sidebar', 'education', 2);
    assert.equal(await sideBySide(side), false);
    assert.equal(await warns(side), false);
    const single = sample('sidebar', 'education', 2, { sidebarSingleColumn: true });
    assert.equal(await sideBySide(single), true, 'single column: it is in the main column, in its grid');
    assert.equal(await warns(single), true);
  });

  it('Poppler\'s layout mode reads the two jobs on one line: the lines a line-reading parser interleaves', { skip: !hasPdftotext && 'pdftotext is not installed' }, async () => {
    const [, layout] = pdftotext(await render(sample('classic', 'experience', 2))).find(([label]) => label.includes('-layout'));
    assert.ok(layout.split('\n').some((line) => line.includes('Firstmark') && line.includes('Secondmark')), layout);
  });
});
