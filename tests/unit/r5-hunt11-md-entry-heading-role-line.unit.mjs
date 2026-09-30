// R5-HUNT11-MD-ENTRY-HEADING-ROLE-LINE-SPLITS-ENTRY: a Markdown résumé (or a Word file with its
// employers in a Heading style) with the company as the "###" heading, the role on the line under it and
// the dates under that had every job and school split in two: a company-only entry, and an untitled one
// with the role, the dates and the text. The role (or the degree) line is the heading's entry's now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText, markdownLines } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];
const md = (s) => resumeFromText(markdownLines(s));

test('"### Company" over the role over the dates is one job; "### School" over the degree over the years one school', () => {
  const r = md('# Alex Kim\n\n## Experience\n\n### Amazon\n**Senior Engineer**  \n*Jan 2020 – Present*\n- Built things\n\n### Microsoft\n**Software Engineer**  \n*Jun 2016 – Dec 2019*\n- Shipped tiering\n\n## Education\n\n### University of Washington\nB.S. Computer Science\n2012 – 2016\n');
  const jobs = items(r, 'experience');
  assert.deepEqual(jobs.map((j) => [j.company, j.role, j.startDate, j.endDate, j.current]), [['Amazon', 'Senior Engineer', 'Jan 2020', '', true], ['Microsoft', 'Software Engineer', 'Jun 2016', 'Dec 2019', false]]);
  assert.match(jobs[0].description, /Built things/);
  assert.match(jobs[1].description, /Shipped tiering/);
  assert.deepEqual(items(r, 'education').map((e) => [e.institution, e.degree, e.startDate, e.endDate]), [['University of Washington', 'B.S. Computer Science', '2012', '2016']]);
});

test('with blank lines between the heading, the role and the dates it is still one job', () => {
  const r = md('# Alex Kim\n\n## Experience\n\n### Amazon\n\n**Senior Engineer**\n\n*Jan 2020 – Present*\n\n- Built things\n');
  assert.deepEqual(items(r, 'experience').map((j) => [j.company, j.role, j.startDate, j.current]), [['Amazon', 'Senior Engineer', 'Jan 2020', true]]);
});

test('a Word file with the employer in a deeper Heading style and the role and dates in Normal text: one job', () => {
  const r = resumeFromText([
    { text: 'Alex Kim', hint: 'name' }, { text: 'Experience', hint: 'heading' },
    { text: 'Amazon', hint: 'entry' }, { text: 'Senior Engineer' }, { text: 'Jan 2020 – Present' }, { text: '• Built things' },
    { text: 'Microsoft', hint: 'entry' }, { text: 'Software Engineer' }, { text: 'Jun 2016 – Dec 2019' },
  ]);
  assert.deepEqual(items(r, 'experience').map((j) => [j.company, j.role, j.startDate]), [['Amazon', 'Senior Engineer', 'Jan 2020'], ['Microsoft', 'Software Engineer', 'Jun 2016']]);
});

test('a paragraph under an undated heading stays its text', () => {
  const r = md('# Alex Kim\n\n## Projects\n\n### Ledger\nA double-entry ledger in Rust.\n\n### Chat\nRealtime chat for teams.\n');
  const ps = items(r, 'projects');
  assert.deepEqual(ps.map((p) => p.name), ['Ledger', 'Chat']);
  assert.match(ps[0].description, /double-entry ledger/);
});
