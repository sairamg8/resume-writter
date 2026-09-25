// R2-141: what the ATS Check says about how a parser reads the résumé is what the ATS battery reads
// from the app's own PDF. Each claim is set beside the readers that back it — pdf.js (its lines, as
// ats-fields.mjs rebuilds them, and its drawing order) and Poppler's pdftotext in its three modes —
// scored by the battery's own models (ats-fields.mjs: the fields a parser files; ats-parse.mjs: every
// fact whole, every entry contiguous):
//   - the template verdict: a pass says pdf.js and Poppler read one column top to bottom, each job
//     with its title, company and dates — on every template, and on the Sidebar's Single · ATS-safe;
//     the two-column Sidebar's warning says Poppler can part a job from its dates while pdf.js reads
//     each column whole. It used to promise "100% sequential parsing on Workday, Taleo, and
//     Greenhouse", and that "modern AI parsers handle sidebars": nothing tests either;
//   - the side-by-side warning (Section Options → Grids 2, R2-021): Poppler's layout mode reads
//     across the row and interleaves the jobs, and Grids 1 does not;
//   - the LinkedIn item: a Display label prints instead of the address, no reader finds a profile,
//     and the item now warns where it passed.
// Contact Details → Layout "2 Grid" is printed as each reader reads it (diagnostics), beside the
// "Multi-column contact header" verdict.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, read, render, loadModule, resume, section, allText, TEMPLATES } from './harness.mjs';
import { hasPdftotext, pdftotext } from './extractors.mjs';
import { truthFields, scoreFields, fieldProblems, pdfjsLineText, extractContacts } from './ats-fields.mjs';
import { truthBlocks, score, problems } from './ats-parse.mjs';

before(setup);
after(teardown);

const NO_POPPLER = !hasPdftotext && 'pdftotext is not installed';

/** The demo résumé of `template`, its settings and personal info overridden. */
async function demo(template, settings = {}, personal = {}) {
  const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
  const r = structuredClone(DEMO_RESUMES.find((x) => x.template === template));
  r.settings = { ...r.settings, ...settings };
  r.personal = { ...r.personal, ...personal };
  return r;
}

/** The ATS Check's report on `r`. */
async function report(r) {
  const { analyzeAtsScore } = await loadModule('/src/utils/atsChecker.js');
  return analyzeAtsScore(r);
}
const item = async (r, category, id) => (await report(r)).categories[category].items.find((i) => i.id === id);

/** Every line-structured reader the field battery runs (42-ats-fields): pdf.js lines and each Poppler mode. */
async function fieldReaders(bytes) {
  return [['pdf.js lines', pdfjsLineText(await read(bytes))], ...pdftotext(bytes)];
}

/**
 * Every field reader's problems, less ATS-7 — a known limit (accepted 2026-09-24): under `pdftotext -raw`
 * a heading that opens a page joins the last line of the page before, so a line-only parser loses it.
 * As 42-ats-fields does, a header loss is set aside only when reading the form feed as a line break
 * recovers every header; it is reported, and any other loss still fails.
 */
async function fieldProblemsOf(bytes, truth, t) {
  const found = [];
  for (const [n, text] of await fieldReaders(bytes)) {
    const pageTop = String(text).includes('\f')
      && !fieldProblems(n, scoreFields(truth, String(text).replace(/\f/g, '\n'))).some((p) => /section header/.test(p));
    for (const p of fieldProblems(n, scoreFields(truth, text))) {
      if (pageTop && p.endsWith('section header(s) undetected')) t.diagnostic(`ATS-7 (known limit): ${p} — a heading opens a page`);
      else found.push(p);
    }
  }
  return found;
}

const STATES = [...TEMPLATES.map((t) => [t, {}]), ['sidebar', { sidebarSingleColumn: true }]];
const label = (t, s) => `${t}${s.sidebarSingleColumn ? ' (Single · ATS-safe)' : ''}`;

