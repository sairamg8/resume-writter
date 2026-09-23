// Export → JSON Resume → import keeps every section the app has (R2-002). The export wrote only
// Experience, Education, Skills, Projects, Certifications and Awards: a Languages, Volunteering,
// Interests, References or custom section was not in the file at all, and a file from another
// builder lost its volunteer, languages, interests, references and publications on import. Every
// section type the app offers (SECTION_TYPE_DEFAULTS), not a hand-written list: a type added to the
// app without a home in the file fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';
import { SECTION_TYPE_DEFAULTS } from '../../src/utils/defaultDataSectionTypes.js';
import { parseRichText } from '../../src/utils/richText.js';
import { formatDate } from '../../src/utils/dates.js';

const MMM = { dateFormat: 'MMM YYYY' };
const TYPES = Object.keys(SECTION_TYPE_DEFAULTS);
const DATES = new Set(['startDate', 'endDate', 'date', 'expiry']);
/** Fields an entry's editor writes beyond its type's blank entry. */
const MORE_FIELDS = { certifications: ['urlLabel'] };
/** The keys the schema allows at the top of a file (its root takes no others). */
const SCHEMA_KEYS = ['$schema', 'basics', 'work', 'volunteer', 'education', 'awards', 'certificates', 'publications', 'skills', 'languages', 'interests', 'references', 'projects', 'meta'];

const blockText = (b) => b.runs.map((r) => r.text).join('');
/** What an entry prints as its body: its description, then its legacy bullets, as the PDF prints them. */
const body = (item) => [
  ...parseRichText(item.description || '').map((b) => `${b.marker ? `${b.marker} ` : ''}${blockText(b)}`),
  ...(item.bullets || []).map((b) => `• ${b}`),
];
/** The same body as lines of text: an award's summary is one text in the schema, so a list in it comes back as lines. */
const bodyLines = (item) => body(item).flatMap((line) => line.replace(/^• /, '').split('\n'));
/** The interests a section prints: each comma-separated one, across its entries. */
const chips = (items) => items.flatMap((i) => (i.interests || '').split(',').map((s) => s.trim()).filter(Boolean));

/** An entry of `type` with every field its editor writes filled in, each with text naming it. */
function filled(type, tag = '') {
  const blank = SECTION_TYPE_DEFAULTS[type]('s').items[0];
  const item = {};
  for (const key of [...Object.keys(blank), ...(MORE_FIELDS[type] || [])]) {
    if (key === 'id') item.id = `${type}-item`;
    else if (key === 'current') item.current = false;
    else if (key === 'bullets') item.bullets = [`Legacy ${type} point${tag}`];
    else if (key === 'description') item.description = `<p>About ${type} &amp; more${tag}</p><ul><li>Led ${type}${tag}</li></ul>`;
    else if (DATES.has(key)) item[key] = key === 'startDate' || key === 'date' ? 'Mar 2021' : 'Jun 2023';
    else if (key === 'interests' || key === 'skills' || key === 'technologies') item[key] = `${type} one${tag}, ${type} two${tag}`;
    else item[key] = `${type} ${key}${tag}`;
  }
  return item;
}

const section = (type, title, items, settings) => ({ id: `sec-${title}`, type, title, visible: true, ...(settings ? { settings } : {}), items });
const resumeWith = (sections) => ({ personal: { name: 'Ada Lovelace' }, template: 'classic', settings: {}, sections });
/** The résumé an exported file is imported back as, through JSON text as the download writes it. */
const roundTrip = (resume) => jsonResumeToCpwtResume(JSON.parse(JSON.stringify(cpwtResumeToJsonResume(resume))));

/** Asserts `back` prints what `item` of `type` printed: each field its editor writes, its dates as they print, its body. */
function assertSameEntry(type, item, back, label) {
  for (const [key, value] of Object.entries(item)) {
    if (key === 'id' || key === 'bullets' || key === 'interests') continue;
    if (key === 'description') {
      const read = type === 'awards' ? bodyLines : body;
      assert.deepEqual(read(back), read(item), `${label}: description`);
    } else if (DATES.has(key)) {
      assert.equal(formatDate(back[key], MMM), formatDate(value, MMM), `${label}: ${key}`);
    } else {
      assert.equal(back[key] ?? '', value, `${label}: ${key}`);
    }
  }
}

