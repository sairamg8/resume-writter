// "Parses 100%": what an applicant-tracking system's text stage sees. Every template's sample résumé and a
// stress résumé (accents, C++/C#/.NET, R&D, dashes, long contacts, hyphenated compounds, ligature words)
// go through independent extractors — pdf.js and Poppler's pdftotext in reading-order, -raw and -layout
// modes — and are scored against the résumé's own data (tests/pdf/ats-parse.mjs): every fact whole, every
// entry contiguous, no garbage characters, no glued or letter-spaced words. Vendor parsers are closed;
// Greenhouse documents what breaks its parser (columns, header/footer contacts, letter-spaced words, images,
// unclear sections) and these checks cover the text stage all of them start with.
//
// Known limits are `todo`, not silent: they print in every run until they are fixed or accepted.
//   • Poppler's -raw mode splits words by geometry, not by the space glyphs that are there, so a font with
//     a narrow space (Lato, Source Sans 3, Literata) — or a line textkit closes up — reads glued.
//   • The Sidebar template's styled two columns interleave under Poppler's reading-order and -layout
//     modes; its Layout → "Single · ATS-safe" toggle collapses it to one linear column that parses whole.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, loadModule, TEMPLATES } from './harness.mjs';
import { hasPdftotext, pdftotext } from './extractors.mjs';
import { truthBlocks, readers, score, problems } from './ats-parse.mjs';

before(setup);
after(teardown);

const SINGLE_COLUMN = TEMPLATES.filter((t) => t !== 'sidebar');
const GOOD = (name) => name === 'pdf.js' || name === 'pdftotext (reading order)' || name === 'pdftotext -layout';

/** The résumé with accents, symbols and long contacts every template has to carry. */
function stress(template) {
  return resume({
    template,
    personal: {
      name: 'José Ángel Núñez-Ramírez', title: 'Staff Software Engineer, Platform & Data',
      email: 'jose.angel.nunez-ramirez@examplecompany.com', phone: '+34 (91) 555 0142', location: 'São Paulo, BR',
      website: 'josenunez-portfolio.example.com', linkedin: 'linkedin.com/in/jose-angel-nunez-ramirez', github: 'github.com/jose-angel-nunez',
      summary: '<p>Engineer with 12+ years in C++, C# and .NET. Owned R&D for a cross-functional, real-time platform: 99.99% uptime, $1.2M yearly savings, and a first-class office workflow.</p>',
    },
    sections: [
      experience([
        { company: 'Wide World Importers & Sons Ltd.', role: 'Staff Engineer', location: 'Madrid, ES', startDate: '03/2021', endDate: '', current: true,
          description: '<ul><li>Built an end-to-end, low-latency pipeline in C++ and Node.js — 40% faster, 18% cheaper.</li><li>Ran the staff-level design review and the "design-first" proposal process for six teams.</li><li>Cut the difficult, official waffle-iron firmware build from 25 min to 4 min.</li></ul>' },
        { company: 'Contoso Bank LLC', role: 'Senior Engineer', location: 'Barcelona, ES', startDate: '06/2017', endDate: '02/2021',
          description: '<ul><li>Shipped A/B testing and CI/CD tooling used by 2M+ customers across Europe.</li><li>Wrote the on-call runbook adopted company-wide; efficient incident response cut MTTR by a third.</li></ul>' },
      ]),
      section('skills', [
        { category: 'Languages', skills: 'C++, C#, .NET, TypeScript, SQL' },
        { category: 'Practices', skills: 'CI/CD, A/B Testing, R&D, Agile / Scrum' },
      ], { skillsStyle: 'inline', separator: 'colon' }),
      section('education', [{ institution: 'Universidad Politécnica de Madrid', degree: 'M.Sc. Computer Science', fieldOfStudy: '', location: 'Madrid, ES', startDate: '09/2011', endDate: '06/2013', gpa: '3.9', description: '', bullets: [] }], { showLocation: false }),
      section('certifications', [{ name: 'AWS Certified Solutions Architect – Professional', issuer: 'Amazon Web Services', date: '05/2023', expiry: '', credentialId: '', url: '' }]),
    ],
  });
}

describe('the sample résumé of every template parses whole', () => {
  for (const template of TEMPLATES) {
    it(`${template}: pdf.js — every fact whole, entries contiguous, no garbage`, async () => {
      const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
      const r = DEMO_RESUMES.find((x) => x.template === template);
      const blocks = truthBlocks(r);
      const [name, text] = (await readers(await render(r)))[0];
      const s = score(blocks, text);
      // pdf.js reads in content order, so even the two-column Sidebar keeps each column contiguous.
      assert.deepEqual(problems(name, s), []);
    });
  }

  for (const template of SINGLE_COLUMN) {
    it(`${template}: Poppler reading order and -layout agree`, async (t) => {
      if (!hasPdftotext) { t.skip('pdftotext not installed'); return; }
      const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
      const r = DEMO_RESUMES.find((x) => x.template === template);
      const found = (await readers(await render(r))).filter(([n]) => GOOD(n)).flatMap(([n, text]) => problems(n, score(truthBlocks(r), text)));
      assert.deepEqual(found, []);
    });
  }
});

