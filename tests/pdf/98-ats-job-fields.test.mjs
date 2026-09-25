// R2-141 (part 3): the ATS tab's per-job check — for each job the résumé prints, whether its title,
// company, dates and location come out of "What a parser reads" as fields a parser can file:
//   - 'own': a run of its own (parserText's rule 2: text set apart on a line is a field of its own);
//   - 'joined': inside a run with other text — a parser has to split it out;
//   - 'missing': in no run; and null where the job prints no such field (hidden, or empty).
// jobFields over made-up lines pins each outcome and that two jobs at one company are each read at
// their own place; over the app's own PDFs, Classic files every field of every job, and on every
// template no job's title or company is missing from the text (the field battery, 42-ats-fields,
// recovers each job's title and company there too). The panel shows one row per job, each field
// marked with its outcome. printedJobs (atsChecker) gives the jobs as they print: a hidden entry or a
// hidden field is not checked.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setup, teardown, render, loadModule, TEMPLATES } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

async function demo(template, settings = {}) {
  const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
  const r = structuredClone(DEMO_RESUMES.find((x) => x.template === template));
  r.settings = { ...r.settings, ...settings };
  return r;
}

async function checked(r) {
  const { readPdfLines, jobFields } = await loadModule('/src/utils/parserText.js');
  const { printedJobs } = await loadModule('/src/utils/atsChecker.js');
  const pages = await readPdfLines(await render(r), { lib: pdfjs });
  const jobs = printedJobs(r);
  return { jobs, fields: jobFields(pages, jobs) };
}

describe('jobFields: each field own, joined or missing (R2-141)', () => {
  it('a run of its own, a run shared with other text, no run, and no such field', async () => {
    const { jobFields } = await loadModule('/src/utils/parserText.js');
    const pages = [[
      ['Staff Engineer', '03/2021 – Present'],
      ['Northwind Traders | Austin, TX'],
      ['• Rebuilt the checkout flow.'],
    ]];
    const [f] = jobFields(pages, [{ role: 'Staff Engineer', company: 'Northwind Traders', location: 'Austin, TX', startDate: '2021-03', current: true }]);
    assert.deepEqual(f, { title: 'own', company: 'joined', dates: 'own', location: 'joined' });
    const [g] = jobFields(pages, [{ role: 'Staff Engineer', company: 'Contoso', location: '', startDate: '', endDate: '' }]);
    assert.deepEqual(g, { title: 'own', company: 'missing', dates: null, location: null });
    const [h] = jobFields([[['Staff Engineer, Northwind Traders, 2021 – 2023']]], [{ role: 'Staff Engineer', company: 'Northwind Traders', startDate: '2021', endDate: '2023' }]);
    assert.deepEqual([h.title, h.company, h.dates], ['joined', 'joined', 'joined']);
    assert.deepEqual(jobFields(undefined, undefined), []);
  });

  it('two jobs at one company: each is read at its own place', async () => {
    const { jobFields } = await loadModule('/src/utils/parserText.js');
    const pages = [[
      ['Senior Engineer', '2021 – Present'], ['Northwind Traders'], ['• Led the platform team.'],
      ['Engineer · 2018 – 2020'], ['Northwind Traders'], ['• Built the billing service.'],
    ]];
    const got = jobFields(pages, [
      { role: 'Senior Engineer', company: 'Northwind Traders', startDate: '2021', current: true },
      { role: 'Engineer', company: 'Northwind Traders', startDate: '2018', endDate: '2020' },
    ]);
    assert.deepEqual(got.map((f) => f.dates), ['own', 'joined'], 'the second job\'s dates share a run with its title');
  });
});

describe('jobFields over the app\'s PDFs (R2-141)', () => {
  it('Classic: every field of every job is a field of its own', async () => {
    const { jobs, fields } = await checked(await demo('classic'));
    assert.ok(jobs.length >= 3);
    for (const [i, f] of fields.entries()) {
      assert.deepEqual(f, { title: 'own', company: 'own', dates: 'own', location: 'own' }, `${jobs[i].role} @ ${jobs[i].company}`);
    }
  });

  for (const [template, settings] of [...TEMPLATES.map((t) => [t, {}]), ['sidebar', { sidebarSingleColumn: true }]]) {
    it(`${template}${settings.sidebarSingleColumn ? ' (Single · ATS-safe)' : ''}: no job's title or company is missing from the text`, async (t) => {
      const { jobs, fields } = await checked(await demo(template, settings));
      for (const [i, f] of fields.entries()) t.diagnostic(`${jobs[i].role} @ ${jobs[i].company}: ${JSON.stringify(f)}`);
      assert.deepEqual(fields.filter((f) => f.title === 'missing' || f.company === 'missing'), []);
    });
  }

  it('a hidden job is not checked, nor a job\'s hidden location', async () => {
    const r = await demo('classic');
    const exp = r.sections.find((s) => s.type === 'experience');
    exp.items[1].visible = false;
    exp.items[0].hiddenFields = ['location'];
    const { jobs, fields } = await checked(r);
    assert.equal(jobs.length, exp.items.length - 1);
    assert.equal(fields[0].location, null);
    assert.equal(fields[0].title, 'own');
  });
});

describe('the ATS tab shows each job\'s fields (R2-141)', () => {
  it('one row per job, each field marked with its outcome', async () => {
    const r = await demo('classic');
    const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
    const { _setPdfjsForTest } = await loadModule('/src/components/AtsParserView.jsx');
    _setPdfjsForTest({ lib: pdfjs });
    const view = mount(AtsCheckerPanel, { resume: r, store: {} });
    try {
      const all = () => [...elements(view.container)];
      const open = all().find((el) => el.tagName === 'BUTTON' && el.textContent.startsWith('What a parser reads'));
      view.act(() => reactProps(open).onClick());
      for (let i = 0; i < 600 && !all().some((el) => el.getAttribute('data-parser-status') === 'ready'); i += 1) {
        await new Promise((res) => { setTimeout(res, 50); });
      }
      const box = all().find((el) => el.getAttribute('data-parser-jobs') !== null);
      assert.ok(box, 'the per-job check is shown');
      const marks = [...elements(box)].filter((el) => el.getAttribute('data-field'));
      const jobs = r.sections.find((s) => s.type === 'experience').items;
      assert.equal(marks.length, jobs.length * 4, 'title, company, dates and location for each job');
      assert.deepEqual([...new Set(marks.map((el) => el.getAttribute('data-outcome')))], ['own']);
      assert.ok(box.textContent.includes(`${jobs[0].role} · ${jobs[0].company}`));
    } finally {
      await view.unmount();
      _setPdfjsForTest(null);
    }
  });
});
