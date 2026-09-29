// R5-HUNT7-BLANK-ENTRY: an entry that prints nothing — one added with 'Add Experience' (or any section's
// add) and left blank, or one whose fields are all hidden with their eyes — still took its place in the
// PDF (and so the preview): an item gap, a grid cell (every later entry one cell on), a bare dot on the
// Timeline rail, and under "Group roles by company" a group of its own that split the company's roles, so
// the employer printed twice. Word, Markdown and the ATS text leave such an entry out (entryPrints). Now
// every PDF renderer draws only the entries that print (printedEntries), so the entries around a blank
// one sit exactly where they would without it. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, renderDocx, read, allText, itemsWith, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

// Per type: an entry that prints (its needle first), and one after the blank ones, with a needle of its own.
const TYPES = {
  experience: [{ company: 'Qexfirst Labs', role: 'Engineer' }, { company: 'Qexlater Works', role: 'Analyst' }],
  education: [{ institution: 'Qedfirst College', degree: 'BSc' }, { institution: 'Qedlater School', degree: 'MSc' }],
  certifications: [{ name: 'Qcefirst Cert', issuer: 'Board' }, { name: 'Qcelater Cert', issuer: 'Guild' }],
  projects: [{ name: 'Qprfirst Tool', technologies: 'Go' }, { name: 'Qprlater App', technologies: 'Rust' }],
  awards: [{ title: 'Qawfirst Prize', issuer: 'Jury' }, { title: 'Qawlater Medal', issuer: 'Panel' }],
  volunteering: [{ org: 'Qvofirst Trust', role: 'Tutor' }, { org: 'Qvolater Club', role: 'Coach' }],
  references: [{ name: 'Qrefirst Moss', jobTitle: 'Director' }, { name: 'Qrelater Hale', jobTitle: 'Manager' }],
  custom: [{ title: 'Qcufirst Talk', subtitle: 'Meetup' }, { title: 'Qculater Paper', subtitle: 'Journal' }],
};
const LATER = Object.values(TYPES).map(([, later]) => Object.values(later)[0]);

// Every field of the entry hidden with its eye: it prints nothing either.
const eyesOff = (entry) => ({ ...entry, hiddenFields: Object.keys(entry) });

const sections = (withBlanks) => Object.entries(TYPES).map(([type, [first, later]]) => section(type,
  withBlanks ? [{}, first, eyesOff({ ...first, location: 'Hidden Town' }), {}, later] : [first, later],
  type === 'certifications' || type === 'references' ? { columns: 2 } : {}));

const where = (pages, needle) => {
  const hit = itemsWith(pages, needle)[0];
  return hit ? { page: hit.page, x: Math.round(hit.x * 10) / 10, y: Math.round(hit.y * 10) / 10 } : null;
};

describe('A blank entry takes no place in the PDF (R5-HUNT7-BLANK-ENTRY)', () => {
  const LAYOUTS = [...TEMPLATES.map((t) => [t, {}]), ['sidebar', { sidebarSingleColumn: true }]];
  for (const [template, settings] of LAYOUTS) {
    const name = `${template}${settings.sidebarSingleColumn ? ' (Single · ATS-safe)' : ''}`;

    it(`${name}: every entry sits where it would without the blank and eyes-off entries around it`, async () => {
      const clean = await read(await render(resume({ template, settings, sections: sections(false) })));
      const blanks = await read(await render(resume({ template, settings, sections: sections(true) })));
      assert.doesNotMatch(allText(blanks), /Hidden Town/, 'an eyes-off entry prints none of its text');
      for (const needle of LATER) {
        const want = where(clean, needle);
        assert.ok(want, `${needle} prints: ${allText(clean)}`);
        assert.deepEqual(where(blanks, needle), want, `${needle} moved by the blank entries`);
      }
    });

    it(`${name}: Group roles by company prints the employer once over a blank entry between its roles`, async () => {
      const exp = section('experience', [
        { company: 'Acmezed Corp', role: 'Junior Dev', startDate: '01/2018', endDate: '12/2019' },
        {},
        eyesOff({ company: 'Acmezed Corp', role: 'Ghost Role' }),
        { company: 'Acmezed Corp', role: 'Senior Dev', startDate: '01/2020', endDate: '12/2021' },
      ], { groupRoles: true });
      const text = allText(await read(await render(resume({ template, settings, sections: [exp] }))));
      assert.match(text, /Junior Dev/, text);
      assert.match(text, /Senior Dev/, text);
      assert.equal((text.match(/Acmezed Corp/g) || []).length, 1, `one employer header: ${text}`);
    });
  }

  // Guard: Word already groups over the entries that print; the PDF now agrees with it.
  it('Word prints one Acmezed group and none of the blank entries', async () => {
    const exp = section('experience', [
      { company: 'Acmezed Corp', role: 'Junior Dev' }, {}, { company: 'Acmezed Corp', role: 'Senior Dev' },
    ], { groupRoles: true });
    const { texts } = await renderDocx(resume({ sections: [exp] }));
    assert.equal(texts.filter((t) => /Acmezed Corp/.test(t)).length, 1, texts.join(' | '));
  });
});
