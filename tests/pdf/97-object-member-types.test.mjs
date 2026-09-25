// R1-LEFT-c (R2-109's fa09eb1, beyond resolveSection): a section whose imported type is named like an
// Object member ('constructor', 'toString', …) is a custom section everywhere it is read by its type,
// not a lookup of that member: every template prints its entries, the JSON Resume export writes it and
// its import reads it back, the ATS report scores it, and a stored one with no title gets a custom
// section's. The Timeline called Object's member as its fields and threw, the JSON export called
// Object's missing `out`, the import its missing `key`, and the ATS report its missing `aliases`.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, read, itemsWith, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const TYPES = ['constructor', 'toString', 'hasOwnProperty', 'valueOf', '__proto__'];
const odd = (type) => ({ id: `odd_${type}`, type, title: `Odd ${type}`, visible: true, settings: {}, items: [{ id: 'i1', title: `Oddentry ${type}`, subtitle: 'Oddsub' }] });

it('every template prints the entries of a section typed like an Object member', async () => {
  const missing = [];
  for (const template of TEMPLATES) {
    for (const type of TYPES) {
      const pages = await read(await render(resume({ template, sections: [odd(type)] })));
      if (!itemsWith(pages, `Oddentry ${type}`).length) missing.push(`${template} ${type}`);
    }
  }
  assert.deepEqual(missing, []);
});

it('the JSON Resume export writes such a section as a custom one', async () => {
  const { cpwtResumeToJsonResume } = await loadModule('/src/utils/jsonResumeExport.js');
  for (const type of TYPES) {
    const out = cpwtResumeToJsonResume(resume({ sections: [odd(type)] }));
    assert.ok(JSON.stringify(out.meta.sections).includes(`Oddentry ${type}`), type);
  }
});

it('the ATS report scores a résumé holding such a section', async () => {
  const { analyzeAtsScore, standardizeSectionsForAts } = await loadModule('/src/utils/atsChecker.js');
  for (const type of TYPES) {
    const r = resume({ sections: [odd(type)] });
    assert.equal(typeof analyzeAtsScore(r).totalScore, 'number', type);
    assert.equal(standardizeSectionsForAts(r.sections)[0].title, `Odd ${type}`, type);
  }
});

it('the JSON Resume import reads such a section back as a custom one', async () => {
  const { jsonResumeToCpwtResume } = await loadModule('/src/utils/jsonResumeImport.js');
  for (const type of TYPES) {
    const r = jsonResumeToCpwtResume({ basics: { name: 'Test Person' }, meta: { sections: [{ type, title: `Odd ${type}`, items: [{ title: `Oddentry ${type}` }] }] } });
    const s = r.sections.find((x) => x.title === `Odd ${type}`);
    assert.equal(s?.type, 'custom', type);
    assert.equal(s.items[0].title, `Oddentry ${type}`, type);
  }
});

it("a stored section with no title, typed like an Object member, takes a custom section's title", async () => {
  const { withSectionShapes } = await loadModule('/src/utils/sectionShapes.js');
  const custom = withSectionShapes({ sections: [{ id: 'c1', type: 'custom', items: [] }] }).sections[0].title;
  for (const type of TYPES) {
    assert.equal(withSectionShapes({ sections: [{ id: 'c1', type, items: [] }] }).sections[0].title, custom, type);
  }
});
