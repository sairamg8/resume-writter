// Design → Language (R2-148): the words the app itself prints on a résumé — month names, a current
// entry's "Present", the section titles it gave and the summary heading — follow the résumé's
// settings.language in every date (src/utils/dates.js), the Markdown export and the ATS text; what
// the user typed, and every title they renamed, prints as typed. A résumé storing no language (every
// one saved before the setting) prints exactly what it printed before, in English. A JSON Resume
// round trip keeps the language. Every expected word is written out here, not read from the code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateRange, formatDate, formatDayDate, presentLabel } from '../../src/utils/dates.js';
import { DEFAULT_LANGUAGE, RESUME_LANGUAGES, directionOf, languageOf, sectionTitle } from '../../src/utils/resumeLanguage.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';
import { jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';

const lang = (language, dateFormat) => ({ language, ...(dateFormat ? { dateFormat } : {}) });

/** January and September of each language, long and short, and its "Present" — by hand, from CLDR. */
const WORDS = {
  en: ['January', 'Jan', 'September', 'Sep', 'Present'],
  es: ['enero', 'ene', 'septiembre', 'sept', 'Actualidad'],
  fr: ['janvier', 'janv.', 'septembre', 'sept.', 'Aujourd’hui'],
  de: ['Januar', 'Jan.', 'September', 'Sept.', 'heute'],
  pt: ['janeiro', 'jan.', 'setembro', 'set.', 'Atual'],
  it: ['gennaio', 'gen', 'settembre', 'set', 'In corso'],
  nl: ['januari', 'jan', 'september', 'sep', 'heden'],
  ar: ['يناير', 'يناير', 'سبتمبر', 'سبتمبر', 'حتى الآن'],
  he: ['ינואר', 'ינואר', 'ספטמבר', 'ספטמבר', 'היום'],
  fa: ['ژانویه', 'ژانویه', 'سپتامبر', 'سپتامبر', 'اکنون'],
  ur: ['جنوری', 'جنوری', 'ستمبر', 'ستمبر', 'تاحال'],
};

test('the languages offered: English first, the seven asked for, and four right-to-left ones', () => {
  assert.deepEqual(RESUME_LANGUAGES.map(([id]) => id), Object.keys(WORDS));
  assert.equal(RESUME_LANGUAGES[0][1], 'English');
  for (const id of ['ar', 'he', 'fa', 'ur']) assert.equal(directionOf(lang(id)), 'rtl', id);
  for (const id of ['en', 'es', 'fr', 'de', 'pt', 'it', 'nl']) assert.equal(directionOf(lang(id)), 'ltr', id);
});

test('languageOf: none, an unknown one (a newer build\'s) or a non-string is English', () => {
  for (const v of [undefined, null, '', 'xx', 'toString', 'EN', 42, {}]) assert.equal(languageOf({ language: v }), DEFAULT_LANGUAGE, String(v));
  assert.equal(languageOf(undefined), 'en');
  assert.equal(directionOf(undefined), 'ltr');
  assert.equal(languageOf(lang('fr')), 'fr');
});

test('each Date format prints the month in the résumé\'s language, and "Present" in its words', () => {
  for (const [id, [long, short, sepLong, sepShort, present]] of Object.entries(WORDS)) {
    assert.equal(formatDate('01/2021', lang(id, 'MMMM YYYY')), `${long} 2021`, id);
    assert.equal(formatDate('Sep 2016', lang(id, 'MMMM YYYY')), `${sepLong} 2016`, id);
    assert.equal(formatDate('2021-01', lang(id, 'MMM YYYY')), `${short} 2021`, id);
    assert.equal(formatDate('09.2016', lang(id, 'MMM YYYY')), `${sepShort} 2016`, id);
    assert.equal(presentLabel(lang(id)), present, id);
    // The numeric formats have no words: the same in every language.
    assert.equal(formatDate('Jan 2021', lang(id, 'MM/YYYY')), '01/2021', id);
    assert.equal(formatDate('Jan 2021', lang(id, 'YYYY')), '2021', id);
  }
});

test('As entered: a month the picker wrote in English words prints in the language, short for short; every other date as stored', () => {
  const es = lang('es');
  assert.equal(formatDate('Jan 2024', es), 'ene 2024');
  assert.equal(formatDate('January 2024', es), 'enero 2024');
  assert.equal(formatDate('May 2024', es), 'may 2024', 'May is the short name too');
  assert.equal(formatDate('June 2024', es), 'junio 2024', 'June is a long name');
  assert.equal(formatDate('Sept. 2024', lang('fr')), 'sept. 2024');
  for (const typed of ['05/2023', '2019-05', 'Summer 2020', '2014', 'Jan', 'enero 2024']) assert.equal(formatDate(typed, es), typed, typed);
  assert.equal(formatDate(2019, es), '2019');
  assert.equal(dateRange('Jan 2020', 'Mar 2023', lang('de')), 'Jan. 2020 – März 2023');
});

test('the cover letter\'s date: its month in the language, As entered and in a Date format', () => {
  assert.equal(formatDayDate('2026-01-15', lang('fr')), '15 janvier 2026');
  assert.equal(formatDayDate('15 January 2026', lang('fr')), '15 janvier 2026');
  assert.equal(formatDayDate('15 Jan 2026', lang('es')), '15 ene 2026');
  assert.equal(formatDayDate('2026-01-15', lang('de', 'MMM YYYY')), '15 Jan. 2026');
  assert.equal(formatDayDate('15/01/2026', lang('fr')), '15/01/2026', 'a day it cannot read: as typed');
});

test('English — none stored, or picked — prints every date exactly as before', () => {
  for (const settings of [undefined, {}, lang('en'), lang('xx')]) {
    assert.equal(formatDate('Jan 2024', settings), 'Jan 2024');
    assert.equal(formatDate('01/2021', { ...settings, dateFormat: 'MMMM YYYY' }), 'January 2021');
    assert.equal(formatDate('09/2016', { ...settings, dateFormat: 'MMM YYYY' }), 'Sep 2016');
    assert.equal(presentLabel(settings), 'Present');
    assert.equal(formatDayDate('15 January 2026', settings), '15 January 2026');
    assert.equal(formatDayDate('2026-01-15', settings), '15 January 2026');
  }
});

test('sectionTitle: a title the app gave prints in the language; one the user wrote as stored', () => {
  const fr = lang('fr');
  const s = (type, title) => ({ type, title });
  assert.equal(sectionTitle(s('experience', 'Professional Experience'), fr), 'Expérience professionnelle');
  assert.equal(sectionTitle(s('experience', 'Work Experience'), fr), 'Expérience professionnelle', 'a starter\'s title');
  assert.equal(sectionTitle(s('experience', ' professional experience '), fr), 'Expérience professionnelle');
  assert.equal(sectionTitle(s('awards', 'Awards & Honors'), lang('de')), 'Auszeichnungen');
  assert.equal(sectionTitle(s('education', 'Education'), lang('he')), 'השכלה');
  assert.equal(sectionTitle(s('experience', 'Where I Worked'), fr), 'Where I Worked', 'renamed');
  assert.equal(sectionTitle(s('experience', 'Education'), fr), 'Education', 'another type\'s title is the user\'s');
  assert.equal(sectionTitle(s('custom', 'Custom Section'), fr), 'Custom Section', 'a custom section has no app title');
  assert.equal(sectionTitle(s('experience', 'Professional Experience'), undefined), 'Professional Experience');
});

/** A résumé with a current job, a degree and a renamed section. */
const sample = (settings) => ({
  template: 'classic',
  settings,
  personal: { name: 'Pat Sample', summary: '<p>Engineer.</p>' },
  sections: [
    { id: 'e', type: 'experience', title: 'Professional Experience', visible: true, settings: {}, items: [{ id: 'e1', company: 'Acme', role: 'Dev', startDate: 'Jan 2021', current: true }] },
    { id: 'd', type: 'education', title: 'Education', visible: true, settings: {}, items: [{ id: 'd1', institution: 'Uni', degree: 'BSc', startDate: 'Sep 2012', endDate: '06/2016' }] },
    { id: 'p', type: 'projects', title: 'Side Work', visible: true, settings: {}, items: [{ id: 'p1', name: 'Tool', startDate: 'Mar 2020' }] },
  ],
});

test('Markdown: the section titles, the summary heading, the months and "Present" in the language', () => {
  const md = generateMarkdownResume(sample(lang('es')));
  for (const want of ['## Perfil profesional', '## Experiencia profesional', '## Educación', '## Side Work', 'ene 2021 – Actualidad', 'sept 2012 – 06/2016', 'mar 2020']) {
    assert.ok(md.includes(want), `${want}:\n${md}`);
  }
  assert.ok(!/Professional|Present|Education\b/.test(md), md);
});

test('ATS text: the same words, as capitals where the headings are', () => {
  const txt = generateAtsPlainText(sample(lang('fr', 'MMMM YYYY')));
  for (const want of ['PROFIL PROFESSIONNEL', 'EXPÉRIENCE PROFESSIONNELLE', 'FORMATION', 'SIDE WORK', 'janvier 2021', 'Aujourd’hui', 'septembre 2012', 'juin 2016', 'mars 2020']) {
    assert.ok(txt.includes(want), `${want}:\n${txt}`);
  }
});

test('Markdown and ATS text of a résumé storing no language are what English prints, word for word', () => {
  const none = sample({});
  assert.equal(generateMarkdownResume(none), generateMarkdownResume(sample(lang('en'))));
  assert.equal(generateAtsPlainText(none), generateAtsPlainText(sample(lang('en'))));
  const md = generateMarkdownResume(none);
  for (const want of ['## Professional Summary', '## Professional Experience', 'Jan 2021 – Present']) assert.ok(md.includes(want), md);
  assert.ok(generateAtsPlainText(none).includes('PROFESSIONAL SUMMARY'));
});

test('JSON Resume: the language comes back from the file; English, or none, writes nothing', () => {
  const trip = (r) => jsonResumeToCpwtResume(JSON.parse(JSON.stringify(cpwtResumeToJsonResume(r))));
  for (const id of ['fr', 'ar']) {
    const r = sample(lang(id));
    assert.equal(cpwtResumeToJsonResume(r).meta.language, id);
    const back = trip(r);
    assert.equal(back.settings.language, id);
    assert.equal(generateAtsPlainText(back), generateAtsPlainText(r), id);
  }
  assert.equal('language' in cpwtResumeToJsonResume(sample({})).meta, false);
  assert.equal('language' in cpwtResumeToJsonResume(sample(lang('en'))).meta, false);
  assert.equal('language' in trip(sample({})).settings, false);
  assert.equal('language' in jsonResumeToCpwtResume({ basics: { name: 'X' }, meta: { language: 'xx' } }).settings, false, 'one this build does not know');
});
