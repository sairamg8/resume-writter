// ATS-1: the work location is a field of its own, not the tail of the job title or the company.
// It used to print in the subtitle's own text run after " · " ("Senior Frontend Engineer · Austin, TX"
// in Classic, Modern and Minimal; "Northwind Traders · Austin, TX" in Executive and the Sidebar), and
// no separator glyph can split one run: pdf.js breaks an item only on a font change or a gap wider
// than 0.6 em, so every item-based parser (OpenResume) took the location as part of the title.
// Now the location sits with the date: right-aligned under it — on the sub-line (Title "Stacked") or
// a line of its own (Title "Inline" / "Side by side") — or on a centred line of its own (Alignment
// "Center"): a run of its own in every layout. The Word export puts it under the date the same way.
// Runs are read as a parser reads them (ats-entry-header.mjs): items closer than half an em merge.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, read, render, renderDocx, loadModule, resume, section, experience, allItems, TEMPLATES } from './harness.mjs';
import { lines, allRuns } from './ats-entry-header.mjs';

before(setup);
after(teardown);

const LAYOUTS = [];
for (const template of [...TEMPLATES, 'sidebar-single']) {
  for (const titleStyle of ['stacked', 'inline', 'sidebyside']) {
    for (const alignment of ['left', 'center']) LAYOUTS.push({ template, titleStyle, alignment });
  }
}

/** The demo résumé of `template` ('sidebar-single': the Sidebar's ATS-safe column) with its experience laid out so. */
async function demo({ template, titleStyle, alignment }) {
  const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
  const id = template === 'sidebar-single' ? 'sidebar' : template;
  const r = structuredClone(DEMO_RESUMES.find((x) => x.template === id));
  if (template === 'sidebar-single') r.settings = { ...r.settings, sidebarSingleColumn: true };
  const exp = r.sections.find((s) => s.type === 'experience');
  exp.settings = { ...exp.settings, titleStyle, alignment };
  return { r, jobs: exp.items };
}

/** Runs that hold `loc` together with any of `others`, and whether `loc` is a run of its own near `anchor`. */
function locationRuns(pages, anchor, loc, others) {
  const glued = allRuns(pages).filter((t) => t.includes(loc) && others.some((o) => o && t.includes(o)));
  const all = lines(pages);
  const at = all.findIndex((runs) => runs.some((r) => r.text.includes(anchor)));
  const near = all.slice(Math.max(0, at - 2), at + 4).flat().map((r) => r.text);
  return { glued, own: at >= 0 && near.includes(loc) };
}

describe('the work location reads as its own field, not glued to the title or company (ATS-1)', () => {
  for (const layout of LAYOUTS) {
    it(`${layout.template}, Title ${layout.titleStyle}, ${layout.alignment}`, async () => {
      const { r, jobs } = await demo(layout);
      const pages = await read(await render(r));
      const found = [];
      for (const job of jobs) {
        const { glued, own } = locationRuns(pages, job.company, job.location, [job.role, job.company]);
        if (glued.length) found.push(`glued: ${glued.map((t) => JSON.stringify(t)).join(', ')}`);
        if (!own) found.push(`${job.location}: not a run of its own by ${job.company}`);
      }
      assert.deepEqual(found, []);
    });
  }
});

// Education, Volunteering and Custom print their headers through the same ItemHeader.
const OTHER = [
  { type: 'education', item: { institution: 'Lakeside State University', degree: 'B.S. Computer Science', location: 'Springfield, IL', startDate: '08/2013', endDate: '05/2017' }, anchor: 'Lakeside', sub: 'B.S. Computer Science', settings: { showLocation: true } },
  { type: 'volunteering', item: { role: 'Workshop Mentor', org: 'Code Club', location: 'Oakland, CA', startDate: '01/2019', endDate: '12/2020' }, anchor: 'Workshop Mentor', sub: 'Code Club', settings: { showLocation: true } },
  { type: 'custom', item: { title: 'Conference Speaker', subtitle: 'JSConf EU', location: 'Berlin, DE', date: '06/2022' }, anchor: 'Conference Speaker', sub: 'JSConf EU', settings: {} },
];

describe('Education, Volunteering and Custom entries print the location as its own field too', () => {
  for (const titleStyle of ['stacked', 'inline']) {
    for (const alignment of ['left', 'center']) {
      it(`classic, Title ${titleStyle}, ${alignment}`, async () => {
        const r = resume({ template: 'classic', sections: OTHER.map((o) => section(o.type, [o.item], { ...o.settings, titleStyle, alignment })) });
        const pages = await read(await render(r));
        const found = [];
        for (const o of OTHER) {
          const { glued, own } = locationRuns(pages, o.anchor, o.item.location, [o.anchor, o.sub]);
          if (glued.length) found.push(`${o.type} glued: ${glued.map((t) => JSON.stringify(t)).join(', ')}`);
          if (!own) found.push(`${o.type}: ${o.item.location} not a run of its own`);
        }
        assert.deepEqual(found, []);
      });
    }
  }
});

describe('the Word export keeps the location out of the title line too', () => {
  for (const template of ['classic', 'executive']) {
    for (const alignment of ['left', 'center']) {
      it(`${template}, ${alignment}: the location is a line of its own in the entry's header paragraph`, async () => {
        const { r, jobs } = await demo({ template, titleStyle: 'stacked', alignment });
        r.sections.push(...OTHER.map((o) => section(o.type, [o.item], { ...o.settings, alignment })));
        const { texts } = await renderDocx(r);
        const found = [];
        const entries = [
          ...jobs.map((j) => ({ anchor: j.company, loc: j.location, others: [j.role, j.company] })),
          ...OTHER.map((o) => ({ anchor: o.anchor, loc: o.item.location, others: [o.anchor, o.sub] })),
        ];
        for (const e of entries) {
          const para = texts.find((t) => t.includes(e.anchor) && t.includes(e.loc));
          if (!para) { found.push(`${e.loc}: not in ${e.anchor}'s header paragraph`); continue; }
          const pieces = para.split(/[\t\n]/).map((s) => s.trim());
          if (!pieces.includes(e.loc)) found.push(`${JSON.stringify(para)}: ${e.loc} shares a line with the title`);
        }
        assert.deepEqual(found, []);
      });
    }
  }
});

// Beside the date, the location squeezed a one-line title onto more lines (the ATS fuzz lost more
// titles split across lines), so it goes under the date, right-aligned, as Title "Stacked" has it.
describe('Title Inline: the location right-aligned under the date', () => {
  for (const [template, columns] of [['classic', 1], ['classic', 2], ['sidebar', 1]]) {
    it(`${template}, ${columns} column(s)`, async () => {
      const job = { company: 'Northwind Traders', role: 'Engineer', location: 'Portland, OR', startDate: '03/2022', endDate: '05/2024' };
      const r = resume({ template, sections: [experience([job, { ...job, company: 'Contoso Bank' }], { titleStyle: 'inline', columns })] });
      const items = allItems(await read(await render(r)));
      const loc = items.find((i) => i.str === 'Portland, OR');
      const date = items.find((i) => i.str.includes('03/2022'));
      assert.ok(date.y - loc.y > 5 && Math.abs(loc.x + loc.w - (date.x + date.w)) <= 1, `location at (${loc.x.toFixed(1)}, ${loc.y.toFixed(1)}), date at (${date.x.toFixed(1)}, ${date.y.toFixed(1)})`);
    });
  }
});
