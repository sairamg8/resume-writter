// R4-CL-06: with Section Options → "Group roles by company" on, the PDF prints a group's company, and a
// location its roles share, once, on the employer header above the first role. "What a parser reads"
// looked for roles 2 and 3 only in their own header window, past that line, so it marked their company
// and location red "missing" although both print. A grouped role now takes its group's outcome for
// them (printedJobs tags it with `groupLead`); a location of its own, printed under it, is still read
// there. Rendered through the app's own PDF code on every template (tests/pdf/harness.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setup, teardown, resume, experience, render, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const desc = '<p>Rebuilt the checkout flow for the web store.</p><p>Cut its p95 latency in half.</p>';
const ACME = [
  { company: 'Acme', role: 'Staff Engineer', location: 'Austin, TX', startDate: '01/2021', current: true, description: desc },
  { company: 'Acme', role: 'Senior Engineer', location: 'Austin, TX', startDate: '01/2019', endDate: '12/2020', description: desc },
  { company: 'Acme', role: 'Software Engineer', location: 'Austin, TX', startDate: '01/2017', endDate: '12/2018', description: desc },
];

async function checked(r) {
  const { readPdfLines, jobFields } = await loadModule('/src/utils/parserText.js');
  const { printedJobs } = await loadModule('/src/utils/atsChecker.js');
  const pages = await readPdfLines(await render(r), { lib: pdfjs });
  const jobs = printedJobs(r);
  return { jobs, fields: jobFields(pages, jobs) };
}

describe('"What a parser reads" with roles grouped by company (R4-CL-06)', () => {
  it('printedJobs tags each later role of a group with its first role, and only when grouping is on', async () => {
    const { printedJobs } = await loadModule('/src/utils/atsChecker.js');
    const on = printedJobs(resume({ sections: [experience(ACME, { groupRoles: true })] }));
    assert.deepEqual(on.map((j) => j.groupLead), [undefined, 0, 0]);
    const off = printedJobs(resume({ sections: [experience(ACME)] }));
    assert.deepEqual(off.map((j) => j.groupLead), [undefined, undefined, undefined]);
  });

  for (const template of TEMPLATES) {
    it(`${template}: a grouped role's company and shared location read as its group's first role's`, async (t) => {
      const { jobs, fields } = await checked(resume({ template, sections: [experience(ACME, { groupRoles: true })] }));
      for (const [i, f] of fields.entries()) t.diagnostic(`${jobs[i].role}: ${JSON.stringify(f)}`);
      assert.equal(fields.length, 3);
      assert.deepEqual(fields.filter((f) => f.title === 'missing'), [], 'every role\'s title is found');
      // Classic prints every field on a line of its own: none is missing, grouped or not.
      if (template === 'classic') assert.deepEqual(fields.filter((f) => f.company === 'missing' || f.location === 'missing'), []);
      assert.deepEqual(fields.slice(1).map((f) => [f.company, f.location]), [1, 2].map(() => [fields[0].company, fields[0].location]));
    });
  }

  it('a later role\'s own location, printed under it, is read in its own header', async () => {
    const { jobFields } = await loadModule('/src/utils/parserText.js');
    const pages = [[
      ['Acme', 'Austin, TX'],
      ['Staff Engineer', '2021 – Present'], ['• Led the team.'],
      ['Senior Engineer', '2019 – 2020'], ['Denver, CO'], ['• Built billing.'],
    ]];
    const got = jobFields(pages, [
      { role: 'Staff Engineer', company: 'Acme', location: 'Austin, TX', startDate: '2021', current: true },
      { role: 'Senior Engineer', company: 'Acme', location: 'Denver, CO', startDate: '2019', endDate: '2020', groupLead: 0 },
    ]);
    assert.deepEqual(got.map((f) => [f.title, f.company, f.location]), [['own', 'own', 'own'], ['own', 'own', 'own']]);
    // Without grouping the same second role finds no company in its own header.
    const alone = jobFields(pages, [{ role: 'Staff Engineer', company: 'Acme', location: 'Austin, TX', startDate: '2021', current: true },
      { role: 'Senior Engineer', company: 'Acme', location: 'Denver, CO', startDate: '2019', endDate: '2020' }]);
    assert.equal(alone[1].company, 'missing');
  });
});
