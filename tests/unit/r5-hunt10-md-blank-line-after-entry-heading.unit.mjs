// R5-HUNT10-MD-BLANK-LINE-AFTER-ENTRY-HEADING-SPLITS-ENTRY: a Markdown résumé with a blank line after
// each "### " entry heading (markdownlint's MD022, most hand- and machine-written Markdown) had every
// entry split in two: the titled one undated, and an untitled one with the dates and the text. The date
// line past the blank line is the heading's entry's now; a paragraph of its text still is its text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText, markdownLines } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];
const md = (s) => resumeFromText(markdownLines(s));

test('a blank line between a "###" entry heading and its date line keeps one entry', () => {
  const r = md('# Jane Doe\n\njane@x.com\n\n## Experience\n\n### Senior Engineer — Acme Corp\n\nJan 2020 – Present\n\n- Built X\n\n### Engineer — Globex\n\n2017 – 2019\n\n- Did Y\n\n## Education\n\n### B.S. Computer Science — UC Berkeley\n\n*2012 – 2016*\n');
  const jobs = items(r, 'experience');
  assert.deepEqual(jobs.map((j) => [j.company, j.role, j.startDate, j.endDate, j.current]), [['Acme Corp', 'Senior Engineer', 'Jan 2020', '', true], ['Globex', 'Engineer', '2017', '2019', false]]);
  assert.match(jobs[0].description, /Built X/);
  assert.match(jobs[1].description, /Did Y/);
  assert.deepEqual(items(r, 'education').map((e) => [e.institution, e.degree, e.startDate, e.endDate]), [['UC Berkeley', 'B.S. Computer Science', '2012', '2016']]);
});

test('a place and dates line past the blank line is the entry’s too; a paragraph is still its text', () => {
  const r = md('# Jane Doe\n\njane@x.com\n\n## Experience\n\n### Senior Engineer — Acme Corp\n\nAustin, TX | Jan 2020 – Present\n\nLed the payments team and shipped the new ledger.\n');
  const jobs = items(r, 'experience');
  assert.equal(jobs.length, 1);
  assert.deepEqual([jobs[0].company, jobs[0].role, jobs[0].startDate, jobs[0].current], ['Acme Corp', 'Senior Engineer', 'Jan 2020', true]);
  assert.match(jobs[0].description, /Led the payments team/);
});
