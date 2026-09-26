// R4-IMP-03: the Word reader marked every Heading level alike, so a résumé in the layout of Word's own
// résumé templates — Heading 1 "Experience", Heading 2 "Senior Engineer | Acme Corp", Heading 3 its
// dates — made each heading a section: "Experience" had nothing under it and was dropped, the job's
// title line too (the job title and the company lost), and the dates became a custom section holding
// the bullets. The top level used now starts the sections, deeper levels an entry, as Markdown's ###
// does; and a heading's words are never thrown away.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { docxLines } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

const h = (level, text) => new Paragraph({ heading: level, children: [new TextRun(text)] });
const bullet = (text) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun(text)] });
const read = async (children) => resumeFromText(await docxLines(new Uint8Array(await Packer.toBuffer(new Document({ sections: [{ children }] })))));

// A fictional person.
const BODY = [
  new Paragraph('robin.vale@example.com | +1 555 0199 | Austin, TX'),
  h(HeadingLevel.HEADING_1, 'Experience'),
  h(HeadingLevel.HEADING_2, 'Senior Engineer | Acme Corp'),
  h(HeadingLevel.HEADING_3, 'Mar 2021 – Present'),
  bullet('Led the move to a typed API.'),
  h(HeadingLevel.HEADING_2, 'Engineer | Initech'),
  h(HeadingLevel.HEADING_3, 'Jun 2017 – Feb 2021'),
  bullet('Built the billing service.'),
  h(HeadingLevel.HEADING_1, 'Education'),
  h(HeadingLevel.HEADING_2, 'Lakeside University'),
  new Paragraph('B.S., Computer Science'),
];

function assertJobs(r) {
  const why = JSON.stringify(r.sections.map((s) => [s.type, s.title, s.items]), null, 1);
  assert.deepEqual(r.sections.map((s) => s.type), ['experience', 'education'], why);
  const jobs = r.sections[0].items;
  assert.deepEqual(jobs.map((j) => [j.role, j.company, j.startDate, j.endDate, j.current]), [
    ['Senior Engineer', 'Acme Corp', 'Mar 2021', '', true],
    ['Engineer', 'Initech', 'Jun 2017', 'Feb 2021', false],
  ], why);
  assert.match(jobs[0].description, /Led the move to a typed API/, why);
  assert.match(jobs[1].description, /Built the billing service/, why);
  assert.equal(r.sections[1].items[0].institution, 'Lakeside University', why);
}

test('Heading 1 sections, Heading 2 jobs and Heading 3 dates: each job whole, under Experience', async () => {
  const r = await read([new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Robin Vale')] }), ...BODY]);
  assert.equal(r.personal.name, 'Robin Vale');
  assertJobs(r);
});

test('the name in Heading 1 over Heading 2 sections and Heading 3 jobs: the name, then the same', async () => {
  const r = await read([
    h(HeadingLevel.HEADING_1, 'Robin Vale'),
    new Paragraph('robin.vale@example.com | +1 555 0199 | Austin, TX'),
    h(HeadingLevel.HEADING_2, 'Experience'),
    h(HeadingLevel.HEADING_3, 'Senior Engineer | Acme Corp'),
    h(HeadingLevel.HEADING_4, 'Mar 2021 – Present'),
    bullet('Led the move to a typed API.'),
    h(HeadingLevel.HEADING_3, 'Engineer | Initech'),
    h(HeadingLevel.HEADING_4, 'Jun 2017 – Feb 2021'),
    bullet('Built the billing service.'),
    h(HeadingLevel.HEADING_2, 'Education'),
    h(HeadingLevel.HEADING_3, 'Lakeside University'),
    new Paragraph('B.S., Computer Science'),
  ]);
  assert.equal(r.personal.name, 'Robin Vale');
  assert.equal(r.personal.email, 'robin.vale@example.com');
  assertJobs(r);
});

test('an unknown heading with nothing under it keeps its words', () => {
  const r = resumeFromText([{ text: 'Robin Vale', hint: 'name' }, { text: 'Open to relocation', hint: 'heading' }, { text: 'Skills', hint: 'heading' }, { text: 'Figma, Sketch' }]);
  assert.match(JSON.stringify(r.sections), /Open to relocation/);
});
