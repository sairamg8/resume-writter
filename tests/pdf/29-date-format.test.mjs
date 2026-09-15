// Design → Date format (PAR-06): every dated entry of every template, the Word export and the cover
// letter's date print in the résumé's `settings.dateFormat`, whatever shape each date was stored in
// ("Jan 2020" from the picker, "05/2023", "2019-05" or 2014 from an import). Text that is not a
// month and year ("Summer 2020", "Present") prints as typed, and a résumé storing no format — every
// one saved before PAR-06 — prints each date exactly as stored, as it always did.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, renderCover, renderDocx, read, allText, readDocx, loadModule, TEMPLATES } from './harness.mjs';
import { drawing } from './extractors.mjs';

before(setup);
after(teardown);

/** One entry of each dated kind, its dates stored every way the app meets them. */
const entries = () => [
  section('experience', [
    { company: 'Initech', role: 'Lead', startDate: 'Jan 2020', endDate: 'Mar 2023' },
    { company: 'Globex', role: 'Developer', startDate: '05/2023', endDate: '', current: true },
  ]),
  section('education', [{ institution: 'State University', degree: 'BSc', startDate: 2014, endDate: 'Jun 2018' }]),
  section('projects', [{ name: 'Widget', startDate: '2019-05', endDate: 'Summer 2020' }]),
  section('volunteering', [{ org: 'Shelter', role: 'Helper', startDate: 'September 2016', endDate: '12.2017' }]),
  section('certifications', [{ name: 'Cloud Cert', date: 'Jul 2021', expiry: '2024' }]),
  section('awards', [{ title: 'Top Award', date: 'Oct 2022' }]),
  section('custom', [{ title: 'Conference Talk', date: 'Feb 2021' }]),
];

/**
 * What each entry prints, per Date format, in the order of entries(): written out by hand, not
 * computed with the code under test. As entered is each date as stored.
 */
const PRINTS = {
  asEntered: ['Jan 2020 – Mar 2023', '05/2023 – Present', '2014 – Jun 2018', '2019-05 – Summer 2020', 'September 2016 – 12.2017', 'Jul 2021 – 2024', 'Oct 2022', 'Feb 2021'],
  'MMM YYYY': ['Jan 2020 – Mar 2023', 'May 2023 – Present', '2014 – Jun 2018', 'May 2019 – Summer 2020', 'Sep 2016 – Dec 2017', 'Jul 2021 – 2024', 'Oct 2022', 'Feb 2021'],
  'MMMM YYYY': ['January 2020 – March 2023', 'May 2023 – Present', '2014 – June 2018', 'May 2019 – Summer 2020', 'September 2016 – December 2017', 'July 2021 – 2024', 'October 2022', 'February 2021'],
  'MM/YYYY': ['01/2020 – 03/2023', '05/2023 – Present', '2014 – 06/2018', '05/2019 – Summer 2020', '09/2016 – 12/2017', '07/2021 – 2024', '10/2022', '02/2021'],
  'MM.YYYY': ['01.2020 – 03.2023', '05.2023 – Present', '2014 – 06.2018', '05.2019 – Summer 2020', '09.2016 – 12.2017', '07.2021 – 2024', '10.2022', '02.2021'],
  'YYYY-MM': ['2020-01 – 2023-03', '2023-05 – Present', '2014 – 2018-06', '2019-05 – Summer 2020', '2016-09 – 2017-12', '2021-07 – 2024', '2022-10', '2021-02'],
  'YYYY.MM': ['2020.01 – 2023.03', '2023.05 – Present', '2014 – 2018.06', '2019.05 – Summer 2020', '2016.09 – 2017.12', '2021.07 – 2024', '2022.10', '2021.02'],
  YYYY: ['2020 – 2023', '2023 – Present', '2014 – 2018', '2019 – Summer 2020', '2016 – 2017', '2021 – 2024', '2022', '2021'],
};
const FORMATS = Object.keys(PRINTS).filter((f) => f !== 'asEntered');

/** A résumé of entries() in `template`; `dateFormat` undefined stores no format at all. */
function dated(template, dateFormat) {
  const r = resume({ template, sections: entries() });
  if (dateFormat === undefined) delete r.settings.dateFormat;
  else r.settings.dateFormat = dateFormat;
  return r;
}

/** The expected strings the PDF's text does not contain. */
const missingIn = (text, wants) => wants.filter((want) => !text.includes(want));

