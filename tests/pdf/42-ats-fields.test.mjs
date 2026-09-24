// Field-level extraction: what an applicant-tracking system recovers from the extracted text, not
// just whether the text survived (that is 40-ats-parse). A real parser (Sovren, RChilli, Affinda,
// the open pyresparser/spaCy ones) has to turn the flat reading-order text into fields — the
// candidate's name, contacts, each job as a {title, company, dates} record, the section it sits in,
// and the skills — and a layout that survives extraction can still scramble that association. The
// model lives in ats-fields.mjs: contact regexes, first-line name detection, header synonyms for
// segmentation, and date-range anchoring for work history.
//
// Every single-column template imports as clean fields under pdf.js and Poppler. The two-column
// Sidebar degrades — dates detach from their job, the name stops being first, sections nest — which
// is why columns are the parsing risk every ATS guide warns about; its Layout → "Single · ATS-safe"
// toggle recovers every field. That degradation is asserted, not hidden, so the toggle earns its keep.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, read, render, loadModule, TEMPLATES } from './harness.mjs';
import { hasPdftotext, pdftotext } from './extractors.mjs';
import { truthFields, scoreFields, fieldProblems, extractName, pdfjsLineText } from './ats-fields.mjs';

before(setup);
after(teardown);

const SINGLE_COLUMN = TEMPLATES.filter((t) => t !== 'sidebar');

/** The readers a field parser sees, all line-structured: pdf.js (rebuilt) and every Poppler mode. */
async function readersForFields(bytes) {
  return [['pdf.js', pdfjsLineText(await read(bytes))], ...pdftotext(bytes)];
}

/**
 * Every reader's field problems, less one kind: ATS-7, a known limit (accepted): under `pdftotext -raw` a
 * heading that opens a page joins the last line of the page before ("…service.\fSKILLS"), so a line-only
 * parser loses it — 66-ats-page-top-heading holds that as a `todo`. Where a heading keeps with its first
 * entry, which heading opens a page depends on the résumé's length. A header loss is set aside only when
 * reading the form feed as a line break recovers every header; it is reported (t.diagnostic), not hidden,
 * and any other loss still fails.
 */
async function problemsOf(bytes, truth, t) {
  const found = [];
  for (const [n, text] of await readersForFields(bytes)) {
    const problems = fieldProblems(n, scoreFields(truth, text));
    const pageTop = String(text).includes('\f')
      && !fieldProblems(n, scoreFields(truth, String(text).replace(/\f/g, '\n'))).some((p) => /section header/.test(p));
    for (const p of problems) {
      if (pageTop && p.endsWith('section header(s) undetected')) t.diagnostic(`ATS-7 (known limit): ${p} — a heading opens a page`);
      else found.push(p);
    }
  }
  return found;
}

describe('every single-column template imports as clean fields', () => {
  for (const template of SINGLE_COLUMN) {
    it(`${template}: name, contacts, links, sections, every job (title+company+date) and skills`, async (t) => {
      if (!hasPdftotext) { t.skip('pdftotext not installed'); return; }
      const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
      const r = DEMO_RESUMES.find((x) => x.template === template);
      const truth = truthFields(r);
      assert.deepEqual(await problemsOf(await render(r), truth, t), []);
    });
  }
});

describe('the Sidebar ATS-safe single column imports as clean fields', () => {
  it('single-column mode recovers every field the two-column layout scrambles', async (t) => {
    if (!hasPdftotext) { t.skip('pdftotext not installed'); return; }
    const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
    const base = DEMO_RESUMES.find((x) => x.template === 'sidebar');
    const r = { ...base, settings: { ...base.settings, sidebarSingleColumn: true } };
    const truth = truthFields(r);
    assert.deepEqual(await problemsOf(await render(r), truth, t), []);
  });
});

describe('the field scorer detects the two-column parsing risk it is there to catch', () => {
  it('the styled two-column Sidebar scrambles the title↔company↔date association', async (t) => {
    if (!hasPdftotext) { t.skip('pdftotext not installed'); return; }
    const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
    const r = DEMO_RESUMES.find((x) => x.template === 'sidebar');
    const truth = truthFields(r);
    // At least one reader must fail to recover the work history whole — the columns' cost, and the
    // reason the ATS-safe single-column toggle (asserted above) exists.
    const anyDegraded = (await readersForFields(await render(r)))
      .some(([, text]) => scoreFields(truth, text).experience.recovered < truth.experience.length);
    assert.ok(anyDegraded, 'expected the two-column Sidebar to lose at least one job to column interleave');
  });
});

