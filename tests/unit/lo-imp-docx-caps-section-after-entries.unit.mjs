// R4-LO-04: a Word résumé whose jobs are Heading 2 entries under a Heading 1 "Experience", with a later
// section typed in bold capitals ("AWARDS", "EDUCATION") and not styled as a heading: that section
// stayed inside the last job, as its description (R4-IMP-08's guard kept every capitals line inside an
// entry for the entry). Now a title stays in its entry when another entry follows it before the next
// heading, or, in the last entry, when it names a part of one ("KEY ACHIEVEMENTS", "OVERVIEW"); any other
// known title after the last entry starts its section.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

// A fictional person, as the Word reader gives the lines (docxXmlLines: Heading 1 'heading', Heading 2 'entry').
const lines = [
  { text: 'Robin Vale', hint: 'name' },
  { text: 'robin.vale@example.com | Austin, TX' },
  { text: 'Experience', hint: 'heading' },
  { text: 'Senior Product Designer | Juniper Labs', hint: 'entry' },
  { text: 'Jan 2020 – Present' },
  { text: '• Led the design system used by forty product teams.' },
  { text: 'KEY ACHIEVEMENTS' },
  { text: '• Cut design debt by half.' },
  { text: 'Product Designer | Acme', hint: 'entry' },
  { text: '2016 – 2019' },
  { text: '• Shipped the checkout redesign.' },
  { text: '' },
  { text: 'AWARDS' },
  { text: '• Design Award – 2021' },
  { text: 'EDUCATION' },
  { text: 'Lakeside University\t2012 – 2016' },
  { text: 'B.F.A., Graphic Design' },
];

test('a capitals section after the last Heading 2 job is a section of its own', () => {
  const r = resumeFromText(lines);
  assert.deepEqual(r.sections.map((s) => s.type), ['experience', 'awards', 'education']);
  const jobs = r.sections[0].items;
  assert.equal(jobs.length, 2);
  assert.doesNotMatch(jobs[1].description, /AWARDS|Design Award|Lakeside/);
  assert.equal(r.sections[1].items[0].title, 'Design Award');
  assert.equal(r.sections[2].items[0].institution, 'Lakeside University');
});

test('a job\'s own "KEY ACHIEVEMENTS" stays in the job', () => {
  const [job] = resumeFromText(lines).sections[0].items;
  assert.match(job.description, /KEY ACHIEVEMENTS/);
  assert.match(job.description, /Cut design debt/);
});

// The review of R4-LO-04: "SKILLS" or "PROJECTS" after the last job — the common case — is a section;
// between two jobs it is the job's own, and a job's "OVERVIEW" or "KEY ACHIEVEMENTS" stays in it.
test('"PROJECTS" and "SKILLS" after the last job are sections', () => {
  const r = resumeFromText([
    ...lines.slice(0, 11),
    { text: 'PROJECTS' },
    { text: '• Checkout redesign' },
    { text: 'SKILLS' },
    { text: 'Design: Figma, Sketch' },
  ]);
  assert.deepEqual(r.sections.map((s) => s.type), ['experience', 'projects', 'skills']);
  assert.doesNotMatch(r.sections[0].items[1].description, /PROJECTS|SKILLS|Figma/);
  assert.equal(r.sections[2].items[0].category, 'Design');
});

test('"SKILLS" inside a job with another job after it, and "OVERVIEW" in the last job, stay in their job', () => {
  const r = resumeFromText([
    ...lines.slice(0, 6),
    { text: 'SKILLS' },
    { text: '• Figma' },
    ...lines.slice(8, 11),
    { text: 'OVERVIEW' },
    { text: 'A team of four designers.' },
    { text: 'KEY ACHIEVEMENTS' },
    { text: '• Won the redesign pitch.' },
  ]);
  assert.deepEqual(r.sections.map((s) => s.type), ['experience']);
  const [first, last] = r.sections[0].items;
  assert.match(first.description, /SKILLS.*Figma/s);
  assert.match(last.description, /OVERVIEW.*A team of four designers.*KEY ACHIEVEMENTS.*Won the redesign pitch/s);
  assert.equal(r.personal.summary, '');
});