describe('the stress résumé parses whole in every template', () => {
  for (const template of TEMPLATES) {
    it(`${template}: accents, symbols, long contacts and ligature words survive pdf.js and Poppler`, async () => {
      const r = stress(template);
      const blocks = truthBlocks(r);
      const found = (await readers(await render(r)))
        // The Sidebar's two columns interleave under Poppler's layout-aware modes (see the todo below).
        .filter(([n]) => GOOD(n) && (template !== 'sidebar' || n === 'pdf.js'))
        .flatMap(([n, text]) => problems(n, score(blocks, text)));
      assert.deepEqual(found, []);
    });
  }
});

describe('the Sidebar ATS-safe single column reads whole in every parser', () => {
  // The Layout → "Single · ATS-safe" toggle (settings.sidebarSingleColumn) collapses the two-column
  // Sidebar to one linear column, so geometry-based extractors read it in order — no interleaving.
  const single = (r) => ({ ...r, settings: { ...r.settings, sidebarSingleColumn: true } });

  it('sample résumé: parses whole under pdf.js and Poppler reading-order + -layout', async (t) => {
    if (!hasPdftotext) { t.skip('pdftotext not installed'); return; }
    const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
    const r = single(DEMO_RESUMES.find((x) => x.template === 'sidebar'));
    const found = (await readers(await render(r))).filter(([n]) => GOOD(n))
      .flatMap(([n, text]) => problems(n, score(truthBlocks(r), text)));
    assert.deepEqual(found, []);
  });

  it('stress résumé: accents, symbols and long contacts parse whole under pdf.js and Poppler', async (t) => {
    if (!hasPdftotext) { t.skip('pdftotext not installed'); return; }
    const r = single(stress('sidebar'));
    const found = (await readers(await render(r))).filter(([n]) => GOOD(n))
      .flatMap(([n, text]) => problems(n, score(truthBlocks(r), text)));
    assert.deepEqual(found, []);
  });
});

describe('known limits (todo: reported until fixed or accepted)', () => {
  it('Poppler -raw reads every template whole', { todo: "Poppler's -raw splits words by geometry: narrow-space fonts and lines textkit closes up read glued" }, async () => {
    const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
    const found = [];
    for (const r of DEMO_RESUMES) {
      const raw = pdftotext(await render(r)).find(([n]) => n.includes('-raw'));
      if (raw) found.push(...problems(`${r.template} ${raw[0]}`, score(truthBlocks(r), raw[1])));
    }
    assert.deepEqual(found, []);
  });

  it('the styled two-column Sidebar reads whole under Poppler reading order and -layout', { todo: 'two columns: Greenhouse lists columned layouts as a parsing risk; Poppler interleaves them. The ATS-safe fix is the single-column toggle (tested above), not tagged PDF, which react-pdf v4 cannot emit' }, async () => {
    const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
    const r = DEMO_RESUMES.find((x) => x.template === 'sidebar');
    const found = (await readers(await render(r))).filter(([n]) => GOOD(n) && n !== 'pdf.js').flatMap(([n, text]) => problems(n, score(truthBlocks(r), text)));
    assert.deepEqual(found, []);
  });
});

describe('the scorer itself fails on what it is there to catch', () => {
  const r = { personal: { name: 'Pat Lee', title: 'Engineer', email: 'pat@example.com', phone: '+1 555 0100', linkedin: 'linkedin.com/in/pat-lee-sample', summary: '' },
    sections: [{ id: 'exp', type: 'experience', title: 'Experience', items: [
      { role: 'Staff Engineer', company: 'Northwind Traders', location: 'Austin, TX', description: '<ul><li>Built the checkout flow for two million customers.</li></ul>' },
      { role: 'Web Developer', company: 'Fabrikam Studio', location: 'Dallas, TX', description: '<ul><li>Replaced the legacy codebase with reusable components.</li></ul>' },
    ] }] };
  const blocks = truthBlocks(r);
  const clean = 'Pat Lee Engineer pat@example.com +1 555 0100 linkedin.com/in/pat-lee-sample Experience Staff Engineer Northwind Traders Austin, TX Built the checkout flow for two million customers. Web Developer Fabrikam Studio Dallas, TX Replaced the legacy codebase with reusable components.';

  it('passes clean text', () => assert.deepEqual(problems('clean', score(blocks, clean)), []));
  it('flags a wrapped profile link', () => assert.match(problems('x', score(blocks, clean.replace('pat-lee-sample', 'pat-lee- sample'))).join(), /fact\(s\) lost/));
  it('flags words run together', () => {
    const glued = clean.replace('Built the checkout flow for two million customers.', 'Builtthecheckoutflowfortwomillioncustomers.');
    const found = problems('x', score(blocks, glued)).join();
    assert.match(found, /lost/);
    assert.match(found, /glued/);
  });
  it('flags a control character where a ligature was', () => assert.match(problems('x', score(blocks, clean.replace('Staff', 'Sta' + String.fromCharCode(0x1f)))).join(), /garbage/));
  it('flags letter-spaced capitals', () => assert.match(problems('x', score(blocks, `${clean} E X P E R I E N C E`)).join(), /letter-spaced/));
  it('flags two entries whose lines interleave', () => {
    const mixed = 'Pat Lee Engineer pat@example.com Staff Engineer Northwind Traders Web Developer Fabrikam Studio Built the checkout flow for two million customers. Replaced the legacy codebase with reusable components.';
    assert.match(problems('x', score(blocks, mixed)).join(), /interleaved/);
  });
});