// The scorer's ground truth from a small résumé, and the text a parser would read from a clean PDF.
const R = {
  personal: { name: 'Pat Lee', title: 'Engineer', email: 'pat@example.com', phone: '+1 555 0100', linkedin: 'linkedin.com/in/pat-lee', hiddenFields: [] },
  sections: [
    { id: 'exp', type: 'experience', title: 'Experience', items: [
      { role: 'Staff Engineer', company: 'Northwind Traders', location: 'Austin, TX', startDate: '03/2021', endDate: '', current: true },
      { role: 'Web Developer', company: 'Fabrikam Studio', location: 'Dallas, TX', startDate: '06/2018', endDate: '02/2021' },
    ] },
    { id: 'sk', type: 'skills', title: 'Skills', items: [{ category: 'Languages', skills: 'TypeScript, SQL' }] },
  ],
};
const TRUTH = truthFields(R);
const CLEAN = [
  'Pat Lee',
  'Engineer',
  'pat@example.com  +1 555 0100  linkedin.com/in/pat-lee',
  'Experience',
  'Staff Engineer · Northwind Traders · Austin, TX    Mar 2021 – Present',
  '• Built the checkout flow for two million customers.',
  'Web Developer · Fabrikam Studio · Dallas, TX    Jun 2018 – Feb 2021',
  '• Replaced the legacy codebase.',
  'Skills',
  'Languages: TypeScript, SQL',
].join('\n');

describe('the field scorer itself fails on what it is there to catch', () => {
  it('passes clean, well-structured text', () => assert.deepEqual(fieldProblems('clean', scoreFields(TRUTH, CLEAN)), []));

  it('flags a name pushed below the top (parser grabs the first line)', () => {
    const text = `Curriculum Vitae\n${CLEAN}`;
    assert.match(fieldProblems('x', scoreFields(TRUTH, text)).join(), /name not first-line/);
  });

  it('flags an email broken by injected spaces', () => {
    const text = CLEAN.replace('pat@example.com', 'pat @ example.com');
    assert.match(fieldProblems('x', scoreFields(TRUTH, text)).join(), /email not extractable/);
  });

  it('flags a profile link wrapped mid-URL', () => {
    const text = CLEAN.replace('linkedin.com/in/pat-lee', 'linkedin.com/ in/pat-lee');
    assert.match(fieldProblems('x', scoreFields(TRUTH, text)).join(), /link\(s\) not whole/);
  });

  it('flags a section header glued to its body (undetected)', () => {
    const text = CLEAN.replace('Skills\nLanguages:', 'Languages:');
    assert.match(fieldProblems('x', scoreFields(TRUTH, text)).join(), /section header\(s\) undetected/);
  });

  it('flags a job whose date is detached from its title (column layout)', () => {
    const filler = ' lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor'.repeat(5);
    const text = CLEAN.replace(' · Austin, TX    Mar 2021 – Present', `${filler}\nMar 2021 – Present`);
    const p = fieldProblems('x', scoreFields(TRUTH, text)).join();
    assert.match(p, /date detached from the title|not recovered as title\+company\+date/);
  });

  it('flags two jobs read out of order', () => {
    const text = [
      'Pat Lee', 'Engineer', 'pat@example.com +1 555 0100 linkedin.com/in/pat-lee', 'Experience',
      'Web Developer · Fabrikam Studio · Dallas, TX    Jun 2018 – Feb 2021',
      'Staff Engineer · Northwind Traders · Austin, TX    Mar 2021 – Present',
      'Skills', 'Languages: TypeScript, SQL',
    ].join('\n');
    assert.match(fieldProblems('x', scoreFields(TRUTH, text)).join(), /read out of order/);
  });

  it('extractName reads a plain name line and rejects a contact line', () => {
    assert.equal(extractName(['Pat Lee', 'pat@example.com']), 'Pat Lee');
    assert.equal(extractName(['pat@example.com', '+1 555 0100']), null);
  });
});
