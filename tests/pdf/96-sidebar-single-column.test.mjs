// The Sidebar's Layout "Single · ATS-safe" (sidebarSingleColumn) decides where each section prints
// (R2-171). Two columns: the side-column types (SIDEBAR_COLUMN_TYPES — skills, education, languages,
// certifications, interests, references) print in the dark column, the rest in the main one. Single:
// no side column — every type prints in the one column, at its left edge, in the order the résumé
// stores them, and takes the main column's look: a skill category as typed, not capitalised, and
// Section Options → Alignment, which the side column ignores. Word resolves each section the same
// way. 10-section-options had no case for the Layout; 86-sidebar-single-text-exports pins the text
// exports' order, 72-sidebar-single-title-order which field leads a job.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allItems, allText, renderDocx, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const SIDE = ['skills', 'education', 'languages', 'certifications', 'interests', 'references'];

/** The stored order: side-column and main-column types alternating, so a split column would reorder them. */
const SECTIONS = [
  ['skills', ['Toolchainq', 'Zephyrscript'], { category: 'Toolchainq', skills: 'Zephyrscript' }],
  ['experience', ['Kilnwright', 'Quillmark'], { company: 'Quillmark', role: 'Kilnwright', startDate: 'Jan 2020', endDate: 'Dec 2022' }],
  ['languages', ['Occitan'], { language: 'Occitan', proficiency: 'Native' }],
  ['projects', ['Lanternfish'], { name: 'Lanternfish' }],
  ['education', ['Brackenridge', 'Metallurgy'], { institution: 'Brackenridge', degree: 'Metallurgy', startDate: '2014', endDate: '2018' }],
  ['awards', ['Tidewater'], { title: 'Tidewater', date: '2019' }],
  ['certifications', ['Glacierwatch'], { name: 'Glacierwatch', date: 'Mar 2021' }],
  ['volunteering', ['Beachwarden', 'Harborlight'], { org: 'Harborlight', role: 'Beachwarden', startDate: '2018', endDate: '2019' }],
  ['interests', ['Falconry'], { interests: 'Falconry, Chess' }],
  ['custom', ['Stargazer'], { title: 'Stargazer', date: '2020' }],
  ['references', ['Farrowby'], { name: 'Nell Farrowby', company: 'Ravenmoor' }],
];
const TYPES = SECTIONS.map(([type]) => type);

const cv = (single, sectionSettings = {}) => resume({
  template: 'sidebar',
  settings: { sidebarSingleColumn: single },
  personal: { name: 'Wren Calloway', title: 'Surveyor' },
  sections: SECTIONS.map(([type, , item]) => section(type, [item], sectionSettings)),
});

/** Per section type: its topmost printed item (page, y) and the leftmost x of any of its markers. */
function placed(pages) {
  const items = allItems(pages);
  return Object.fromEntries(SECTIONS.map(([type, marks]) => {
    const own = items.filter((t) => marks.some((m) => t.str.toLowerCase().includes(m.toLowerCase())));
    assert.ok(own.length, `${type} prints (${marks})`);
    const top = [...own].sort((a, b) => a.page - b.page || b.y - a.y)[0];
    return [type, { page: top.page, y: top.y, x: Math.min(...own.map((t) => t.x)) }];
  }));
}
const readingOrder = (at) => [...TYPES].sort((a, b) => at[a].page - at[b].page || at[b].y - at[a].y);

