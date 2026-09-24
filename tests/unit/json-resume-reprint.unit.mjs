// Export → JSON Resume → import prints what the résumé printed (R2-006). R2-002 brought every
// section back with its title, place and fields; what still changed on the trip: a past job with no
// end date came back as a current one and printed "Present"; a list in the summary or in an award
// came back as plain lines (and bold as plain text); the website's, LinkedIn's and GitHub's display
// labels and link URLs were not in the file, so the contact line printed the bare address; and a
// skill group with no category came back titled "Skills".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';
import { generateAtsPlainText } from '../../src/utils/atsChecker.js';
import { CONTACT_FIELDS, contactItems } from '../../src/utils/contacts.js';
import { parseRichText } from '../../src/utils/richText.js';
import { SECTION_TYPE_DEFAULTS } from '../../src/utils/defaultDataSectionTypes.js';

const exportOf = (resume) => JSON.parse(JSON.stringify(cpwtResumeToJsonResume(resume)));
const roundTrip = (resume) => jsonResumeToCpwtResume(exportOf(resume));
/** Each block of rich text as it prints: its list marker, its text, bold runs marked. */
const printed = (html) => parseRichText(html).map((b) => `${b.marker ? `${b.marker} ` : ''}${b.runs.map((r) => (r.bold ? `**${r.text}**` : r.text)).join('')}`);
const section = (type, title, items) => ({ id: `sec-${title}`, type, title, visible: true, items });
// The Classic starter's Date format, the one the import gives a résumé (a JSON Resume file carries none).
const resumeWith = (sections, personal = {}) => ({ personal: { name: 'Ada Lovelace', ...personal }, template: 'classic', settings: { dateFormat: 'MMM YYYY' }, sections });
const jobs = (r) => r.sections.filter((s) => s.type === 'experience').flatMap((s) => s.items);

const RICH = '<p>Ops <strong>lead</strong> for ten years</p><ul><li>Kubernetes</li><li>Terraform<ul><li>Modules</li></ul></li></ul><ol><li>First</li><li>Second</li></ol><p>Closing line</p>';

test('a past job with no end date comes back past, a current one current (R2-006)', () => {
  const resume = resumeWith([section('experience', 'Work', [
    { id: 'a', company: 'Now Co', role: 'Lead', startDate: '2023-01', endDate: '', current: true, description: '' },
    { id: 'b', company: 'Past Co', role: 'Dev', startDate: '2019-01', endDate: '', current: false, description: '' },
    { id: 'c', company: 'Old Co', role: 'Intern', startDate: '2016-01', endDate: '2017-01', current: false, description: '' },
  ])]);
  const back = roundTrip(resume);
  assert.deepEqual(jobs(back).map((j) => [j.company, Boolean(j.current), j.endDate]), [['Now Co', true, ''], ['Past Co', false, ''], ['Old Co', false, '2017-01']]);
  assert.equal(generateAtsPlainText(back), generateAtsPlainText(resume), '"Past Co" prints Jan 2019, not Jan 2019 - Present');
});

test('a file another builder wrote: a job with no end date is still the current one — JSON Resume\'s own convention', () => {
  const r = jsonResumeToCpwtResume({ basics: { name: 'X' }, work: [{ name: 'A', startDate: '2022-01' }, { name: 'B', startDate: '2019-01', endDate: '2021-01' }, { name: 'C' }] });
  assert.deepEqual(jobs(r).map((j) => j.current), [true, false, false]);
  // A flag that is not true or false is no flag: the end date decides.
  const odd = jsonResumeToCpwtResume({ basics: { name: 'X' }, work: [{ name: 'A', startDate: '2022-01', current: 'no' }, { name: 'B', startDate: '2019-01', endDate: '2021-01', current: 1 }] });
  assert.deepEqual(jobs(odd).map((j) => j.current), [true, false]);
});

test('the summary comes back as it prints: its paragraphs, its lists (nested, numbered) and its bold (R2-006)', () => {
  const resume = resumeWith([], { summary: RICH });
  const file = exportOf(resume);
  assert.equal(file.basics.summary, 'Ops lead for ten years\nKubernetes\nTerraform\nModules\nFirst\nSecond\nClosing line', 'other tools still read plain text');
  assert.deepEqual(printed(jsonResumeToCpwtResume(file).personal.summary), printed(RICH));
  // A one-paragraph summary needs nothing beside its text.
  assert.equal(exportOf(resumeWith([], { summary: '<p>Just a line &amp; more</p>' })).basics.summaryHtml, undefined);
  assert.deepEqual(printed(roundTrip(resumeWith([], { summary: '<p>Just a line &amp; more</p>' })).personal.summary), ['Just a line & more']);
});

