// T6 — how the Timeline template's entries parse. Its date prints ABOVE the title (a bold accent label
// over "Role  Company"), so the text every reader extracts runs date → role → company → location →
// bullets for each job, each field a run of its own — never the location or date inside the title's run
// (ATS-1) — and an item-based parser's header (OpenResume's rules, ats-entry-header.mjs) holds the date,
// the role and the company. Readers: pdf.js (items, and lines rebuilt by position) and Poppler's three
// pdftotext modes. What OpenResume itself makes of it was measured with its own code
// (qa-visual-compare/tools/or-runner; PdfTimeline.jsx's header records the result). The look: 67-timeline-look.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, read, render, renderDocx, loadModule } from './harness.mjs';
import { hasPdftotext, pdftotext } from './extractors.mjs';
import { pdfjsLineText } from './ats-fields.mjs';
import { lines, blocks, headerText, allRuns, BULLETS } from './ats-entry-header.mjs';

before(setup);
after(teardown);

const OL = '<ol><li>Led the checkout rebuild.</li><li>Built the design system.</li></ol>';
const PARAS = '<p>Tech: React, Node.js</p><p>Shipped it.</p>';

/** The Timeline demo résumé, its jobs laid out with `settings` (none: the template's own) and described by `description`. */
async function demo(settings = {}, description = null) {
  const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
  const r = structuredClone(DEMO_RESUMES.find((x) => x.template === 'timeline'));
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

describe('each job reads date → role → company → location → its first bullet, in every reader (T6)', () => {
  for (const titleStyle of [undefined, 'stacked', 'sidebyside', 'inline']) {
    it(`Title ${titleStyle ?? 'unset (Side by side, role first)'}`, async (t) => {
      if (!hasPdftotext) t.diagnostic('pdftotext not installed: pdf.js only');
      const { r, jobs } = await demo(titleStyle ? { titleStyle } : {});
      const bad = [];
      for (const [name, text] of await readers(await render(r))) {
        let from = 0;
        for (const job of jobs) {
          const bullet = job.description.match(/<li>([^<]{12})/)[1];
          const at = inOrder(text, [job.date, job.role, job.company, job.location, bullet], from);
          if (at.some((i) => i < 0)) bad.push(`${name}: ${job.company} read out of order ${JSON.stringify(at)}`);
          from = Math.max(from, ...at);
        }
      }
      assert.deepEqual(bad, []);
    });
  }
});

describe('the date, role, company and location are runs of their own, as a parser merges them (T6, ATS-1)', () => {
  for (const [titleStyle, own] of [[undefined, ['date', 'role', 'company', 'location']], ['stacked', ['date', 'role', 'company', 'location']], ['sidebyside', ['date', 'role', 'company', 'location']], ['inline', ['date', 'location']]]) {
    it(`Title ${titleStyle ?? 'unset'}: ${own.join(', ')} each a run; no run holds the date or location with another field`, async () => {
      const { r, jobs } = await demo(titleStyle ? { titleStyle } : {});
      const runs = allRuns(await read(await render(r)));
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

  it('the dot is drawn, not text: no bullet glyph opens an entry\'s lines', async () => {
    const { r } = await demo();
    const heads = lines(await read(await render(r))).filter((l) => /\d{2}\/\d{4}/.test(l[0]?.text || ''));
    assert.ok(heads.length >= 3);
    for (const l of heads) assert.ok(!BULLETS.some((b) => l[0].text.startsWith(b)), JSON.stringify(l));
  });
});

/** Per job: the header an item-based parser reads (ats-entry-header.mjs), or why it is not found. */
async function headers(r, jobs, title) {
  const found = blocks(lines(await read(await render(r))), jobs.map((j) => j.role), { after: title });
  return jobs.map((job, k) => (found[k] ? headerText(found[k], 2) : `${job.role}: entry not found`));
}
const missing = (hs, jobs, fields) => jobs.flatMap((job, k) => fields.filter((f) => !hs[k].includes(job[f])).map((f) => `${job.role}: ${f} not in [${hs[k]}]`));

describe('an item-based parser\'s header holds the date, role and company (T6, OpenResume\'s rules)', () => {
  for (const [label, description] of [['bullets', null], ['a numbered list', OL], ['paragraphs', PARAS]]) {
    it(`unset (Side by side): ${label}`, async () => {
      const { r, jobs, title } = await demo({}, description);
      assert.deepEqual(missing(await headers(r, jobs, title), jobs, ['date', 'role', 'company']), []);
    });
  }

  it('Stacked, bullets: date, role, company and location', async () => {
    const { r, jobs, title } = await demo({ titleStyle: 'stacked' });
    assert.deepEqual(missing(await headers(r, jobs, title), jobs, ['date', 'role', 'company', 'location']), []);
  });

  it('Stacked, paragraphs: the company on line 3 is past the 2 lines a parser gives a job with no bullets', {
    todo: 'T6, accepted: Stacked sets date, role and company on three lines, so with no bullet glyph and no line of 8+ words OpenResume\'s 2-line header ends before the company. The Timeline\'s jobs default to Side by side (role and company on line 2), which the tests above hold',
  }, async () => {
    const { r, jobs, title } = await demo({ titleStyle: 'stacked' }, PARAS);
    assert.deepEqual(missing(await headers(r, jobs, title), jobs, ['date', 'role', 'company']), []);
  });
});

describe('a project\'s header holds its date and name (T6)', () => {
  /** The demo's projects described by `description`: per project, what its parser header (1 line with no bullets) misses. */
  async function projectHeaders(description) {
    const { r } = await demo();
    const proj = r.sections.find((s) => s.type === 'projects');
    proj.items.forEach((i) => { i.description = description; });
    const { dateRange } = await loadModule('/src/utils/dates.js');
    const found = blocks(lines(await read(await render(r))), proj.items.map((i) => i.name), { after: proj.title });
    return proj.items.flatMap((i, k) => {
      const h = found[k] ? headerText(found[k], 1) : '';
      return [i.name, dateRange(i.startDate, i.endDate, r.settings)].filter((f) => !h.includes(f)).map((f) => `${i.name}: ${f} not in [${h}]`);
    });
  }

  it('bullets: the header runs to the first bullet, date and name both in it', async () => {
    assert.deepEqual(await projectHeaders('<ul><li>Offline-first recipe manager.</li></ul>'), []);
  });

  it('a short paragraph: the name on line 2 is past the 1 line a parser gives a project with no bullets', {
    todo: 'T6, accepted: the Timeline sets a project\'s date above its name, and OpenResume reads a project with no bullet glyph and no line of 8+ words as a 1-line header — the date. A description of bullets, or a first line of 8+ words, keeps the name in it (above; measured with OpenResume on the demo)',
  }, async () => {
    assert.deepEqual(await projectHeaders('<p>Shipped it.</p>'), []);
  });
});

describe('Timeline registers as an ATS-safe single column (T6)', () => {
  it('rated certified, badged in the picker; the ATS check reads its role-first default', async () => {
    const { atsRating, TEMPLATE_PICKER } = await loadModule('/src/constants/templates.js');
    assert.deepEqual(atsRating('timeline'), { tier: 'certified', points: 5, safe: true });
    assert.equal(TEMPLATE_PICKER.find((t) => t.id === 'timeline').ats, true);
    const { analyzeAtsScore } = await loadModule('/src/utils/atsChecker.js');
    const { r } = await demo();
    const order = (res) => analyzeAtsScore(res).categories.experience.items.find((i) => i.id === 'exp_title_order').status;
    assert.equal(order(r), 'pass', 'unset: the role leads, as the PDF prints it');
    const byCompany = structuredClone(r);
    byCompany.sections.find((s) => s.type === 'experience').settings.titleOrder = 'company';
    assert.equal(order(byCompany), 'warn');
  });

  it('the Word résumé prints every job\'s role, company, location and dates', async () => {
    const { r, jobs } = await demo();
    const { texts } = await renderDocx(r);
    const all = texts.join('\n');
    const bad = jobs.flatMap((j) => ['role', 'company', 'location', 'date'].filter((f) => !all.includes(j[f])).map((f) => `${j.company}: ${f}`));
    assert.deepEqual(bad, []);
  });
});
