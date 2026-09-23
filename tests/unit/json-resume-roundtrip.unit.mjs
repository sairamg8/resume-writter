// Export → JSON Resume → import gives back what was exported. It did not (bug audit 2026-09-22):
// every date came back cut to 7 characters ("Jan 2024" → "Jan 202"), every bullet came back twice,
// a project's link was lost both ways, and imported text was read as HTML ("<ingest>" vanished,
// "<b>" turned bold).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';
import { parseRichText } from '../../src/utils/richText.js';
import { formatDate } from '../../src/utils/dates.js';
import { TEMPLATE_IDS } from '../../src/constants/templates.js';
import { getStarterSettings } from '../../src/utils/starterTemplates.js';

/** The text each block of rich text prints, list items marked with their bullet. */
const printed = (html) => parseRichText(html).map((b) => `${b.marker ? `${b.marker} ` : ''}${b.runs.map((r) => r.text).join('')}`);
/** Is any run of the rich text bold? */
const anyBold = (html) => parseRichText(html).some((b) => b.runs.some((r) => r.bold));

const MMM = { dateFormat: 'MMM YYYY' };

function resumeWith(sections, personal = {}, template = 'classic') {
  return { personal: { name: 'Ada Lovelace', ...personal }, template, settings: {}, sections };
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

test("a project's link is its url, both ways (the editor, PDF, Word and Markdown all read url)", () => {
  const out = cpwtResumeToJsonResume(resumeWith([{ type: 'projects', items: [
    { name: 'Typed', url: 'github.com/ada/engine' },
    { name: 'Imported by an older build', link: 'https://old.example.com' },
  ] }]));
  assert.deepEqual(out.projects.map((p) => p.url), ['github.com/ada/engine', 'https://old.example.com']);
  const r = jsonResumeToCpwtResume({ basics: { name: 'X' }, projects: [{ name: 'Engine', url: 'https://github.com/ada/engine' }] });
  const item = r.sections.find((s) => s.type === 'projects').items[0];
  assert.equal(item.url, 'https://github.com/ada/engine');
  assert.equal(item.link, undefined);
});

test('import: text prints as typed — "<", ">" and "&" are text, never markup', () => {
  const file = {
    basics: { name: 'X', summary: 'R&D lead for <core> systems\nSecond line' },
    work: [{ name: 'A', position: 'P', summary: 'Owned the <ingest> pipeline', highlights: ['Reduced p99 <200ms & cut <b>cost</b> by 5%', '<img src=x onerror=alert(1)>'] }],
    education: [{ institution: 'MIT', courses: ['C++ & <Algorithms>'] }],
    projects: [{ name: 'P', description: 'Uses <canvas> & WebGL', highlights: ['a < b'] }],
    awards: [{ title: 'Best', summary: 'Top 1% <of> 500' }],
  };
  const r = jsonResumeToCpwtResume(file);
  const exp = r.sections.find((s) => s.type === 'experience').items[0].description;
  assert.deepEqual(printed(exp), ['Owned the <ingest> pipeline', '• Reduced p99 <200ms & cut <b>cost</b> by 5%', '• <img src=x onerror=alert(1)>']);
  assert.equal(anyBold(exp), false);
  assert.deepEqual(printed(r.personal.summary), ['R&D lead for <core> systems\nSecond line']);
  assert.deepEqual(printed(r.sections.find((s) => s.type === 'education').items[0].description), ['Relevant courses: C++ & <Algorithms>']);
  assert.deepEqual(printed(r.sections.find((s) => s.type === 'projects').items[0].description), ['Uses <canvas> & WebGL', '• a < b']);
  assert.deepEqual(printed(r.sections.find((s) => s.type === 'awards').items[0].description), ['Top 1% <of> 500']);
});

// The template a résumé prints with (TUI-4). JSON Resume has no field for it, so the export writes
// it into the schema's `meta` — where the standard puts "any other tooling configuration" — and the
// import reads it back. The import used to hardcode Classic, so exporting a Modern, Sidebar,
// Executive or Minimal résumé and importing the file handed back a Classic one, with its heading
// style reset to Classic's, and said nothing. Every id, not a hand-written list: a template added to
// TEMPLATE_IDS without a home in `meta` fails here.

test('round trip: every template comes back as itself — the file names it in the schema\'s meta (TUI-4)', () => {
  for (const id of TEMPLATE_IDS) {
    const resume = resumeWith([{ type: 'experience', items: [{ company: 'Acme', role: 'Eng', startDate: 'Jan 2020' }] }], {}, id);
    const file = JSON.parse(JSON.stringify(cpwtResumeToJsonResume(resume)));
    assert.equal(file.meta?.template, id, `${id}: the export names it`);
    assert.equal(jsonResumeToCpwtResume(file).template, id, `${id}: the import reads it back`);
  }
});

/** The résumé a JSON Resume file carrying this `meta` is imported as (null: a file with no `meta` at all). */
const importedWith = (meta) => jsonResumeToCpwtResume({ basics: { name: 'X' }, ...(meta ? { meta } : {}) });

test('import: a file naming no template, or one the app does not offer, is Classic exactly as before (TUI-4)', () => {
  assert.equal(importedWith(null).template, 'classic', 'no meta: every file another tool wrote');
  assert.equal(importedWith({}).template, 'classic', 'meta, but nothing about a template');
  assert.equal(importedWith({ template: '' }).template, 'classic');
  assert.equal(importedWith({ template: 'dark' }).template, 'classic', 'a template the app does not offer');
  assert.equal(importedWith({ template: 42 }).template, 'classic', 'not text');
  // Cased and spaced as another tool wrote it: templateId() reads it, here as everywhere (R5-5).
  assert.equal(importedWith({ template: ' Modern ' }).template, 'modern');
  assert.equal(importedWith({ template: 'SIDEBAR' }).template, 'sidebar');
});

test('import: the design settings are the starter settings of the template the file resolved to (TUI-4)', () => {
  assert.deepEqual(importedWith(null).settings, getStarterSettings('classic'), 'unchanged: Classic\'s, as every import got');
  assert.deepEqual(importedWith({ template: 'dark' }).settings, getStarterSettings('classic'));
  // Modern's heading style is 'line', not Classic's 'ruled': a Modern import no longer opens with
  // Classic's headings under Modern's banner.
  assert.deepEqual(importedWith({ template: ' Modern ' }).settings, getStarterSettings('modern'));
});