test('a summary edited in the file after the export: the edited text is what comes back', () => {
  const file = exportOf(resumeWith([], { summary: RICH }));
  file.basics.summary = 'Rewritten by hand';
  assert.deepEqual(printed(jsonResumeToCpwtResume(file).personal.summary), ['Rewritten by hand']);
});

test('the summary\'s formatted copy is read as the editor reads HTML: only its safe tags come back', () => {
  const summaryHtml = '<p onclick="x()">Hi <img src=x onerror=alert(1)><a href="javascript:alert(1)">there</a></p><script>alert(1)</script><style>p{}</style>';
  const r = jsonResumeToCpwtResume({ basics: { name: 'X', summary: 'Hi there', summaryHtml } });
  assert.doesNotMatch(r.personal.summary, /<img|<script|<style|onerror|onclick|javascript:/i, r.personal.summary);
  assert.deepEqual(printed(r.personal.summary), ['Hi there']);
  for (const v of [42, { a: 1 }, ['<ul>'], null]) {
    const odd = jsonResumeToCpwtResume({ basics: { name: 'X', summary: 'Plain', summaryHtml: v } });
    assert.deepEqual(printed(odd.personal.summary), ['Plain'], JSON.stringify(v));
  }
});

test('an award\'s list comes back a list, not lines (R2-006)', () => {
  const description = '<p>For <strong>uptime</strong></p><ul><li>99.99%</li><li>Zero pages</li></ul>';
  const back = roundTrip(resumeWith([section('awards', 'Awards', [{ id: 'a', title: 'Best Ops', issuer: 'Acme', date: '2023', description }])]));
  assert.deepEqual(printed(back.sections[0].items[0].description), printed(description));
});

test('the website, LinkedIn and GitHub keep their display labels and link URLs (R2-006)', () => {
  const personal = { email: 'a@b.io', website: 'ada.dev', websiteLabel: 'My site', websiteUrl: 'https://ada.dev/cv', linkedin: 'linkedin.com/in/ada', linkedinLabel: 'Ada on LinkedIn', github: 'github.com/ada', githubUrl: 'https://github.com/ada?tab=repos' };
  const back = roundTrip(resumeWith([], personal));
  assert.deepEqual(contactItems(back.personal), contactItems(resumeWith([], personal).personal));
  for (const { key, link } of CONTACT_FIELDS.filter((f) => f.link)) {
    assert.equal(back.personal[`${key}Label`] ?? '', personal[`${key}Label`] ?? '', `${key} label`);
    assert.equal(back.personal[`${key}Url`] ?? '', personal[`${key}Url`] ?? '', `${key} link URL (${link})`);
  }
  // None set: the imported header holds no empty label or link fields.
  assert.deepEqual(Object.keys(roundTrip(resumeWith([], { website: 'ada.dev' })).personal).filter((k) => /Label$|Url$/.test(k)), []);
});

test('a skill group with no category comes back with none — it does not print a "Skills" label (R2-006)', () => {
  const back = roundTrip(resumeWith([section('skills', 'Skills', [{ id: 's', category: '', skills: 'React, SQL' }, { id: 't', category: 'Tools', skills: 'Git' }])]));
  assert.deepEqual(back.sections[0].items.map((i) => [i.category, i.skills]), [['', 'React, SQL'], ['Tools', 'Git']]);
  // A group in another builder's file with no name at all still gets the default one.
  assert.equal(jsonResumeToCpwtResume({ basics: { name: 'X' }, skills: [{ keywords: ['Go'] }] }).sections[0].items[0].category, 'Technical Skills');
});

/** An entry of `type` with every field its editor writes, dates as the file writes them (ISO), descriptions a paragraph and a list. */
function entry(type) {
  const blank = SECTION_TYPE_DEFAULTS[type]('s').items[0];
  const item = {};
  for (const key of Object.keys(blank)) {
    if (key === 'id') item.id = `${type}-1`;
    else if (key === 'current') item.current = false;
    else if (key === 'bullets') item.bullets = [];
    else if (key === 'description') item.description = `<p>About ${type}</p><ul><li>Led ${type}</li></ul>`;
    else if (/date|expiry/i.test(key)) item[key] = key === 'endDate' || key === 'expiry' ? '' : '2021-03';
    else if (key === 'interests' || key === 'skills' || key === 'technologies') item[key] = `${type} one, ${type} two`;
    else item[key] = `${type} ${key}`;
  }
  return item;
}

test('every section type prints the same after the round trip (the ATS text, which prints what the PDF prints) (R2-006)', () => {
  const sections = Object.keys(SECTION_TYPE_DEFAULTS).map((type) => section(type, `My ${type}`, [entry(type)]));
  const resume = resumeWith(sections, { title: 'Engineer', email: 'a@b.io', summary: RICH });
  assert.equal(generateAtsPlainText(roundTrip(resume)), generateAtsPlainText(resume));
});
