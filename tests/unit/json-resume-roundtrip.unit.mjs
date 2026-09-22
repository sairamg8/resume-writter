// Export → JSON Resume → import gives back what was exported. It did not (bug audit 2026-09-22):
// every date came back cut to 7 characters ("Jan 2024" → "Jan 202"), every bullet came back twice,
// a project's link was lost both ways, and imported text was read as HTML ("<ingest>" vanished,
// "<b>" turned bold).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';
import { parseRichText } from '../../src/utils/richText.js';
import { formatDate } from '../../src/utils/dates.js';

/** The text each block of rich text prints, list items marked with their bullet. */
const printed = (html) => parseRichText(html).map((b) => `${b.marker ? `${b.marker} ` : ''}${b.runs.map((r) => r.text).join('')}`);

const MMM = { dateFormat: 'MMM YYYY' };

function resumeWith(sections, personal = {}) {
  return { personal: { name: 'Ada Lovelace', ...personal }, template: 'classic', settings: {}, sections };
}

test('export: dates are ISO 8601 (YYYY-MM, or YYYY for a year alone) — what JSON Resume requires', () => {
  const resume = resumeWith([
    { type: 'experience', items: [
      { company: 'A', role: 'R', startDate: 'Jan 2024', endDate: 'March 2025' },
      { company: 'B', role: 'R', startDate: '05/2023', endDate: '', current: true },
      { company: 'C', role: 'R', startDate: '2019', endDate: '2019-05' },
      { company: 'D', role: 'R', startDate: 'Summer 2020', endDate: 'Sept. 2021' },
    ] },
    { type: 'education', items: [{ institution: 'MIT', startDate: 'Sep 2016', endDate: 'May 2020' }] },
    { type: 'projects', items: [{ name: 'P', startDate: 'Feb 2022', endDate: 'Dec 2022' }] },
    { type: 'certifications', items: [{ name: 'AWS', date: 'September 2023' }] },
    { type: 'awards', items: [{ title: 'Best', date: 'Nov 2021' }] },
  ]);
  const out = cpwtResumeToJsonResume(resume);
  assert.deepEqual(out.work.map((w) => [w.startDate, w.endDate]), [
    ['2024-01', '2025-03'], ['2023-05', ''], ['2019', '2019-05'],
    ['Summer 2020', '2021-09'], // not a month and year: kept as typed, never dropped
  ]);
  assert.deepEqual([out.education[0].startDate, out.education[0].endDate], ['2016-09', '2020-05']);
  assert.deepEqual([out.projects[0].startDate, out.projects[0].endDate], ['2022-02', '2022-12']);
  assert.equal(out.certificates[0].date, '2023-09');
  assert.equal(out.awards[0].date, '2021-11');
});

test('import: a date is never cut — ISO days and times read as their month, any other text is kept whole', () => {
  const file = {
    basics: { name: 'X' },
    work: [
      { name: 'A', startDate: '2021-03-01', endDate: '2024-01' },
      { name: 'B', startDate: '2019', endDate: '2021-03-01T00:00:00Z' },
      // What earlier builds exported: the month picker's own text.
      { name: 'C', startDate: 'Jan 2024', endDate: 'September 2025' },
    ],
    certificates: [{ name: 'Cert', date: 'March 2023' }],
  };
  const r = jsonResumeToCpwtResume(file);
  assert.deepEqual(r.sections[0].items.map((i) => [i.startDate, i.endDate]), [
    ['2021-03', '2024-01'], ['2019', '2021-03'], ['Jan 2024', 'September 2025'],
  ]);
  assert.equal(r.sections.find((s) => s.type === 'certifications').items[0].date, 'March 2023');
});

