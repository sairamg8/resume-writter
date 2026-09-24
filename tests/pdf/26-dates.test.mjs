// Date ranges: every dated section of every template, and Word, print them through one rule
// (dateRange, src/utils/dates.js) — "start – end", either alone, an end alone as "– end" — and
// a date imported as a number prints like one typed as text (R9-1; R9-2 / R2-7).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setup, teardown, resume, section, render, renderDocx, read, itemsWith, overlaps, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

/** Each dated section type: an entry's other fields, and the keys of its two dates. */
const RANGED = [
  ['experience', { company: 'Co', role: 'Ro' }, ['startDate', 'endDate']],
  ['education', { institution: 'Uni', degree: 'Deg' }, ['startDate', 'endDate']],
  ['projects', { name: 'Proj' }, ['startDate', 'endDate']],
  ['volunteering', { org: 'Org', role: 'Vol' }, ['startDate', 'endDate']],
  ['certifications', { name: 'Cert' }, ['date', 'expiry']],
];

/**
 * One résumé with every dated section: per type i an entry with only an end date (0i/2030), one
 * with numeric years (2010+i, 2020+i), one with a start only (0i/2011) and, for experience, one
 * current entry with no start. Returns it and the date text each entry must print.
 */
function dated(template) {
  const expected = [];
  const sections = RANGED.map(([type, fields, [from, to]], i) => {
    const items = [
      { ...fields, [from]: '', [to]: `0${i + 1}/2030` },
      { ...fields, [from]: 2010 + i, [to]: 2020 + i },
      { ...fields, [from]: `0${i + 1}/2011`, [to]: '  ' },
    ];
    expected.push(`– 0${i + 1}/2030`, `${2010 + i} – ${2020 + i}`, `0${i + 1}/2011`);
    if (type === 'experience') {
      items.push({ ...fields, startDate: '', current: true });
      expected.push('– Present');
    }
    return section(type, items);
  });
  return { r: resume({ template, sections }), expected };
}

/**
 * The text each text object (BT … ET) of the document draws, in order, exactly as drawn: a
 * leading space counts here, where pdf.js's text content drops it.
 */
async function drawnRuns(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const O = pdfjs.OPS;
  const out = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const { fnArray, argsArray } = await (await doc.getPage(i)).getOperatorList();
    let run = null;
    fnArray.forEach((fn, k) => {
      if (fn === O.beginText) run = '';
      else if (fn === O.endText) { out.push(run); run = null; }
      else if (fn === O.showText && run !== null) run += argsArray[k][0].map((g) => (g && typeof g === 'object' ? g.unicode : '')).join('');
    });
  }
  await doc.loadingTask.destroy();
  return out;
}

describe('one date-range rule for every section, in the PDF and in Word', () => {
  for (const template of TEMPLATES) {
    it(`${template}: each entry draws exactly its range — no leading space, numeric years kept`, async () => {
      const { r, expected } = dated(template);
      const runs = await drawnRuns(await render(r));
      // react-pdf draws "– Present" as two runs, "– " and "Present".
      const drawn = (want) => runs.some((run, i) => run === want || run + (runs[i + 1] ?? '') === want);
      const found = expected.filter((want) => !drawn(want))
        .map((want) => `"${want}": ${JSON.stringify(runs.filter((run) => run.includes(want.replace(/^– /, '')) || run.trim() === '–'))}`);
      assert.deepEqual(found, []);
    });
  }

  it('Word prints the same ranges, numeric years included', async () => {
    const { r, expected } = dated('classic');
    const { texts } = await renderDocx(r);
    // At the end of an entry's title line: a Stacked entry's second field is on the line under it (R2-070).
    const missing = expected.filter((want) => !texts.some((t) => t.split('\n').some((line) => line.endsWith(`\t${want}`))));
    assert.deepEqual(missing, [], texts.join(' | '));
  });
});

describe('a long title beside a date never squeezes it (VM3-9)', () => {
  // Guard: the title column is flex: 1 (basis 0), so the date keeps its width and its place —
  // not the flexShrink: 0 the date Texts carried, which react-pdf 4 reads as 1. Checked by
  // mutation: with a title column of auto width the title's lines run under the date and push
  // it past the right margin. Every header row with a date on the right.
  const LONG = 'Principal Distinguished Staff Engineer for Platform Reliability, Developer Experience and Internal Tooling at Global Scale';
  const entries = () => [ // built in the test: section() needs setup
    section('experience', [{ company: 'Globex Corporation International', role: LONG, location: 'Springfield', startDate: '01/2020', endDate: '12/2021' }]),
    section('certifications', [{ name: LONG, issuer: 'Acme', date: '01/2020', expiry: '12/2021' }]),
  ];
  for (const template of TEMPLATES) {
    it(`${template}: Stacked, Inline and Side by side print "01/2020 – 12/2021" whole, on one line`, async () => {
      const wrong = [];
      for (const titleStyle of ['stacked', 'inline', 'sidebyside']) {
        const sections = entries().map((s) => ({ ...s, settings: { ...s.settings, titleStyle } }));
        const pages = await read(await render(resume({ template, sections })));
        const hits = itemsWith(pages, '12/2021');
        if (hits.length !== 2 || hits.some((t) => !t.str.includes('01/2020 – 12/2021'))) wrong.push(`${titleStyle}: ${JSON.stringify(hits.map((t) => t.str))}`);
        const onDate = overlaps(pages[0]).filter((pair) => pair.some((str) => str.includes('12/2021')));
        if (onDate.length) wrong.push(`${titleStyle}: overprinted ${JSON.stringify(onDate)}`);
        const right = pages[0].W - Math.min(...pages[0].items.map((t) => t.x)); // the right margin
        for (const t of hits) if (t.x + t.w > right + 0.5) wrong.push(`${titleStyle}: the date ends at ${(t.x + t.w).toFixed(1)}, past the margin at ${right.toFixed(1)}`);
      }
      assert.deepEqual(wrong, []);
    });
  }
});