describe('the template verdict says what pdf.js and Poppler read (R2-141)', () => {
  for (const [template, settings] of STATES.filter(([t, s]) => t !== 'sidebar' || s.sidebarSingleColumn)) {
    it(`${label(template, settings)}: it passes, and every reader recovers every field`, { skip: NO_POPPLER }, async (t) => {
      const r = await demo(template, settings);
      const verdict = await item(r, 'layout', 'template');
      assert.equal(verdict.status, 'pass');
      const { atsRating } = await loadModule('/src/constants/templates.js');
      // A template's own note (Compact's grid) is its reason; every other pass names the readers.
      if (!atsRating(template, settings).note) {
        assert.match(verdict.detail, /pdf\.js and Poppler's pdftotext read it/);
        assert.doesNotMatch(verdict.detail, /Workday|Taleo|Greenhouse|100%/, 'no parser the battery does not run');
      }
      const truth = truthFields(r);
      assert.deepEqual(await fieldProblemsOf(await render(r), truth, t), []);
    });
  }

  it('sidebar (two columns): it warns that Poppler can part a job from its dates and pdf.js reads each column whole — and they do', { skip: NO_POPPLER }, async (t) => {
    const r = await demo('sidebar');
    const verdict = await item(r, 'layout', 'template');
    assert.equal(verdict.status, 'warn');
    assert.match(verdict.detail, /Poppler's pdftotext does, can mix the two columns' lines and part a job from its dates/);
    assert.match(verdict.detail, /pdf\.js reads each column whole/);
    assert.doesNotMatch(verdict.detail, /AI parsers|Workday|Taleo/);
    const bytes = await render(r);
    const truth = truthFields(r);
    const poppler = pdftotext(bytes).filter(([n]) => !n.includes('-raw'));
    const jobs = poppler.map(([n, text]) => [n, scoreFields(truth, text).experience]);
    for (const [n, e] of jobs) t.diagnostic(`${n}: ${e.recovered}/${e.total} jobs whole, ${e.dateAttached}/${e.total} dates by their job`);
    assert.ok(jobs.some(([, e]) => e.recovered < e.total || e.dateAttached < e.total), 'a Poppler reader parts a job from its title, company or dates');
    // Drawing order: each column contiguous, every fact whole.
    assert.deepEqual(problems('pdf.js', score(truthBlocks(r), allText(await read(bytes)))), []);
  });
});

describe('the side-by-side warning says what Poppler\'s layout mode reads (R2-021, R2-141)', () => {
  const JOBS = [
    { company: 'Northwind Traders', role: 'Staff Engineer', location: 'Austin, TX', startDate: '03/2021', endDate: '', current: true,
      description: '<ul><li>Rebuilt the checkout flow for two million customers.</li><li>Cut the release cycle from weeks to days.</li></ul>' },
    { company: 'Fabrikam Studio', role: 'Web Developer', location: 'Dallas, TX', startDate: '06/2017', endDate: '02/2021',
      description: '<ul><li>Replaced the legacy storefront with reusable components.</li><li>Shipped twenty marketing sites for retail clients.</li></ul>' },
  ];
  const grid = (columns) => resume({
    template: 'classic',
    personal: { name: 'Pat Sample', title: 'Engineer', email: 'pat@example.com', phone: '+1 555 0100' },
    sections: [section('experience', JOBS, { columns })],
  });
  /** The pairs of entries whose lines interleave under Poppler's layout mode. */
  const interleaved = async (r) => score(truthBlocks(r), pdftotext(await render(r)).find(([n]) => n.includes('-layout'))[1]).overlaps;

  it('Grids 2: it warns that the layout mode reads across the row — and the two jobs interleave there', { skip: NO_POPPLER }, async () => {
    const r = grid(2);
    const warning = await item(r, 'layout', 'section_grids');
    assert.equal(warning?.status, 'warn');
    assert.match(warning.detail, /Poppler's pdftotext, in its layout mode, reads the page line by line, across the row/);
    assert.doesNotMatch(warning.detail, /Workday|Taleo/);
    assert.equal((await interleaved(r)).length > 0, true, 'the two jobs\' lines interleave');
  });

  it('Grids 1: no warning, and the jobs read one after the other', { skip: NO_POPPLER }, async () => {
    const r = grid(1);
    assert.equal(await item(r, 'layout', 'section_grids'), undefined);
    assert.deepEqual(await interleaved(r), []);
  });
});

describe('the LinkedIn item passes only when the PDF prints the address a parser reads (R2-141)', () => {
  const PROFILE = 'linkedin.com/in/jordan-rivera-sample';
  /** Per reader: whether it pulls the profile's address out of the text, as the field battery's URL regex does. */
  const readersFind = async (r) => (await fieldReaders(await render(r)))
    .map(([n, text]) => [n, extractContacts(text).urls.some((u) => u.includes(PROFILE))]);

  for (const template of ['classic', 'modern', 'banner']) {
    it(`${template}: printed as its address it passes and every reader finds it; under a Display label it warns and none does`, { skip: NO_POPPLER }, async () => {
      const plain = await demo(template);
      assert.equal((await item(plain, 'contact', 'linkedin')).status, 'pass');
      assert.deepEqual((await readersFind(plain)).filter(([, ok]) => !ok), [], 'every reader finds the address');

      const labelled = await demo(template, {}, { linkedinLabel: 'LinkedIn', linkedinUrl: `https://www.${PROFILE}` });
      const verdict = await item(labelled, 'contact', 'linkedin');
      assert.equal(verdict.status, 'warn');
      assert.equal(verdict.text, 'LinkedIn prints as "LinkedIn", not its address');
      assert.deepEqual((await readersFind(labelled)).filter(([, ok]) => ok), [], 'no reader finds a profile address');
      const points = async (r) => (await report(r)).categories.contact.score;
      assert.equal(await points(labelled), (await points(plain)) - 1, 'half its points: a recruiter still has the link');
    });
  }

  it('a label that holds the address, or a Link URL override under a printed address, still passes', async () => {
    assert.equal((await item(await demo('classic', {}, { linkedinLabel: `LinkedIn: ${PROFILE}` }), 'contact', 'linkedin')).status, 'pass');
    assert.equal((await item(await demo('classic', {}, { linkedinUrl: `https://www.${PROFILE}/` }), 'contact', 'linkedin')).status, 'pass');
  });
});

describe('Contact Details → Layout "2 Grid": what each reader reads of the contacts (R2-141, diagnostics)', () => {
  for (const template of ['classic', 'minimal', 'executive']) {
    it(`${template}: the verdict, and each reader's contact fields`, { skip: NO_POPPLER }, async (t) => {
      const r = await demo(template, { contactLayout: '2grid' });
      const verdict = await item(r, 'layout', 'contact_layout');
      assert.equal(verdict.status, 'warn', 'AUD-27: the 2 Grid header warns');
      const truth = truthFields(r);
      for (const [n, text] of await fieldReaders(await render(r))) {
        const contactProblems = fieldProblems(n, scoreFields(truth, text)).filter((p) => /name|email|phone|link/.test(p));
        t.diagnostic(`${n}: ${contactProblems.length ? contactProblems.join('; ') : 'every contact field whole'} | ${JSON.stringify(text.split('\n').slice(0, 6).join(' / '))}`);
      }
    });
  }
});
