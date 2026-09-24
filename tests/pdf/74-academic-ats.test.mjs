// T8 — how the Academic template parses. Its hairlines are fills, not text, and its small capitals are
// capitals of one size (a second, smaller size would split each title into two words in pdf.js and
// Poppler), so every reader extracts the header as name → position → contacts, each section title
// whole, and each post as position → dates → institution → location → its bullets, every field a run
// of its own — never the location or dates inside the title's run (ATS-1) — and an item-based parser's
// header (OpenResume's rules, ats-entry-header.mjs) holds the position, institution and dates. Readers:
// pdf.js (items, and lines rebuilt by position) and Poppler's three pdftotext modes. What OpenResume
// itself makes of the demo was measured with its own code (qa-visual-compare/tools/or-runner). The
// look: 74-academic-look; the letter, Word files and starter: 74-academic-letter.
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

/** The Academic demo résumé, its jobs laid out with `settings` (none: the template's own) and described by `description`. */
async function demo(settings = {}, description = null, design = {}) {
  const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
  const r = structuredClone(DEMO_RESUMES.find((x) => x.template === 'academic'));
  r.settings = { ...r.settings, ...design };
  const exp = r.sections.find((s) => s.type === 'experience');
  const { titleStyle, ...rest } = exp.settings; // the fixture stores Stacked; unset takes the template's own
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

describe('the header reads as text in order: name → position → contacts, then the summary (T8)', () => {
  for (const design of [{}, { headerAlign: 'left', contactStyle: 'icon' }, { headerLayout: 'inline', showHeaderBorder: true }]) {
    it(`${JSON.stringify(design)}`, async (t) => {
      if (!hasPdftotext) t.diagnostic('pdftotext not installed: pdf.js only');
      const { r } = await demo({}, null, design);
      const p = r.personal;
      const bad = [];
      for (const [name, text] of await readers(await render(r))) {
        const at = inOrder(text, [p.name, p.title, p.email, p.phone, p.location, 'Frontend engineer with 8+ years']);
        if (at.some((i) => i < 0)) bad.push(`${name}: header read out of order ${JSON.stringify(at)}`);
        for (const title of ['EDUCATION', 'PUBLICATIONS', 'PROFESSIONAL EXPERIENCE']) if (!text.includes(title)) bad.push(`${name}: ${title} not read whole`);
      }
      assert.deepEqual(bad, []);
    });
  }
});

describe('each post reads position → dates → institution → location → its first bullet, in every reader (T8)', () => {
  for (const titleStyle of [undefined, 'stacked', 'sidebyside', 'inline']) {
    it(`Title ${titleStyle ?? 'unset (Stacked, position first)'}`, async (t) => {
      if (!hasPdftotext) t.diagnostic('pdftotext not installed: pdf.js only');
      const { r, jobs } = await demo(titleStyle ? { titleStyle } : {});
      const bad = [];
      for (const [name, text] of await readers(await render(r))) {
        let from = 0;
        for (const job of jobs) {
          const bullet = job.description.match(/<li>([^<]{12})/)[1];
          const at = inOrder(text, [job.role, job.date, job.company, job.location, bullet], from);
          // Inline and Side by side print the institution on the position's line, before the dates.
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

describe('the position, institution, dates and location are runs of their own (T8, ATS-1)', () => {
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

describe('an item-based parser\'s header holds the position, institution, dates and location (T8, OpenResume\'s rules)', () => {
  for (const [label, description] of [['bullets', null], ['a numbered list', OL], ['paragraphs', PARAS]]) {
    it(`unset (Stacked, position first): ${label}`, async () => {
      const { r, jobs, title } = await demo({}, description);
      assert.deepEqual(missing(await headers(r, jobs, title), jobs, ['role', 'company', 'date', 'location']), []);
    });
  }
});

describe('the publications read whole: title, then venue and date (either order: the date is a right-hand column), then the note (T8)', () => {
  it('every reader', async () => {
    const { r } = await demo();
    const { formatDate } = await loadModule('/src/utils/dates.js');
    const pubs = r.sections.find((s) => s.id === 'publications').items;
    const bad = [];
    for (const [name, text] of await readers(await render(r))) {
      for (const p of pubs) {
        const note = p.description.replace(/<[^>]+>/g, '').slice(0, 20);
        const date = formatDate(p.date, r.settings);
        const orders = [[p.title, date, p.subtitle, note], [p.title, p.subtitle, date, note]];
        if (orders.every((o) => inOrder(text, o).some((i) => i < 0))) bad.push(`${name}: ${p.title}`);
      }
    }
    assert.deepEqual(bad, []);
  });
});

describe('Academic registers as one column on the white page (T8)', () => {
  it('rated certified, as Classic: badged ATS-friendly in the picker; the ATS check reads its position-first default', async () => {
    const { atsRating, TEMPLATE_PICKER } = await loadModule('/src/constants/templates.js');
    assert.deepEqual(atsRating('academic'), { tier: 'certified', points: 5, safe: true });
    assert.equal(TEMPLATE_PICKER.find((t) => t.id === 'academic').ats, true);
    const { analyzeAtsScore } = await loadModule('/src/utils/atsChecker.js');
    const { r } = await demo();
    const order = (res) => analyzeAtsScore(res).categories.experience.items.find((i) => i.id === 'exp_title_order').status;
    assert.equal(order(r), 'pass', 'unset: the position leads, as the PDF prints it');
    const byCompany = structuredClone(r);
    byCompany.sections.find((s) => s.type === 'experience').settings.titleOrder = 'company';
    assert.equal(order(byCompany), 'warn');
  });

  it('the Word résumé prints every post\'s position, institution, location and dates', async () => {
    const { r, jobs } = await demo();
    const { texts } = await renderDocx(r);
    const all = texts.join('\n');
    const bad = jobs.flatMap((j) => ['role', 'company', 'location', 'date'].filter((f) => !all.includes(j[f])).map((f) => `${j.company}: ${f}`));
    assert.deepEqual(bad, []);
  });
});
