// T9 — how the Compact template parses. Its short rules are fills, not text; its experience is one column,
// so every reader extracts the header as name → title → contacts (the title on the name's line where it is
// picked), each section title whole, and each job as role → dates → company → location → its bullets,
// every field a run of its own — never the location or dates inside the title's run (ATS-1) — and an
// item-based parser's header (OpenResume's rules, ats-entry-header.mjs) holds the role, company and dates.
// Its grid of short sections is drawn cell by cell, so the readers that keep the content stream's order —
// pdf.js's items and pdftotext -raw — read the items one after another, each whole; the ones that rebuild
// lines by position put a row's two cells on one line, which is why it is rated good, not certified.
// What OpenResume itself makes of the demo was measured with its own code (qa-visual-compare/tools/
// or-runner): every job exact, as on Classic. The look: 76-compact-look; the rest: 76-compact-letter.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, read, render, renderDocx, loadModule } from './harness.mjs';
import { hasPdftotext, pdftotext } from './extractors.mjs';
import { pdfjsLineText } from './ats-fields.mjs';
import { lines, blocks, headerText } from './ats-entry-header.mjs';

before(setup);
after(teardown);

const OL = '<ol><li>Led the checkout rebuild.</li><li>Built the design system.</li></ol>';
const PARAS = '<p>Tech: React, Node.js</p><p>Shipped it.</p>';
const flat = (s) => s.replace(/\s+/g, ' ');

/** The Compact demo résumé, its jobs laid out with `settings` (none: the template's own) and described by `description`. */
async function demo(settings = {}, description = null, design = {}) {
  const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
  const r = structuredClone(DEMO_RESUMES.find((x) => x.template === 'compact'));
  r.settings = { ...r.settings, ...design };
  const exp = r.sections.find((s) => s.type === 'experience');
  const { titleStyle, ...rest } = exp.settings; // the fixture stores Stacked; unset takes the template's own
  void titleStyle;
  exp.settings = { ...rest, ...settings };
  if (description) exp.items.forEach((i) => { i.description = description; });
  const { dateRange, presentLabel } = await loadModule('/src/utils/dates.js');
  const jobs = exp.items.map((i) => ({ ...i, date: dateRange(i.startDate, i.current ? presentLabel(r.settings) : i.endDate, r.settings) }));
  return { r, jobs, title: exp.title };
}

/** Where each of `fields` first occurs in `text` at or after `from`, in order; -1 for one not found in order. */
function inOrder(text, fields, from = 0) {
  const at = [];
  let pos = from;
  for (const f of fields) {
    const i = text.indexOf(f, pos);
    at.push(i);
    if (i >= 0) pos = i + f.length;
  }
  return at;
}

/** Every reader's text: pdf.js items in stream order, pdf.js lines by position, and Poppler's modes. */
async function readers(bytes) {
  const pages = await read(bytes);
  return [['pdf.js items', pages.map((p) => p.items.map((i) => i.str).join('\n')).join('\n')], ['pdf.js lines', pdfjsLineText(pages)], ...pdftotext(bytes)];
}

describe('the header reads as text in order: name → title → contacts, then the summary (T9)', () => {
  for (const design of [{}, { headerLayout: 'stack' }, { headerAlign: 'center', showHeaderBorder: true }, { pageSize: 'letter', contactLayout: 'single' }]) {
    it(`${JSON.stringify(design)}`, async (t) => {
      if (!hasPdftotext) t.diagnostic('pdftotext not installed: pdf.js only');
      const { r } = await demo({}, null, design);
      const p = r.personal;
      const bad = [];
      for (const [name, text] of await readers(await render(r))) {
        const at = inOrder(text, [p.name, p.title, p.email, p.phone, p.location, 'Frontend engineer with 8+ years']);
        if (at.some((i) => i < 0)) bad.push(`${name}: header read out of order ${JSON.stringify(at)}`);
        for (const title of ['PROFESSIONAL EXPERIENCE', 'SKILLS', 'PROJECTS', 'EDUCATION', 'CERTIFICATIONS', 'LANGUAGES']) if (!text.includes(title)) bad.push(`${name}: ${title} not read whole`);
      }
      assert.deepEqual(bad, []);
    });
  }
});

describe('each job reads role → dates → company → location → its first bullet, in every reader (T9)', () => {
  for (const titleStyle of [undefined, 'stacked', 'sidebyside', 'inline']) {
    it(`Title ${titleStyle ?? 'unset (Stacked, role first)'}`, async (t) => {
      if (!hasPdftotext) t.diagnostic('pdftotext not installed: pdf.js only');
      const { r, jobs } = await demo(titleStyle ? { titleStyle } : {});
      const bad = [];
      for (const [name, text] of await readers(await render(r))) {
        let from = 0;
        for (const job of jobs) {
          const bullet = job.description.match(/<li>([^<]{12})/)[1];
          const at = inOrder(text, [job.role, job.date, job.company, job.location, bullet], from);
          // Inline and Side by side print the company on the role's line, before the dates.
          const alt = inOrder(text, [job.role, job.company, job.date, job.location, bullet], from);
          const ok = at.every((i) => i >= 0) ? at : alt;
          if (ok.some((i) => i < 0)) bad.push(`${name}: ${job.company} read out of order ${JSON.stringify(at)} / ${JSON.stringify(alt)}`);
          from = Math.max(from, ...ok);
        }
      }
      assert.deepEqual(bad, []);
    });
  }
});

