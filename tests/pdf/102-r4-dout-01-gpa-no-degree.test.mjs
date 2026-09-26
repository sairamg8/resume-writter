// R4-DOUT-01: an Education entry with a GPA but no degree or field prints "GPA: 3.8" on its sub line,
// with no stray leading " · " separator — in Classic (EducationSection) and Timeline (its own
// education fields) alike; with no school the sub leads the title line, and it too starts "GPA".
// With a degree the separator stays between the two. Word already joins them this way.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allText, itemsWith } from './harness.mjs';

before(setup);
after(teardown);

const ENTRY = { institution: 'Northfield Institute', degree: '', fieldOfStudy: '', gpa: '3.8', startDate: '2016', endDate: '2020' };

async function printed(template, item) {
  const pages = await read(await render(resume({ template, sections: [section('education', [item])] })));
  return { text: allText(pages), gpaItems: itemsWith(pages, 'GPA') };
}

for (const template of ['classic', 'timeline']) {
  describe(`${template}: a GPA without a degree`, () => {
    it('prints "GPA: 3.8" with no separator before it', async () => {
      const { text, gpaItems } = await printed(template, ENTRY);
      assert.ok(text.includes('GPA: 3.8'), text);
      assert.doesNotMatch(text, /·\s*GPA/, text);
      assert.ok(gpaItems.length > 0, 'a GPA text item prints');
      for (const t of gpaItems) assert.ok(!t.str.trim().startsWith('·'), `text item "${t.str}" starts with a separator`);
    });

    it('with no school either, the title line starts "GPA"', async () => {
      const { text, gpaItems } = await printed(template, { ...ENTRY, institution: '' });
      assert.ok(text.includes('GPA: 3.8'), text);
      assert.doesNotMatch(text, /·\s*GPA/, text);
      for (const t of gpaItems) assert.ok(!t.str.trim().startsWith('·'), `text item "${t.str}" starts with a separator`);
    });

    it('with a degree, the separator stays between degree and GPA', async () => {
      const { text } = await printed(template, { ...ENTRY, degree: 'B.Sc', fieldOfStudy: 'Physics' });
      assert.ok(text.includes('B.Sc, Physics · GPA: 3.8'), text);
    });
  });
}
