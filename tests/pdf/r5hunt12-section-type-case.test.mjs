// R5-HUNT12-SECTION-TYPE-CASE-LOSES-ENTRIES: a native .json whose section reads "type": "Experience"
// (or "Skills", " education ") loaded as a custom section, which draws none of its entries' company,
// role, dates or skills: the editor showed empty boxes and the PDF printed the heading over a blank
// entry. A template id is read in any case already (R5-5); now a known section type is too, and is
// stored in lower case. A type the app does not know stays a custom section's. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, render, read, allText, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const file = () => ({
  dataVersion: 13,
  personal: { name: 'Ann Lee' },
  settings: {},
  sections: [
    { id: 'e', type: 'Experience', title: 'Experience', items: [{ id: 'e1', company: 'Acme Widgets', role: 'Engineer', startDate: 'Jan 2020', endDate: 'Mar 2023' }] },
    { id: 's', type: ' Skills ', title: 'Skills', items: [{ id: 's1', category: 'Languages', skills: 'Go, Rust' }] },
    { id: 'd', type: 'EDUCATION', title: 'Education', items: [{ id: 'd1', institution: 'State College', degree: 'BSc Physics' }] },
    { id: 'x', type: 'Hobbies', title: 'Hobbies', items: [{ id: 'x1', title: 'Chess' }] },
    { id: 't', type: 'toString', title: 'Odd', items: [{ id: 't1', title: 'Kept' }] },
  ],
});

describe('a section type written in another case', () => {
  it('is stored as its lower-case id; an unknown type is kept as it is', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const r = normalizeResume(file());
    assert.deepEqual(r.sections.map((s) => s.type), ['experience', 'skills', 'education', 'Hobbies', 'toString']);
    assert.deepEqual(r.sections.map((s) => s.id), ['e', 's', 'd', 'x', 't'], 'ids kept');
    assert.equal(normalizeResume(r), r, 'the second load changes nothing');
  });

  it("prints the job's company, role and dates, the degree and the skills", async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const text = allText(await read(await render(normalizeResume(file()))));
    for (const want of ['Acme Widgets', 'Engineer', 'Jan 2020', 'Go, Rust', 'State College', 'BSc Physics']) {
      assert.ok(text.includes(want), `${want} in: ${text}`);
    }
  });
});
