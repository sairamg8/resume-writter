// R2-031, R2-055, R2-056, R2-110: a résumé's sections as a hand-written or other-tool .json, or an
// older save, can hold them. A null section, a null entry or `items` that is not a list crashed the
// editor, the PDF, Word, Markdown and the JSON Resume export (R2-031). Sections or entries with no id
// (or the same id twice) were edited, renamed and deleted together, as the store finds them by id
// (R2-055). A section with no title crashed the PDF (title.toUpperCase()), one with no items the editor
// (R2-056). Grids stored as text ("2") or out of range crammed a row, as the grid steps by `i += cols`
// (R2-110). normalizeResume() now gives every résumé coming in (load, import, restore, cloud merge) a
// list of section objects, each with a unique id, a title and a list of entry objects with unique ids,
// and Grids of 1–4 — keeping every valid id as it was, since the cloud sync keys on them.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, renderDocx, read, allText, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const normalizer = () => loadModule('/src/utils/normalizeResume.js');

/** `r` as a file stores it (after JSON.parse). */
const asFile = (r) => JSON.parse(JSON.stringify(r));

/** Every section's and entry's id in `r`. */
const idsOf = (r) => r.sections.flatMap((s) => [s.id, ...s.items.map((i) => i.id)]);

/** The PDF, Word, Markdown and JSON Resume export of `r`, as text: each throws on a bad shape. */
async function exportsOf(r) {
  const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
  const { cpwtResumeToJsonResume } = await loadModule('/src/utils/jsonResumeExport.js');
  return {
    pdf: allText(await read(await render(r))),
    docx: (await renderDocx(r)).texts.join(' '),
    md: generateMarkdownResume(r),
    json: JSON.stringify(cpwtResumeToJsonResume(r)),
  };
}

describe('R2-031: null sections, null entries and items that are not a list', () => {
  it('are dropped or made a list, and every export works', async () => {
    const { normalizeResume } = await normalizer();
    const work = experience([{ company: 'Acme Works' }]);
    const raw = asFile(resume({ sections: [work] }));
    raw.sections = [null, 7, 'x', [], { ...raw.sections[0], items: [null, raw.sections[0].items[0], 3, 'y'] },
      { id: 'sk', type: 'skills', title: 'Skills', items: { a: 1 } }, { id: 'pj', type: 'projects', title: 'Projects' }];
    const r = normalizeResume(raw);
    assert.equal(r.sections.length, 3, 'the three sections, not the null, the number, the text or the list');
    assert.deepEqual(r.sections.map((s) => s.items.length), [1, 0, 0]);
    assert.equal(r.sections[0].items[0].company, 'Acme Works');
    const out = await exportsOf(r);
    for (const [kind, text] of Object.entries(out)) assert.match(text, /Acme Works/, kind);
  });

  it('sections that are not a list become none', async () => {
    const { normalizeResume } = await normalizer();
    for (const sections of [null, undefined, { a: 1 }, 'x']) {
      const raw = asFile(resume());
      raw.sections = sections;
      assert.deepEqual(normalizeResume(raw).sections, [], String(sections));
    }
  });
});

