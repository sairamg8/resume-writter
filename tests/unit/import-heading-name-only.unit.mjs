// R4-IMP-08: a Word résumé with only its name styled Heading 1 and its section titles in bold Normal
// capitals was read as if its headings were all marked: the name's hint made the file "hinted", so no
// unmarked line could be a heading. No section was found, and the whole résumé piled into the header
// (the summary, "Additional Information"). Only a heading after the name counts now, and in a file
// that marks some headings a known title in capitals is one too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

// A fictional person, as the Word reader gives the lines: the name marked a heading (Heading 1).
const lines = [
  { text: 'Robin Vale', hint: 'heading' },
  { text: 'robin.vale@example.com | +1 555 0199 | Austin, TX' },
  { text: '' },
  { text: 'EXPERIENCE' },
  { text: 'Juniper Labs — Senior Product Designer\tJan 2020 – Present' },
  { text: '• Led the design system used by forty product teams across the company.' },
  { text: '' },
  { text: 'EDUCATION' },
  { text: 'Lakeside University\t2012 – 2016' },
  { text: 'B.F.A., Graphic Design' },
];

test('the name alone styled as a heading: the capitals titles still start their sections', () => {
  const r = resumeFromText(lines);
  assert.equal(r.personal.name, 'Robin Vale');
  assert.equal(r.personal.email, 'robin.vale@example.com');
  assert.deepEqual(r.sections.map((s) => s.type), ['experience', 'education']);
  const [job] = r.sections[0].items;
  assert.deepEqual([job.company, job.role, job.startDate, job.current], ['Juniper Labs', 'Senior Product Designer', 'Jan 2020', true]);
  assert.match(job.description, /Led the design system/);
  assert.equal(r.sections[1].items[0].institution, 'Lakeside University');
  assert.equal(r.personal.summary, '', 'no job bullet in the summary');
});

test('some sections styled Heading 1, another typed in capitals: each is a section', () => {
  const mixed = [
    { text: 'Robin Vale', hint: 'name' },
    { text: 'Experience', hint: 'heading' },
    { text: 'Juniper Labs — Senior Product Designer\tJan 2020 – Present' },
    { text: 'SKILLS' },
    { text: 'Design: Figma, prototyping' },
  ];
  assert.deepEqual(resumeFromText(mixed).sections.map((s) => s.type), ['experience', 'skills']);
});

// The review of R4-IMP-08: a line in capitals inside an entry, or of a type the file marks itself, is
// not a section of its own in a file that marks its headings.
test('Markdown: a job\'s **KEY ACHIEVEMENTS** stays in the job; a marked file\'s own types are its word', async () => {
  const { markdownLines } = await import('../../src/utils/importText.js');
  const md = '# Robin Vale\n\n## Experience\n### Juniper Labs — Senior Product Designer\n*Jan 2020 – Present*\n\n**KEY ACHIEVEMENTS**\n- Shipped the design system.\n\n### Acme — Designer\n*2017 – 2019*\n\n## Skills\nFigma\n';
  const r = resumeFromText(markdownLines(md));
  assert.deepEqual(r.sections.map((s) => s.type), ['experience', 'skills']);
  const jobs = r.sections[0].items;
  assert.equal(jobs.length, 2);
  assert.match(jobs[0].description, /KEY ACHIEVEMENTS/);
});
