// R5-HUNT13-HEADER-TOWN-SHAPE: the round trip of a header location that is a town of several words with
// no state after it. A fictional résumé whose location is "Walnut Creek" (a town the importer's list of
// known places does not hold) is exported by the app's own PDF and Word code — the Classic and Compact
// contact lines, the Sidebar's "LOCATION" label over its value — and read back: the town comes back as
// the location, with the other contacts and the job title. Before, it printed as an "Additional
// Information" section and the location came back empty.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, loadModule } from './harness.mjs';
import { pdfLines, docxLines } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

let ctx;
const read = {};

const personal = {
  name: 'Avery Quinn', title: 'Senior Data Engineer', email: 'avery.quinn@example.com', phone: '+1 555 0142',
  location: 'Walnut Creek', website: 'averyquinn.example.com',
  summary: '<p>Data engineer with nine years of building reliable pipelines and warehouses for analytics teams.</p>',
};
const sections = () => [
  experience([{ company: 'Northwind Analytics', role: 'Senior Data Engineer', location: 'Portland, OR', startDate: 'Mar 2021', endDate: '', current: true,
    description: '<ul><li>Built the streaming pipeline that feeds every product dashboard.</li></ul>' }]),
  section('skills', [{ category: 'Programming', skills: 'Python, SQL, Scala' }]),
];

before(async () => {
  ctx = await setup();
  const fixture = (template) => resume({ template, personal, sections: sections() });
  for (const template of ['classic', 'sidebar', 'compact']) {
    const lines = await pdfLines(await render(fixture(template)), ctx.pdfjs);
    read[`${template} PDF`] = { resume: resumeFromText(lines), seen: lines.map((x) => x.text).join('\n') };
  }
  const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
  const lines = await docxLines(new Uint8Array(await (await renderResumeDocx(fixture('classic'))).arrayBuffer()));
  read['Word'] = { resume: resumeFromText(lines), seen: lines.map((x) => x.text).join('\n') };
}, { timeout: 120_000 });
after(teardown);

describe('a header town of several words comes back as the location from the app’s own exports', () => {
  for (const kind of ['classic PDF', 'sidebar PDF', 'compact PDF', 'Word']) {
    it(kind, () => {
      const { resume: r, seen } = read[kind];
      const p = r.personal;
      const why = `\n--- ${kind} read as ---\n${seen}\n--- imported ---\n${JSON.stringify({ personal: p, sections: r.sections.map((s) => [s.type, s.title]) }, null, 1)}`;
      assert.equal(p.location, 'Walnut Creek', why);
      assert.equal(p.email, 'avery.quinn@example.com', why);
      assert.equal(p.phone, '+1 555 0142', why);
      assert.equal(p.title, 'Senior Data Engineer', why);
      assert.equal(r.sections.some((s) => s.title === 'Additional Information'), false, why);
    });
  }
});