test('round trip: every section type the app offers comes back — its title, its place, every field it prints (R2-002)', () => {
  const sections = TYPES.map((type) => section(type, `My ${type}`, [filled(type)]));
  const back = roundTrip(resumeWith(sections));
  assert.deepEqual(back.sections.map((s) => s.type), TYPES, 'every type, in the order the résumé had them');
  assert.deepEqual(back.sections.map((s) => s.title), TYPES.map((t) => `My ${t}`), 'each section keeps its own title');
  for (const [i, type] of TYPES.entries()) {
    const items = back.sections[i].items;
    if (type === 'interests') {
      assert.deepEqual(chips(items), chips(sections[i].items), 'interests: every one prints');
      continue;
    }
    assert.equal(items.length, 1, `${type}: one entry`);
    assertSameEntry(type, sections[i].items[0], items[0], type);
  }
});

test('round trip: two sections of one type, and custom sections between them, keep their own entries, titles and order', () => {
  const resume = resumeWith([
    section('interests', 'Hobbies', [{ id: 'i1', interests: 'Chess, Climbing' }, { id: 'i2', interests: 'Go' }]),
    section('experience', 'Industry', [filled('experience', ' A'), filled('experience', ' B')], { columns: 1, showLocation: false }),
    section('custom', 'Talks', [filled('custom', ' T')]),
    section('experience', 'Academia', [filled('experience', ' C')]),
    section('custom', 'Patents', [filled('custom', ' P'), filled('custom', ' Q')], { showDates: false }),
    section('languages', 'Spoken', []),
  ]);
  const back = roundTrip(resume);
  assert.deepEqual(back.sections.map((s) => [s.type, s.title, s.items.length]), [
    ['interests', 'Hobbies', 1], ['experience', 'Industry', 2], ['custom', 'Talks', 1],
    ['experience', 'Academia', 1], ['custom', 'Patents', 2], ['languages', 'Spoken', 0],
  ]);
  assert.deepEqual(chips(back.sections[0].items), ['Chess', 'Climbing', 'Go']);
  for (const [s, i] of [[1, 0], [1, 1], [2, 0], [3, 0], [4, 0], [4, 1]]) {
    const type = resume.sections[s].type;
    assertSameEntry(type, resume.sections[s].items[i], back.sections[s].items[i], `${resume.sections[s].title} #${i}`);
  }
  assert.deepEqual(back.sections[1].settings, { columns: 1, showLocation: false }, 'a section\'s own settings come back');
  assert.deepEqual(back.sections[4].settings, { showDates: false });
  assert.equal(back.sections[0].settings, undefined, 'none stored: none made up');
});

test('export: each section is in the schema\'s own key, in the schema\'s shape — the file stays valid JSON Resume', () => {
  const file = cpwtResumeToJsonResume(resumeWith(TYPES.map((type) => section(type, `My ${type}`, [filled(type)]))));
  assert.deepEqual(Object.keys(file).filter((k) => !SCHEMA_KEYS.includes(k)), [], 'no key the schema\'s root does not allow');
  assert.deepEqual(file.languages, [{ language: 'languages language', fluency: 'languages proficiency' }]);
  assert.deepEqual(file.interests, [{ name: 'interests one', keywords: [] }, { name: 'interests two', keywords: [] }], 'one interest each, as the PDF prints them');
  const [vol] = file.volunteer;
  assert.deepEqual([vol.organization, vol.position, vol.location, vol.startDate, vol.endDate], ['volunteering org', 'volunteering role', 'volunteering location', '2021-03', '2023-06']);
  assert.deepEqual([vol.summary, vol.highlights], ['About volunteering & more', ['Led volunteering', 'Legacy volunteering point']]);
  const [ref] = file.references;
  assert.equal(ref.name, 'references name');
  assert.equal(ref.reference, 'references jobTitle, references company\nreferences relationship\nreferences email | references phone', 'what the PDF prints under the name, for any tool');
  const [cert] = file.certificates;
  assert.deepEqual([cert.expiry, cert.credentialId, cert.url, cert.urlLabel], ['2023-06', 'certifications credentialId', 'certifications url', 'certifications urlLabel']);
  assert.deepEqual(file.projects[0].keywords, ['projects one', 'projects two'], 'Technologies are the schema\'s project keywords');
  assert.deepEqual(file.work[0].highlights, ['Led experience', 'Legacy experience point'], 'legacy bullets print, so they go out');
  const custom = file.meta.sections.find((s) => s.type === 'custom');
  assert.equal(custom.title, 'My custom', 'a custom section has no key in the schema: it is in meta, the schema\'s home for other tooling');
  assert.deepEqual(custom.items.map((i) => [i.title, i.subtitle, i.date, i.location]), [['custom title', 'custom subtitle', '2021-03', 'custom location']]);
});