describe('a résumé storing no Date format prints every date as stored (old data unchanged)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: each date as stored, and the same page as a new résumé's As entered`, async () => {
      const old = await render(dated(template, undefined));
      assert.deepEqual(missingIn(allText(await read(old)), PRINTS.asEntered), []);
      assert.equal(await drawing(await render(dated(template, 'asEntered'))), await drawing(old));
    });
  }

  it('a new résumé stores As entered, which Design → Reset restores', async () => {
    const { ATS_DEFAULTS, createBlankResume, defaultSettings } = await loadModule('/src/utils/defaultData.js');
    assert.equal(ATS_DEFAULTS.dateFormat, 'asEntered');
    assert.equal(createBlankResume({ id: 'r' }).settings.dateFormat, 'asEntered');
    for (const template of TEMPLATES) assert.equal(defaultSettings(template).dateFormat, 'asEntered', template);
  });
});

describe('each Date format in the PDF', () => {
  FORMATS.forEach((format, i) => {
    const template = TEMPLATES[i % TEMPLATES.length];
    it(`${format} (${template}): every dated section, free text and "Present" as typed`, async () => {
      const text = allText(await read(await render(dated(template, format))));
      assert.deepEqual(missingIn(text, PRINTS[format]), [], text);
    });
  });

  for (const template of TEMPLATES) {
    it(`MM/YYYY in ${template}: both columns, cards and single dates`, async () => {
      const text = allText(await read(await render(dated(template, 'MM/YYYY'))));
      assert.deepEqual(missingIn(text, PRINTS['MM/YYYY']), [], text);
      assert.ok(!text.includes('Jan 2020') && !text.includes('Oct 2022'), 'no date left as the picker stored it');
    });
  }

  it('a format this build does not know (a newer build\'s) prints as entered', async () => {
    const text = allText(await read(await render(dated('classic', 'DD MMM YYYY'))));
    assert.deepEqual(missingIn(text, PRINTS.asEntered), []);
  });
});

describe('an award\'s or custom entry\'s single date takes the range rule (38c1072)', () => {
  // They printed the stored value raw, around dateRange: a date of spaces drew an empty line under
  // the award (and a tab in Word), a padded one its spaces. Checked by mutation on 1defc45.
  const single = (date) => [section('awards', [{ title: 'Top Award', date }]), section('custom', [{ title: 'Talk', date }])];
  for (const template of ['classic', 'sidebar']) {
    it(`${template}: a date of spaces prints nothing — the page of no date; a padded one prints trimmed`, async () => {
      const page = async (date) => drawing(await render(resume({ template, sections: single(date) })));
      assert.equal(await page('   '), await page(''));
      assert.equal(await page(' Oct 2022 '), await page('Oct 2022'));
    });
  }

  it('Word: no tab after a date of spaces; a padded date trimmed', async () => {
    const texts = async (date) => (await renderDocx(resume({ sections: single(date) }))).texts;
    assert.deepEqual(await texts('   '), await texts(''));
    assert.deepEqual(await texts(' Oct 2022 '), await texts('Oct 2022'));
  });
});

describe('each Date format in Word', () => {
  for (const format of ['asEntered', ...FORMATS]) {
    it(`${format}: every dated paragraph ends with its date`, async () => {
      const { texts } = await renderDocx(dated('classic', format));
      const missing = PRINTS[format].filter((want) => !texts.some((t) => t.endsWith(`\t${want}`)));
      assert.deepEqual(missing, [], texts.join(' | '));
    });
  }

  it('no format stored: the same paragraphs as As entered', async () => {
    assert.deepEqual((await renderDocx(dated('modern', undefined))).texts, (await renderDocx(dated('modern', 'asEntered'))).texts);
  });
});

describe('the cover letter\'s date follows the Date format', () => {
  async function letterDate(dateFormat, date) {
    const r = resume({ template: 'classic', coverLetter: { date, body: '<p>Hello</p>' } });
    if (dateFormat === undefined) delete r.settings.dateFormat;
    else r.settings.dateFormat = dateFormat;
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const docx = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
    return { pdf: allText(await read(await renderCover(r))), word: docx.texts };
  }
  const CASES = [
    // [format, stored date, printed]
    [undefined, '2026-01-15', '15 January 2026'],
    [undefined, '15 Jan 2026', '15 Jan 2026'],
    ['asEntered', '2026-01-15', '15 January 2026'],
    ['MMM YYYY', '15 January 2026', '15 Jan 2026'],
    ['MMMM YYYY', '2026-01-15', '15 January 2026'],
    ['MM/YYYY', '15 January 2026', '15/01/2026'],
    ['MM.YYYY', '2026-01-15', '15.01.2026'],
    ['YYYY-MM', '15 January 2026', '2026-01-15'],
    ['YYYY.MM', '2026-01-15', '2026.01.15'],
    ['YYYY', '2026-01-15', '15 January 2026'],
    ['MM/YYYY', 'Monday morning', 'Monday morning'],
    ['YYYY-MM', '2026-02-31', '2026-02-31'],
  ];
  for (const [format, stored, printed] of CASES) {
    it(`${format ?? 'no format'}: "${stored}" prints "${printed}" in the PDF and in Word`, async () => {
      const { pdf, word } = await letterDate(format, stored);
      assert.ok(pdf.startsWith(`Test Person Engineer ${printed} Hello`), pdf);
      assert.ok(word.includes(printed), word.join(' | '));
    });
  }
});

describe('the setting is kept: normalizeResume, JSON export and import', () => {
  const roundTrip = (r) => JSON.parse(JSON.stringify(r)); // Export JSON writes JSON.stringify(résumé)

  it('a current résumé and one an old build saved (no data version) keep their format, and print it', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const current = dated('minimal', 'YYYY-MM');
    const old = { ...dated('executive', 'MMMM YYYY'), updatedAt: Date.UTC(2026, 7, 20) };
    delete old.dataVersion;
    for (const [r, format] of [[current, 'YYYY-MM'], [old, 'MMMM YYYY']]) {
      const loaded = normalizeResume(roundTrip(r));
      assert.equal(loaded.settings.dateFormat, format);
      assert.deepEqual(missingIn(allText(await read(await render(loaded))), PRINTS[format]), [], format);
    }
  });

  it('a format this build does not know stays stored — an older tab never erases a newer build\'s choice', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const r = dated('classic', 'DD MMM YYYY');
    delete r.dataVersion;
    assert.equal(normalizeResume(roundTrip(r)).settings.dateFormat, 'DD MMM YYYY');
  });

  it('a résumé saved by 4bc56fe (no data version, no format) loads with no format and prints as stored', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const r = { ...dated('sidebar', undefined), updatedAt: Date.UTC(2026, 8, 10) };
    delete r.dataVersion;
    const loaded = normalizeResume(roundTrip(r));
    assert.equal('dateFormat' in loaded.settings, false, 'nothing added: an older build reading it back sees what it wrote');
    assert.deepEqual(missingIn(allText(await read(await render(loaded))), PRINTS.asEntered), []);
  });
});