describe('the role, company, dates and location are runs of their own (T9, ATS-1)', () => {
  for (const [titleStyle, own] of [[undefined, ['role', 'company', 'date', 'location']], ['sidebyside', ['role', 'company', 'date', 'location']], ['inline', ['date', 'location']]]) {
    it(`Title ${titleStyle ?? 'unset'}: ${own.join(', ')} each a run; no run holds the dates or location with another field`, async () => {
      const { r, jobs, title } = await demo(titleStyle ? { titleStyle } : {});
      // The entries' runs: from the section's title on (the header's contact line holds its own location).
      const all = lines(await read(await render(r)));
      const runs = all.slice(all.findIndex((l) => l.some((x) => x.text === title.toUpperCase()))).flat().map((x) => x.text);
      const bad = [];
      for (const job of jobs) {
        for (const field of own) if (!runs.includes(job[field])) bad.push(`${job.company}: ${field} "${job[field]}" is not a run of its own`);
        for (const field of ['date', 'location']) {
          const glued = runs.filter((x) => x.includes(job[field]) && x !== job[field]);
          if (glued.length) bad.push(`${job.company}: ${field} glued into ${JSON.stringify(glued)}`);
        }
      }
      assert.deepEqual(bad, []);
    });
  }
});

/** Per job: the header an item-based parser reads (ats-entry-header.mjs), or why it is not found. */
async function headers(r, jobs, title) {
  const found = blocks(lines(await read(await render(r))), jobs.map((j) => j.role), { after: title });
  return jobs.map((job, k) => (found[k] ? headerText(found[k], 2) : `${job.role}: entry not found`));
}
const missing = (hs, jobs, fields) => jobs.flatMap((job, k) => fields.filter((f) => !hs[k].includes(job[f])).map((f) => `${job.role}: ${f} not in [${hs[k]}]`));

describe('an item-based parser\'s header holds the role, company, dates and location (T9, OpenResume\'s rules)', () => {
  for (const [label, description] of [['bullets', null], ['a numbered list', OL], ['paragraphs', PARAS]]) {
    it(`unset (Stacked, role first): ${label}`, async () => {
      const { r, jobs, title } = await demo({}, description);
      assert.deepEqual(missing(await headers(r, jobs, title), jobs, ['role', 'company', 'date', 'location']), []);
    });
  }
});

describe('the grid reads item by item in the stream-order readers: pdf.js items and pdftotext -raw (T9)', () => {
  it('each skill group, certification and language whole, in the résumé\'s order', async (t) => {
    if (!hasPdftotext) t.diagnostic('pdftotext not installed: pdf.js only');
    const { r } = await demo();
    const { dateRange } = await loadModule('/src/utils/dates.js');
    const of = (type) => r.sections.find((s) => s.type === type).items;
    const want = [
      ...of('skills').map((k) => `${k.category}: ${k.skills}`),
      ...of('certifications').map((c) => `${c.name} — ${c.issuer} ${dateRange(c.date, c.expiry, r.settings)}`),
      ...of('languages').map((l) => `${l.language} ${l.proficiency}`),
    ];
    const [items, , , raw] = await readers(await render(r));
    const bad = [];
    for (const [name, text] of [items, raw].filter(Boolean)) {
      const at = inOrder(flat(text), want);
      if (at.some((i) => i < 0)) bad.push(`${name}: ${JSON.stringify(want.filter((_, k) => at[k] < 0))} not read whole in order`);
    }
    assert.deepEqual(bad, []);
  });

  it('the cells are laid out two to a row (the grid the readers above read cell by cell)', async () => {
    const { r } = await demo();
    const pages = await read(await render(r));
    const y = (s) => pages[0].items.find((i) => i.str === s)?.y;
    assert.ok(Math.abs(y('Languages:') - y('Frontend:')) < 1, 'Languages | Frontend on one row');
    assert.ok(Math.abs(y('English') - y('Spanish')) < 1, 'English | Spanish on one row');
  });
});

describe('Compact is rated good: one column of experience, a grid of short sections (T9)', () => {
  it('rated good, badged ATS-friendly in the picker; the ATS check names its grid and reads its role-first default', async () => {
    const { atsRating, TEMPLATE_PICKER } = await loadModule('/src/constants/templates.js');
    const rating = atsRating('compact');
    assert.deepEqual([rating.tier, rating.points, rating.safe], ['good', 4, true]);
    assert.equal(TEMPLATE_PICKER.find((t) => t.id === 'compact').ats, true);
    const { analyzeAtsScore } = await loadModule('/src/utils/atsChecker.js');
    const { r } = await demo();
    const report = analyzeAtsScore(r);
    const verdict = report.categories.layout.items.find((i) => i.id === 'template');
    assert.equal(verdict.status, 'pass');
    assert.match(verdict.detail, /two to a line/);
    assert.match(analyzeAtsScore({ ...r, template: 'modern' }).categories.layout.items.find((i) => i.id === 'template').detail, /header contrast/, 'Modern keeps its own reason');
    const order = (res) => res.categories.experience.items.find((i) => i.id === 'exp_title_order').status;
    assert.equal(order(report), 'pass', 'unset: the role leads, as the PDF prints it');
    const byCompany = structuredClone(r);
    byCompany.sections.find((s) => s.type === 'experience').settings.titleOrder = 'company';
    assert.equal(order(analyzeAtsScore(byCompany)), 'warn');
  });

  it('the Word résumé prints every job\'s role, company, location and dates, and every grid item', async () => {
    const { r, jobs } = await demo();
    const { texts } = await renderDocx(r);
    const all = texts.join('\n');
    const bad = jobs.flatMap((j) => ['role', 'company', 'location', 'date'].filter((f) => !all.includes(j[f])).map((f) => `${j.company}: ${f}`));
    for (const k of r.sections.find((s) => s.type === 'skills').items) if (!all.includes(k.skills)) bad.push(`skills: ${k.category}`);
    assert.deepEqual(bad, []);
  });
});