test('import: a file from another builder brings its volunteer, languages, interests, references and publications', () => {
  const r = jsonResumeToCpwtResume({
    basics: { name: 'X' },
    projects: [{ name: 'Engine', keywords: ['Rust', 'WASM'] }],
    volunteer: [{ organization: 'Red Cross', position: 'Driver', startDate: '2019-04-01', summary: 'Weekends', highlights: ['Drove <vans>'] }],
    publications: [{ name: 'On Engines', publisher: 'ACM', releaseDate: '2020-05', summary: 'A paper', url: 'https://doi.org/1' }],
    languages: [{ language: 'German', fluency: 'Native' }],
    interests: [{ name: 'Chess', keywords: ['Openings', 'Blitz'] }, { name: 'Running' }],
    references: [{ name: 'Jane Roe', reference: 'Jane was my manager at Acme.' }],
  });
  assert.deepEqual(r.sections.map((s) => [s.type, s.title]), [
    ['projects', 'Projects'], ['volunteering', 'Volunteering'], ['custom', 'Publications'],
    ['languages', 'Languages'], ['interests', 'Interests'], ['references', 'References'],
  ]);
  const [proj, vol, pub, lang, int, ref] = r.sections.map((s) => s.items[0]);
  assert.equal(proj.technologies, 'Rust, WASM');
  assert.deepEqual([vol.org, vol.role, vol.startDate, body(vol)], ['Red Cross', 'Driver', '2019-04', ['Weekends', '• Drove <vans>']]);
  assert.deepEqual([pub.title, pub.subtitle, pub.date, body(pub)], ['On Engines', 'ACM', '2020-05', ['A paper', 'https://doi.org/1']]);
  assert.deepEqual([lang.language, lang.proficiency], ['German', 'Native']);
  assert.deepEqual(chips(r.sections[4].items), ['Chess (Openings / Blitz)', 'Running'], 'an interest\'s keywords print with it');
  assert.deepEqual([ref.name, ref.relationship], ['Jane Roe', 'Jane was my manager at Acme.'], 'the reference text prints under the name');
});

test('import: a file edited by hand keeps every entry, whatever its meta says', () => {
  const file = cpwtResumeToJsonResume(resumeWith([section('experience', 'Industry', [filled('experience', ' A')]), section('skills', 'Tools', [filled('skills')])]));
  file.work.push({ name: 'Added by hand', position: 'Dev' });
  file.languages = [{ language: 'French' }];
  const back = jsonResumeToCpwtResume(file);
  assert.deepEqual(back.sections.map((s) => [s.type, s.title, s.items.length]), [['experience', 'Industry', 2], ['skills', 'Tools', 1], ['languages', 'Languages', 1]]);
  assert.equal(back.sections[0].items[1].company, 'Added by hand');
  for (const sections of ['x', [null, 5, 'y'], [{ type: 'nope', title: 'Z' }], [{ type: 'experience', entries: -1 }]]) {
    const r = jsonResumeToCpwtResume({ basics: { name: 'X' }, work: [{ name: 'A' }, { name: 'B' }], meta: { sections } });
    const work = r.sections.filter((s) => s.type === 'experience');
    assert.deepEqual(work.flatMap((s) => s.items.map((i) => i.company)), ['A', 'B'], JSON.stringify(sections));
  }
});

test('import: a value that is not text in the new sections is stored as text, and none stops the import', () => {
  for (const v of [42, { a: 1 }, ['A', 'B'], true, null]) {
    const r = jsonResumeToCpwtResume({
      basics: { name: 'X' },
      volunteer: [null, { organization: v, position: v, location: v, startDate: v, endDate: v, summary: v, highlights: [v] }],
      languages: [{ language: v, fluency: v }],
      interests: [{ name: v, keywords: v }, { name: v, keywords: [v] }],
      references: [{ name: v, reference: v }, { name: v, jobTitle: v, company: v, relationship: v, email: v, phone: v }],
      publications: [{ name: v, publisher: v, releaseDate: v, summary: v, url: v }],
      meta: { sections: [{ type: 'custom', title: v, settings: v, items: [{ title: v, subtitle: v, date: v, location: v, summary: v, highlights: v }] }] },
    });
    const label = JSON.stringify(v);
    const texts = r.sections.flatMap((s) => [s.title, ...s.items.flatMap(({ id: _id, ...fields }) => Object.values(fields))]);
    for (const t of texts) assert.equal(typeof t, 'string', `${label}: ${JSON.stringify(t)}`);
    assert.ok(!texts.join(' ').includes('[object Object]'), `${label}: ${texts.join(' | ')}`);
  }
});
