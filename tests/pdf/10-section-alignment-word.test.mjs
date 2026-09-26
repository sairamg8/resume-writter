// Section Options → Alignment "Center" in the Word résumé: it centres what the PDF centres — the
// section title, every entry with its date on the title line after a "·" ("Title · date", the
// PDF's CentredLine, R4-DOUT-03) and its location on a line of its own (ATS-1), the entry's text
// and bullets — in every template, and
// nothing of the Sidebar's side column, which the PDF prints as one left-aligned column whatever
// the section stores.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, renderDocx, read, itemsWith, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

/** One entry of every section type; `word` is the first word of its title line, `date` of its date, `place` its location. */
const TYPES = {
  experience: { word: 'ExpCo', date: '01/2020', place: 'ExpCity', items: [{ company: 'ExpCo', role: 'ExpRole', location: 'ExpCity', startDate: '01/2020', endDate: '12/2021', description: '<p>ExpText</p><ul><li>ExpBullet</li></ul>', bullets: ['ExpLegacy'] }] },
  education: { word: 'EduUni', date: '2012', place: 'EduCity', items: [{ institution: 'EduUni', degree: 'EduDeg', location: 'EduCity', startDate: '2012', endDate: '2016', description: '<p>EduText</p>' }] },
  skills: { word: 'SkillCat', items: [{ category: 'SkillCat', skills: 'SkillList' }] },
  projects: { word: 'ProjName', date: '2021', under: 'ProjTech', items: [{ name: 'ProjName', technologies: 'ProjTech', startDate: '2021', endDate: '2022', description: '<p>ProjText</p>' }] },
  languages: { word: 'LangName', items: [{ language: 'LangName', proficiency: 'LangLevel' }] },
  certifications: { word: 'CertName', date: '2020', items: [{ name: 'CertName', issuer: 'CertIssuer', date: '2020' }] },
  awards: { word: 'AwardName', date: '2019', items: [{ title: 'AwardName', issuer: 'AwardIssuer', date: '2019', description: '<p>AwardText</p>' }] },
  volunteering: { word: 'VolRole', date: '2018', place: 'VolCity', items: [{ role: 'VolRole', org: 'VolOrg', location: 'VolCity', startDate: '2018', endDate: '2019', description: '<p>VolText</p>' }] },
  references: { word: 'RefName', items: [{ name: 'RefName', jobTitle: 'RefJob', company: 'RefCo', relationship: 'RefRel', email: 'ref@example.com', phone: '+1 555 0100' }] },
  interests: { word: 'IntOne', items: [{ interests: 'IntOne, IntTwo' }] },
  custom: { word: 'CustTitle', date: '2017', place: 'CustCity', items: [{ title: 'CustTitle', subtitle: 'CustSub', location: 'CustCity', date: '2017', description: '<p>CustText</p>' }] },
};
/** The two fields of each entry with a Title (Section Options → Title). */
const TITLED = { experience: ['ExpCo', 'ExpRole'], education: ['EduUni', 'EduDeg'], volunteering: ['VolRole', 'VolOrg'], custom: ['CustTitle', 'CustSub'] };
const heading = (type) => `HEAD${type.toUpperCase()}`;
/** A résumé with a section of every type, each at `alignment`. */
const everyType = (template, alignment) => resume({
  template,
  sections: Object.entries(TYPES).map(([type, { items }]) => section(type, items, { alignment }, { title: heading(type) })),
});

const jc = (xml) => /<w:jc w:val="(\w+)"\/>/.exec(xml)?.[1] || null;
/** The Word paragraphs of each section, by type: those from its title to the next one's. */
function byType(doc) {
  const out = {};
  let at = null;
  for (const p of doc.paragraphs) {
    const type = Object.keys(TYPES).find((t) => p.text === heading(t));
    if (type) out[at = type] = [];
    if (at) out[at].push(p);
  }
  return out;
}