describe('which column each section type prints in (R2-171)', () => {
  it('the side-column types are the six SIDE lists, and Single puts none of any type there', async () => {
    const { SIDEBAR_COLUMN_TYPES, inSidebarColumn } = await loadModule('/src/constants/templates.js');
    assert.deepEqual([...SIDEBAR_COLUMN_TYPES].sort(), [...SIDE].sort());
    for (const type of TYPES) {
      assert.equal(inSidebarColumn('sidebar', type, { sidebarSingleColumn: false }), SIDE.includes(type), `two columns: ${type}`);
      assert.equal(inSidebarColumn('sidebar', type, { sidebarSingleColumn: true }), false, `single: ${type}`);
    }
  });

  it('two columns: the side types in the dark column, the others in the main one', async () => {
    const { SIDE_COL } = await loadModule('/src/templates/pdf/shared/PdfSidebarColumn.jsx');
    const pages = await read(await render(cv(false)));
    const split = SIDE_COL * pages[0].W;
    const at = placed(pages);
    for (const type of TYPES) {
      if (SIDE.includes(type)) assert.ok(at[type].x < split, `${type} in the side column: x ${at[type].x.toFixed(1)} < ${split.toFixed(1)}`);
      else assert.ok(at[type].x > split, `${type} in the main column: x ${at[type].x.toFixed(1)} > ${split.toFixed(1)}`);
    }
    assert.ok(allText(pages).includes('TOOLCHAINQ'), 'the side column capitalises a skill category');
  });

  it('Single · ATS-safe: every type in one column, at its left edge, in the stored order', async () => {
    const pages = await read(await render(cv(true)));
    const at = placed(pages);
    assert.deepEqual(readingOrder(at), TYPES, 'the sections print top to bottom as stored');
    // The page's left edge: where the header's name starts (Classic's page, left-aligned).
    const [name] = allItems(pages).filter((t) => t.page === 1 && t.str.includes('Wren'));
    assert.ok(name, 'the name prints');
    for (const type of TYPES) {
      // An interest prints in a chip, 6 pt inside its tint; every other first field at the edge itself.
      assert.ok(at[type].x >= name.x - 1 && at[type].x <= name.x + 10, `${type} starts at the left edge: x ${at[type].x.toFixed(1)}, name at ${name.x.toFixed(1)}`);
    }
  });

  it('Single · ATS-safe: a skill category prints as typed, as in the main column', async () => {
    const text = allText(await read(await render(cv(true))));
    assert.ok(text.includes('Toolchainq') && !text.includes('TOOLCHAINQ'), text);
  });
});

/** The paragraph properties of the Word paragraph printing `mark` (any case). */
function wordPara(doc, mark) {
  const p = doc.paragraphs.find((q) => q.text.toLowerCase().includes(mark.toLowerCase()));
  assert.ok(p, `Word prints ${mark}`);
  const own = p.xml.slice(Math.max(p.xml.lastIndexOf('<w:p>'), p.xml.lastIndexOf('<w:p ')));
  return (own.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
}
const centred = (pPr) => /<w:jc w:val="center"\/>/.test(pPr);

describe('Word resolves each section as the PDF does (R2-171)', () => {
  it('Single: every section in the stored order; a skill category as typed', async () => {
    const doc = await renderDocx(cv(true));
    const first = (marks) => doc.texts.findIndex((t) => marks.some((m) => t.toLowerCase().includes(m.toLowerCase())));
    const at = Object.fromEntries(SECTIONS.map(([type, marks]) => [type, first(marks)]));
    for (const type of TYPES) assert.ok(at[type] >= 0, `${type} is in the .docx`);
    assert.deepEqual([...TYPES].sort((a, b) => at[a] - at[b]), TYPES);
    assert.ok(doc.texts.some((t) => t.includes('Toolchainq')) && !doc.texts.some((t) => t.includes('TOOLCHAINQ')), doc.texts.join(' | '));
  });

  it('two columns: the side column capitalises a skill category', async () => {
    const doc = await renderDocx(cv(false));
    assert.ok(doc.texts.some((t) => t.includes('TOOLCHAINQ')), doc.texts.join(' | '));
  });

  it('Alignment centre: every section centres in Single; in two columns the side types stay left', async () => {
    const single = await renderDocx(cv(true, { alignment: 'center' }));
    const two = await renderDocx(cv(false, { alignment: 'center' }));
    for (const [type, [mark]] of SECTIONS) {
      assert.equal(centred(wordPara(single, mark)), true, `single: ${type} is centred`);
      assert.equal(centred(wordPara(two, mark)), !SIDE.includes(type), `two columns: ${type} ${SIDE.includes(type) ? 'stays left' : 'is centred'}`);
    }
  });
});
