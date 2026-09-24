// Sidebar "Single · ATS-safe": Word prints each entry in the colours the PDF prints it in (R2-121,
// R2-051). The PDF draws Classic's page with the Sidebar's own entry look — a job's dates in the Text
// colour's grey, its second field in the accent at 80 % — while Word resolved the whole section as
// Classic's and printed the dates in the accent and the second field in grey. R2-012 settled the
// order of an entry's fields the same way: the Sidebar's in every Layout; the page is Classic's.
// The PDF is the reference: each field's fill, as it shows on the white page, is the colour its
// Word run must carry.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setup, teardown, resume, experience, section, render, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

const ACCENT = '#e11d48';

/** One entry in every section type that prints dates, each field and each date a word of its own. */
const cv = (settings) => resume({
  template: 'sidebar',
  settings: { accentColor: ACCENT, sidebarSingleColumn: true, ...settings },
  personal: { name: 'Pat Sample', title: 'Engineer' },
  sections: [
    experience([{ company: 'Acmecorp', role: 'Stafflead', location: 'Lisbontown', startDate: '2011', endDate: '2012', description: '<p>Grewrevenue.</p>' }]),
    section('education', [{ institution: 'Uniname', degree: 'Degreename', location: 'Unitown', startDate: '2003', endDate: '2004' }]),
    section('skills', [{ category: 'Frontendstuff', skills: 'Reactjs, Vuejs' }]),
    section('projects', [{ name: 'Projname', technologies: 'Techstack', startDate: '2005', endDate: '2006' }]),
    section('languages', [{ language: 'Portuguese', proficiency: 'Fluentlevel' }]),
    section('certifications', [{ name: 'Cloudcert', issuer: 'Issuerorg', date: '2007' }]),
    section('awards', [{ title: 'Awardname', issuer: 'Awardgiver', date: '2008' }]),
    section('volunteering', [{ role: 'Volrole', org: 'Volorg', startDate: '2009', endDate: '2010' }]),
    section('references', [{ name: 'Refperson', jobTitle: 'Refjob', relationship: 'Refrel' }]),
    section('custom', [{ title: 'Customtitle', subtitle: 'Customsub', date: '2015' }]),
  ],
});

/** Every field the PDF prints in a colour of the résumé, and every entry's date (by its year). */
const WORDS = [
  'Acmecorp', 'Stafflead', 'Lisbontown', 'Grewrevenue', '2012',
  'Uniname', 'Degreename', 'Unitown', '2004',
  'Frontendstuff', 'Reactjs',
  'Projname', 'Techstack', '2006',
  'Portuguese', 'Fluentlevel',
  'Cloudcert', 'Issuerorg', '2007',
  'Awardname', 'Awardgiver', '2008',
  'Volrole', 'Volorg', '2010',
  'Refperson', 'Refjob', 'Refrel',
  'Customtitle', 'Customsub', '2015',
];

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** The fill of the first string the PDF draws holding `word`, as it shows on the white page (its opacity blended in). */
async function pdfInk(bytes, word) {
  const doc = await getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  try {
    for (let n = 1; n <= doc.numPages; n += 1) {
      const ops = await (await doc.getPage(n)).getOperatorList();
      let state = { fill: '#000000', alpha: 1 };
      const stack = [];
      for (let k = 0; k < ops.fnArray.length; k += 1) {
        const fn = ops.fnArray[k];
        const a = ops.argsArray[k];
        if (fn === OPS.save) stack.push({ ...state });
        else if (fn === OPS.restore) state = stack.pop() || state;
        else if (fn === OPS.setFillRGBColor) state.fill = typeof a[0] === 'string' ? a[0] : hex(a.slice(0, 3));
        else if (fn === OPS.setGState) { for (const [key, v] of a[0]) if (key === 'ca') state.alpha = v; }
        else if (fn === OPS.showText) {
          const s = a[0].map((g) => (g && typeof g === 'object' ? g.unicode : '')).join('');
          if (s.toUpperCase().includes(word.toUpperCase())) return hex(rgb(state.fill).map((v) => v * state.alpha + 255 * (1 - state.alpha)));
        }
      }
    }
    return null;
  } finally {
    await doc.loadingTask.destroy();
  }
}

/** The colour of the Word run holding `word`: its w:color, black ('auto') where it sets none. */
function wordInk(xml, word) {
  const run = xml.split('</w:r>').find((r) => (r.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) || []).some((t) => t.toUpperCase().includes(word.toUpperCase())));
  if (!run) return null;
  const c = /<w:color w:val="([0-9A-Fa-f]{6})"/.exec(run)?.[1];
  return c ? `#${c.toLowerCase()}` : '#000000';
}

/** Within 2 per channel: the rounding of two blends. */
const near = (a, b) => a && b && rgb(a).every((v, i) => Math.abs(v - rgb(b)[i]) <= 2);

/** Every field whose Word colour is not the PDF's ("word: pdf ≠ word"). */
async function mismatches(settings) {
  const r = cv(settings);
  const [bytes, docx] = [await render(r), await renderDocx(r)];
  const out = [];
  for (const word of WORDS) {
    const [pdf, docxInk] = [await pdfInk(bytes, word), wordInk(docx.xml, word)];
    if (!pdf || !docxInk) out.push(`${word}: not found (pdf ${pdf}, word ${docxInk})`);
    else if (!near(pdf, docxInk)) out.push(`${word}: pdf ${pdf} ≠ word ${docxInk}`);
  }
  return out;
}

describe('Sidebar Single · ATS-safe: Word prints every entry in the PDF\'s colours (R2-121, R2-051)', () => {
  it('a job\'s dates in the Text colour\'s grey and its second field in the accent, as the PDF prints them', async () => {
    const r = cv({ textColor: '#1e3a8a' });
    const [bytes, docx] = [await render(r), await renderDocx(r)];
    // The repro: the PDF's dates are grey, not the red accent; Word's must be the same grey.
    const pdfDate = await pdfInk(bytes, '2012');
    assert.ok(!near(pdfDate, ACCENT), `the PDF's date is not the accent (${pdfDate})`);
    assert.ok(near(wordInk(docx.xml, '2012'), pdfDate), `Word's date ${wordInk(docx.xml, '2012')} is the PDF's ${pdfDate}`);
    assert.ok(near(wordInk(docx.xml, 'Acmecorp'), await pdfInk(bytes, 'Acmecorp')), 'the company, under the role');
  });

  it('every field and every date, for a navy, the default and an unset Text colour', async () => {
    const wrong = [];
    for (const textColor of ['#1e3a8a', '#111111', '']) {
      for (const m of await mismatches({ textColor })) wrong.push(`${textColor || 'unset'} ${m}`);
    }
    assert.deepEqual(wrong, []);
  });

  it('Two columns keeps its own look: the main column\'s dates and second fields match Word too (guard)', async () => {
    const r = cv({ sidebarSingleColumn: false, textColor: '#1e3a8a' });
    const [bytes, docx] = [await render(r), await renderDocx(r)];
    const wrong = [];
    // The side column prints light on its dark panel, which Word has no panel for: its sections are left out.
    for (const word of ['Acmecorp', 'Stafflead', '2012', 'Awardgiver', '2008', 'Volorg', '2010', 'Customsub', '2015']) {
      const [pdf, docxInk] = [await pdfInk(bytes, word), wordInk(docx.xml, word)];
      if (!near(pdf, docxInk)) wrong.push(`${word}: pdf ${pdf} ≠ word ${docxInk}`);
    }
    assert.deepEqual(wrong, []);
  });
});