test('round trip: every date prints the same after export → import', () => {
  const dates = ['Jan 2024', 'March 2025', '05/2023', '2019', '2019-05', 'Sept 2021', 'Summer 2020'];
  const resume = resumeWith([{ type: 'experience', items: dates.map((d, i) => ({ company: `C${i}`, role: 'R', startDate: d, endDate: d })) }]);
  const back = jsonResumeToCpwtResume(JSON.parse(JSON.stringify(cpwtResumeToJsonResume(resume))));
  const items = back.sections.find((s) => s.type === 'experience').items;
  assert.deepEqual(items.map((i) => formatDate(i.startDate, MMM)), dates.map((d) => formatDate(d, MMM)));
  assert.deepEqual(items.map((i) => formatDate(i.endDate, MMM)), dates.map((d) => formatDate(d, MMM)));
});

test('export: bullets go out once, as highlights; summary holds only the text outside the list — plain text, whole', () => {
  const long = `Owned the payments platform end to end. ${'Scaled it across regions. '.repeat(15)}`.trim();
  const resume = resumeWith([
    { type: 'experience', items: [
      { company: 'Acme', role: 'Eng', description: `<p>${long}</p><ul><li>Cut cost by 30% &amp; latency</li><li>Led a <strong>team</strong> of 5</li></ul>` },
      { company: 'Bolt', role: 'Eng', description: '<ul><li>Only bullets</li></ul>' },
      { company: 'Core', role: 'Eng', description: '<p>First paragraph</p><p>Second &lt;paragraph&gt;</p>' },
    ] },
    { type: 'projects', items: [{ name: 'P', description: '<p>A tool</p><ul><li>Fast &amp; small</li></ul>' }] },
    { type: 'awards', items: [{ title: 'Best', description: '<p>Won <em>gold</em> &amp; silver</p>' }] },
  ], { summary: '<p>Builds <strong>R&amp;D</strong> tools</p><p>Second line</p>' });
  const out = cpwtResumeToJsonResume(resume);
  assert.equal(out.work[0].summary, long, 'the summary is not cut at 300 characters');
  assert.deepEqual(out.work[0].highlights, ['Cut cost by 30% & latency', 'Led a team of 5']);
  assert.deepEqual([out.work[1].summary, out.work[1].highlights], ['', ['Only bullets']]);
  assert.deepEqual([out.work[2].summary, out.work[2].highlights], ['First paragraph\nSecond <paragraph>', []]);
  assert.deepEqual([out.projects[0].description, out.projects[0].highlights], ['A tool', ['Fast & small']]);
  assert.equal(out.awards[0].summary, 'Won gold & silver');
  assert.equal(out.basics.summary, 'Builds R&D tools\nSecond line');
});

test('export: a paragraph typed as a bullet ("• …", "- …") is a highlight too', () => {
  const resume = resumeWith([{ type: 'experience', items: [{ company: 'A', role: 'R', description: '<p>• Did X</p><p>- Did Y</p>' }] }]);
  const out = cpwtResumeToJsonResume(resume);
  assert.deepEqual([out.work[0].summary, out.work[0].highlights], ['', ['Did X', 'Did Y']]);
});

test('round trip: each bullet and paragraph comes back once', () => {
  const resume = resumeWith([
    { type: 'experience', items: [{ company: 'Acme', role: 'Eng', startDate: 'Jan 2020', description: '<p>Led payments.</p><ul><li>Cut cost by 30% &amp; latency</li><li>Led team</li></ul>' }] },
    { type: 'projects', items: [{ name: 'P', description: '<p>A tool</p><ul><li>Fast</li></ul>' }] },
  ]);
  const back = jsonResumeToCpwtResume(JSON.parse(JSON.stringify(cpwtResumeToJsonResume(resume))));
  assert.deepEqual(printed(back.sections.find((s) => s.type === 'experience').items[0].description), ['Led payments.', '• Cut cost by 30% & latency', '• Led team']);
  assert.deepEqual(printed(back.sections.find((s) => s.type === 'projects').items[0].description), ['A tool', '• Fast']);
});
