// R4-LO-01: the round trip of Experience's "Group roles by company" through the app's own PDF and Word
// exports. Both print the employer once, with no date, over its roles; the import put that line into
// the job above and gave each role no company. Each role now comes back as a job at its employer, with
// its dates and a place, and the job after the group as it was.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, loadModule } from './harness.mjs';
import { pdfLines, docxLines } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

let ctx;
const read = {};
const JOBS = [
  { company: 'Initech', role: 'Principal Engineer', location: 'Austin, TX', startDate: 'Jan 2023', endDate: '', current: true, description: '<ul><li>Leads the platform group.</li></ul>' },
  { company: 'Acme', role: 'Engineering Manager', location: 'Portland, OR', startDate: 'Mar 2021', endDate: 'Dec 2022', description: '<ul><li>Grew the team to twelve.</li></ul>' },
  { company: 'Acme', role: 'Senior Engineer', location: 'Portland, OR', startDate: 'Jun 2018', endDate: 'Feb 2021', description: '<ul><li>Built the billing service.</li></ul>' },
  { company: 'Globex', role: 'Engineer', location: 'Remote', startDate: 'Jun 2015', endDate: 'May 2018', description: '<ul><li>Kept the lights on.</li></ul>' },
];

before(async () => {
  ctx = await setup();
  const fixture = resume({ personal: { name: 'Jordan Ellery', title: 'Engineering Manager', email: 'jordan.ellery@example.com' },
    sections: [experience(JOBS, { groupRoles: true })] });
  const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
  const lines = {
    PDF: await pdfLines(await render(fixture), ctx.pdfjs),
    Word: await docxLines(new Uint8Array(await (await renderResumeDocx(fixture)).arrayBuffer())),
  };
  for (const [kind, l] of Object.entries(lines)) read[kind] = { resume: resumeFromText(l), seen: l.map((x) => x.text).join('\n') };
}, { timeout: 120_000 });
after(teardown);

describe('grouped roles come back as jobs at their employer', () => {
  for (const kind of ['PDF', 'Word']) {
    it(kind, () => {
      const { resume: r, seen } = read[kind];
      const jobs = r.sections.find((s) => s.type === 'experience')?.items || [];
      const why = `\n--- ${kind} read as ---\n${seen}\n--- imported ---\n${JSON.stringify(jobs, null, 1)}`;
      assert.deepEqual(jobs.map((j) => [j.company, j.role, j.startDate, j.endDate, j.current, j.location]), [
        ['Initech', 'Principal Engineer', 'Jan 2023', '', true, 'Austin, TX'],
        ['Acme', 'Engineering Manager', 'Mar 2021', 'Dec 2022', false, 'Portland, OR'],
        ['Acme', 'Senior Engineer', 'Jun 2018', 'Feb 2021', false, 'Portland, OR'],
        ['Globex', 'Engineer', 'Jun 2015', 'May 2018', false, 'Remote'],
      ], why);
      assert.doesNotMatch(jobs[0].description, /Acme/, why);
      assert.match(jobs[1].description, /Grew the team/, why);
      assert.match(jobs[2].description, /Built the billing service/, why);
    });
  }
});