describe('R2-055: sections and entries with no id, or the same id twice', () => {
  it('get ids of their own: unique across the résumé, and every valid id kept', async () => {
    const { normalizeResume } = await normalizer();
    const { createSectionActions } = await loadModule('/src/hooks/useResumeSectionActions.js');
    const raw = asFile(resume({ sections: [experience([{ company: 'A' }, { company: 'B' }, { company: 'C' }]), section('skills', [{ category: 'X' }])] }));
    const [work, skills] = raw.sections;
    const keptSection = skills.id;
    const keptEntry = work.items[0].id;
    delete work.id;
    delete work.items[1].id;
    work.items[2].id = keptEntry; // the same id twice
    skills.items[0].id = '';
    raw.sections.push({ ...asFile(skills), id: keptSection, title: 'Skills again' }); // a section's id twice
    const r = normalizeResume(raw);
    const ids = idsOf(r);
    assert.equal(new Set(ids).size, ids.length, `unique: ${ids.join(' ')}`);
    assert.ok(ids.every((id) => typeof id === 'string' && id), 'every one is text');
    assert.equal(r.sections[0].items[0].id, keptEntry, 'the first holder of an id keeps it');
    assert.equal(r.sections[1].id, keptSection);
    assert.equal(normalizeResume(r), r, 'a second load changes nothing: the same object');
    assert.deepEqual(idsOf(normalizeResume(raw)), ids, 'the same ids on every load, so two devices agree');

    // Typing in the first entry changes it alone; deleting one deletes it alone.
    let state = r;
    const actions = createSectionActions((fn) => { state = fn(state); });
    actions.updateItem(state.sections[0].id, state.sections[0].items[0].id, (i) => ({ ...i, company: 'Typed' }));
    assert.deepEqual(state.sections[0].items.map((i) => i.company), ['Typed', 'B', 'C']);
    actions.removeItem(state.sections[0].id, state.sections[0].items[1].id);
    assert.deepEqual(state.sections[0].items.map((i) => i.company), ['Typed', 'C']);
    actions.updateSection(state.sections[1].id, (s) => ({ ...s, title: 'Renamed' }));
    assert.deepEqual(state.sections.map((s) => s.title), ['Professional Experience', 'Renamed', 'Skills again']);
  });

  it('a résumé whose ids are all there and unique is the same object', async () => {
    const { normalizeResume } = await normalizer();
    const r = normalizeResume(asFile(resume({ sections: [experience([{}, {}]), section('skills', [{}])] })));
    assert.equal(normalizeResume(r), r);
  });
});

describe('R2-056: a section with no title, or no items', () => {
  it('gets its type\'s title and no entries, and the PDF, Word and the rest print it', async () => {
    const { normalizeResume } = await normalizer();
    const raw = asFile(resume({ template: 'classic', sections: [experience([{ company: 'Acme Works' }]), section('skills', [{ category: 'Tools', skills: 'Go' }])] }));
    delete raw.sections[0].title;
    raw.sections[1].title = null;
    raw.sections.push({ id: 'c1', type: 'custom', title: 'Extra' });
    raw.sections.push({ id: 'c2', type: 'nosuchtype', items: [{ title: 'Kept' }] });
    const r = normalizeResume(raw);
    assert.deepEqual(r.sections.map((s) => s.title), ['Professional Experience', 'Skills', 'Extra', 'Custom Section']);
    assert.deepEqual(r.sections[2].items, []);
    for (const template of ['classic', 'sidebar']) {
      const out = await exportsOf({ ...r, template });
      assert.match(out.pdf, /PROFESSIONAL EXPERIENCE/i, template);
      assert.match(out.pdf, /Acme Works/, template);
    }
  });
});

describe('R2-110: Grids stored as text or out of range', () => {
  it('are stored as a whole number from 1 to 4; none, or no number, prints the default', async () => {
    const { normalizeResume } = await normalizer();
    const cases = [['2', 2], [' 3 ', 3], [2.4, 2], [7, 4], [0, 1], [-2, 1], ['abc', undefined], [true, undefined], [null, undefined], [3, 3]];
    for (const [stored, want] of cases) {
      const raw = asFile(resume({ sections: [section('skills', [{}], { columns: stored })] }));
      const settings = normalizeResume(raw).sections[0].settings;
      assert.equal(settings.columns, want, JSON.stringify(stored));
      if (want === undefined) assert.ok(!('columns' in settings), `${JSON.stringify(stored)}: dropped`);
    }
  });

  it('"2" on a section of five entries prints two to a row, as 2 does', async () => {
    const { normalizeResume } = await normalizer();
    const items = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map((category) => ({ category, skills: 'x' }));
    const good = resume({ sections: [section('skills', items, { columns: 2, skillsStyle: 'stacked' })] });
    const raw = asFile(good);
    raw.sections[0].settings.columns = '2';
    const rows = async (r) => {
      const pages = await read(await render(r));
      const ys = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map((n) => Math.round(pages[0].items.find((t) => t.str.includes(n)).y));
      return ys;
    };
    const want = await rows(good);
    assert.equal(new Set(want).size, 3, 'two to a row: three rows');
    assert.deepEqual(await rows(normalizeResume(raw)), want);
  });
});