describe('Word: Section Options → Alignment "Center" centres what the PDF centres', () => {
  for (const template of TEMPLATES) {
    it(`${template}: every paragraph of a centred section is centred, as its PDF is — none of the Sidebar's side column`, async () => {
      const { SIDEBAR_COLUMN_TYPES } = await import('../../src/constants/templates.js');
      const [left, centre] = await Promise.all(['left', 'center'].map(async (a) => read(await render(everyType(template, a)))));
      const doc = byType(await renderDocx(everyType(template, 'center')));
      const { sectionHeadingLook } = await loadModule('/src/templates/pdf/shared/sectionHeadingLook.js');
      // The PDF centres a section when its title moves to the middle of the column — or, where the template
      // centres every title whatever the Alignment (Lectern, R2-138 B2), when its first entry does.
      const titlesCentred = Boolean(sectionHeadingLook({ template }).center);
      for (const type of Object.keys(TYPES)) {
        const probe = titlesCentred ? TYPES[type].word : heading(type);
        const [l, c] = [itemsWith(left, probe)[0], itemsWith(centre, probe)[0]];
        assert.ok(l && c, `${template} ${type}: "${probe}" prints`);
        const pdfCentred = c.x - l.x > 20;
        const side = template === 'sidebar' && SIDEBAR_COLUMN_TYPES.includes(type);
        assert.equal(pdfCentred, !side, `${template} ${type}: the PDF ${side ? 'keeps the side column left' : 'centres it'}`);
        assert.ok(doc[type]?.length > 1, `${template} ${type}: printed in Word`);
        for (const p of doc[type]) assert.equal(jc(p.xml), pdfCentred ? 'center' : null, `${template} ${type}: ${JSON.stringify(p.text)}`);
      }
    });

    it(`${template}: a centred entry prints "Title · date" on its first line, as the PDF's CentredLine, and its location on a line of its own`, async () => {
      const { SIDEBAR_COLUMN_TYPES } = await import('../../src/constants/templates.js');
      const { resolveSection } = await loadModule('/src/templates/pdf/shared/templateSectionDefaults.js');
      const r = everyType(template, 'center');
      const doc = byType(await renderDocx(r));
      for (const [type, { word, date, place, under }] of Object.entries(TYPES)) {
        if (!date) continue;
        const text = doc[type].find((p) => p.text.includes(word)).text;
        if (template === 'sidebar' && SIDEBAR_COLUMN_TYPES.includes(type)) {
          // The side column keeps the date at the right margin, the location right-aligned under it.
          const expected = place ? [`\t${date}`, `\t${place}`] : [`\t${date}`];
          const lines = text.split('\n');
          assert.ok(lines.length === expected.length && expected.every((e, i) => lines[i].includes(e)), `${template} ${type}: ${JSON.stringify(text)}`);
          continue;
        }
        const lines = text.split('\n');
        // An award stacks its title, issuer and date, as the PDF's AwardsSection does (R4-DOUT-05).
        if (type === 'awards') {
          assert.deepEqual(lines, ['AwardName', 'AwardIssuer', date], `${template} ${type}: ${JSON.stringify(text)}`);
          continue;
        }
        // A certification's PDF prints its date under the name: Word keeps it there.
        if (!TITLED[type] && type !== 'projects') {
          assert.ok(lines[0].includes(word) && lines[1]?.startsWith(date) && !text.includes('\t'), `${template} ${type}: ${JSON.stringify(text)}`);
          continue;
        }
        // The PDF's CentredLine: the title line ends " · date" (R4-DOUT-03; it had the date on a line of
        // its own). Title "Stacked" (the default but Executive's and the Timeline's jobs) puts the
        // entry's second field on a centred line of its own under it, as the PDF's sub line (R2-070).
        const fields = TITLED[type];
        const stacked = fields && (resolveSection(r.sections.find((s) => s.type === type), template).settings.titleStyle || 'stacked') === 'stacked';
        if (template === 'timeline') {
          // The Timeline's rail prints the date on a line of its own (above the title), never
          // "Title · date": Word keeps it on a centred line of its own, under the title (R4-DOUT-03).
          assert.equal(lines.length, 2 + (stacked ? 1 : 0) + (under ? 1 : 0) + (place ? 1 : 0), `${template} ${type}: ${JSON.stringify(text)}`);
          if (under) assert.equal(lines[2], under, `${template} ${type}: ${JSON.stringify(text)}`);
          const title = stacked ? [lines[0], lines[2]].sort().join() === [...fields].sort().join() : lines[0].includes(word);
          assert.ok(title && lines[1].startsWith(date) && !lines[0].includes('·') && !text.includes('\t'), `${template} ${type}: ${JSON.stringify(text)}`);
          if (place) assert.equal(lines.at(-1), place, `${template} ${type}: the location on a line of its own (ATS-1)`);
          continue;
        }
        const [head, tail] = lines[0].split(` · ${date}`);
        assert.ok(tail !== undefined && !text.includes('\t'), `${template} ${type}: "Title · date", no right-tab date: ${JSON.stringify(text)}`);
        assert.ok(!lines.slice(1).some((l) => l.includes(date)), `${template} ${type}: no date line of its own: ${JSON.stringify(text)}`);
        const title = stacked ? [head, lines[1]].sort().join() === [...fields].sort().join() : head.includes(word);
        assert.ok(title, `${template} ${type}: ${JSON.stringify(text)}`);
        // A project's technologies and link: a centred line of their own under the title, as the PDF's (R4-DOUT-04).
        assert.equal(lines.length, 1 + (stacked ? 1 : 0) + (under ? 1 : 0) + (place ? 1 : 0), `${template} ${type}: ${JSON.stringify(text)}`);
        if (under) assert.equal(lines[1], under, `${template} ${type}: ${JSON.stringify(text)}`);
        if (place) assert.equal(lines.at(-1), place, `${template} ${type}: the location on a line of its own (ATS-1)`);
      }
    });
  }

  it('in a centred section, rich text blocks and legacy bullets are centred; a block aligned in the editor keeps its alignment', async () => {
    const description = '<p>Plain</p><p style="text-align: right;">Righty</p><ul><li>Listed</li></ul><ol><li>Numbered</li></ol>';
    const items = [{ company: 'Acme', role: 'Lead', startDate: '2020', description, bullets: ['Legacy'] }];
    const aligned = async (alignment) => {
      const doc = await renderDocx(resume({ sections: [section('experience', items, { alignment })] }));
      return Object.fromEntries(['Plain', 'Righty', 'Listed', '1.\tNumbered', 'Legacy'].map((t) => [t, jc(doc.paragraphs.find((p) => p.text === t).xml)]));
    };
    assert.deepEqual(await aligned('center'), { Plain: 'center', Righty: 'right', Listed: 'center', '1.\tNumbered': 'center', Legacy: 'center' });
    // Guard: left, only what the editor aligned is aligned (as before).
    assert.deepEqual(await aligned('left'), { Plain: null, Righty: 'right', Listed: null, '1.\tNumbered': null, Legacy: null });
  });

  it('a centred entry with nothing but its dates prints the dates alone — no empty line above them', async () => {
    for (const [type, item] of [['experience', { startDate: '01/2020', endDate: '12/2021' }], ['projects', { startDate: '2021' }], ['awards', { date: '2019' }]]) {
      const doc = await renderDocx(resume({ sections: [section(type, [item], { alignment: 'center' }, { title: 'Dated' })] }));
      const p = doc.paragraphs[doc.texts.indexOf('DATED') + 1];
      assert.ok(/^\d/.test(p.text) && !/[\n\t]/.test(p.text), `${type}: ${JSON.stringify(p.text)}`);
      assert.equal(jc(p.xml), 'center', type);
    }
  });

  // Guard: unset, Left, or a value the app never writes (imported JSON) print left, as the PDF does.
  it('unset, "left" or an unknown alignment centres nothing and keeps each date at the right margin (guard)', async () => {
    for (const alignment of [undefined, 'left', 'right']) {
      const doc = byType(await renderDocx(everyType('classic', alignment)));
      for (const [type, { word, date }] of Object.entries(TYPES)) {
        for (const p of doc[type]) assert.equal(jc(p.xml), null, `${alignment} ${type}: ${JSON.stringify(p.text)}`);
        // An award's date is the last of its stacked lines, as the PDF prints it (R4-DOUT-05).
        const dateAt = type === 'awards' ? `\n${date}` : `\t${date}`;
        if (date) assert.ok(doc[type].find((p) => p.text.includes(word)).text.includes(dateAt), `${alignment} ${type}`);
      }
    }
  });
});
