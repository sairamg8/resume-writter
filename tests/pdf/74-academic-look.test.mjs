// T8 — the Academic template's own look (AcademicTemplatePDF.jsx): a scholarly CV — the type, header and
// spacing it brings when picked (TEMPLATES.academic.style: a serif, a centred header, titles at the
// body's size, a dense measure), the position under the name in italic, each section title in capitals
// in the accent over a full-width hairline, the institution under each entry in italic, the dates flush
// right in the Text grey, and pages that break cleanly. Read from the PDF itself: pdf.js text positions,
// fonts and the painted operator list. How it parses: 74-academic-ats; its letter, Word files and
// starter: 74-academic-letter.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allText, allItems, overlaps, drawState, loadModule, MM } from './harness.mjs';
import { paintedPages } from './banner-paint.mjs';

before(setup);
after(teardown);

const ACCENT = '#7f1d1d';
const PERSONAL = { name: 'Maya Okafor', title: 'Postdoctoral Research Fellow', email: 'maya@example.edu', phone: '+1 555 0171', summary: '<p>Studies gene-regulatory networks.</p>' };
/** An Academic résumé: the template's own defaults (createBlankResume), the accent, and `settings`. */
const academic = (sections, settings = {}, personal = {}) => resume({ template: 'academic', settings: { accentColor: ACCENT, ...settings }, sections, personal: { ...PERSONAL, ...personal } });
const first = (pages, str) => allItems(pages).find((i) => i.str.includes(str));

const JOB = { company: 'Broadview Institute', role: 'Research Fellow', location: 'Boston, MA', startDate: '07/2022', endDate: '', current: true, description: '<ul><li>Leads the single-cell network project.</li></ul>' };

/** Every section type, one entry each. */
const EVERY_TYPE = () => [
  section('education', [{ institution: 'Northeastern Institute', degree: 'Ph.D. Computational Biology', startDate: '09/2017', endDate: '05/2022' }]),
  section('custom', [{ title: 'Regulatory rewiring in haematopoiesis', subtitle: 'Nature Methods', date: '04/2024' }], {}, { title: 'Publications' }),
  experience([JOB]),
  section('projects', [{ name: 'scTrace', technologies: 'Python, R', url: 'github.com/x/sctrace', startDate: '01/2021', endDate: '06/2023', description: '<p>Lineage-aware clustering.</p>' }]),
  section('volunteering', [{ role: 'Outreach Mentor', org: 'Science Club', location: 'Boston, MA', startDate: '01/2019', endDate: '12/2020' }]),
  section('skills', [{ category: 'Computational', skills: 'Python, Julia' }]),
  section('languages', [{ language: 'Yoruba', proficiency: 'Native' }]),
  section('certifications', [{ name: 'Software Carpentry Instructor', issuer: 'The Carpentries', date: '05/2023' }]),
  section('awards', [{ title: 'Best Student Paper', issuer: 'RECOMB', date: '05/2021' }]),
  section('references', [{ name: 'Lena Hart', jobTitle: 'Professor', company: 'Northeastern Institute', email: 'l.hart@example.edu' }]),
  section('interests', [{ interests: 'Rowing, Choir' }]),
];
const FACTS = ['Northeastern Institute', 'Ph.D. Computational Biology', 'Regulatory rewiring in haematopoiesis', 'Nature Methods', 'Broadview Institute',
  'Research Fellow', 'Boston, MA', 'Leads the single-cell network project.', 'scTrace', 'Python, R', 'github.com/x/sctrace', 'Lineage-aware clustering.',
  'Outreach Mentor', 'Science Club', 'Python, Julia', 'Yoruba', 'Native', 'Software Carpentry Instructor', 'The Carpentries', 'Best Student Paper', 'RECOMB',
  'Lena Hart', 'l.hart@example.edu', 'Rowing', 'Choir'];
const TITLES = ['EDUCATION', 'PUBLICATIONS', 'PROFESSIONAL EXPERIENCE', 'PROJECTS', 'VOLUNTEERING', 'SKILLS', 'LANGUAGES', 'CERTIFICATIONS', 'AWARDS & HONORS', 'REFERENCES', 'INTERESTS'];

/** The fills in `colour` under the text item `t`: across the text column, their top within half its line under its baseline. */
const hairlinesUnder = (paints, colour, t, page) => paints.filter((p) => p.paint === 'fill' && p.colour === colour
  && p.x1 - p.x0 > page.W - 2 * 18 * MM - 1 && p.y1 <= t.y && t.y - p.y1 < t.h * 0.6);
/** The item that prints exactly `str`. */
const exactly = (pages, str) => allItems(pages).find((i) => i.str === str);

let online = null;
const isOnline = async () => {
  online ??= await fetch('https://cdn.jsdelivr.net/npm/@fontsource/source-serif-4@5/metadata.json', { signal: AbortSignal.timeout(5000) }).then((r) => r.ok, () => false);
  return online;
};

describe('Academic prints every section type (T8)', () => {
  it('every fact of every section type, every title over its hairline, no text overprinting another or off the paper', async () => {
    const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const bytes = await render(academic(EVERY_TYPE()));
    const pages = await read(bytes);
    assert.deepEqual(FACTS.filter((f) => !allText(pages).includes(f)), []);
    const paints = await paintedPages(bytes);
    for (const [k, page] of pages.entries()) {
      assert.deepEqual(overlaps(page), [], `page ${k + 1}`);
      for (const i of page.items) assert.ok(i.x >= 18 * MM - 0.5 && i.x + i.w <= page.W - 18 * MM + 0.5 && i.y > 0 && i.y < page.H, `${i.str}: inside the margins`);
    }
    for (const t of TITLES) {
      const k = pages.findIndex((p) => p.items.some((i) => i.str === t));
      assert.ok(k >= 0, `${t} printed whole, in capitals`);
      const title = pages[k].items.find((i) => i.str === t);
      assert.equal(hairlinesUnder(paints[k], solid(ACCENT, 0.55), title, pages[k]).length, 1, `${t}: one hairline under it, across the column`);
    }
  });
});

describe('its type and header: the serif, the centred name, the position in italic (T8)', () => {
  it('a new Academic résumé prints in Source Serif 4, where the font can be fetched', async (t) => {
    if (!(await isOnline())) return t.skip('offline: the serif falls back to Noto Sans');
    const pages = await read(await render(academic([experience([JOB])])));
    const fonts = new Set(allItems(pages).map((i) => i.font.replace(/^[A-Z]{6}\+/, '')));
    assert.ok([...fonts].every((f) => /^SourceSerif4/.test(f)), [...fonts].join(', '));
  });

  it('the name and position centred on the page, the position in italic in the Text grey; Left puts them on the margin', async () => {
    const { textShades } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const bytes = await render(academic([experience([JOB])], { font: 'notosans' }));
    const pages = await read(bytes);
    for (const s of [PERSONAL.name, PERSONAL.title, 'maya@example.edu']) {
      const i = first(pages, s);
      if (s !== 'maya@example.edu') assert.ok(Math.abs(i.x + i.w / 2 - pages[0].W / 2) < 0.5, `${s}: centred`);
    }
    assert.match(first(pages, PERSONAL.title).font, /Italic/, 'the position is italic');
    assert.doesNotMatch(first(pages, PERSONAL.name).font, /Italic/, 'the name is not');
    assert.deepEqual([...new Set((await drawState(bytes, PERSONAL.title)).map((h) => h.fill))], [textShades('#111111').sub], 'the position in the Text grey');
    const left = await read(await render(academic([experience([JOB])], { font: 'notosans', headerAlign: 'left' })));
    for (const s of [PERSONAL.name, PERSONAL.title]) assert.ok(Math.abs(first(left, s).x - 18 * MM) < 0.5, `${s}: on the left margin`);
  });

  it('its contacts keep Icon, as every template\'s (R3-003: Bar glues a value\'s words in the narrow-space fonts); Bar sets them as text', async () => {
    const own = allText(await read(await render(academic([experience([JOB])], { font: 'notosans' }))));
    assert.doesNotMatch(own, /maya@example\.edu \|/, own);
    const bar = allText(await read(await render(academic([experience([JOB])], { font: 'notosans', contactStyle: 'bar' }))));
    assert.match(bar, /maya@example\.edu \| \+1 555 0171/, bar);
  });
});

describe('section titles: capitals in the accent, at the body\'s size, over a hairline (T8)', () => {
  const heading = async (settings) => {
    const bytes = await render(academic([experience([JOB])], { font: 'notosans', ...settings }));
    const pages = await read(bytes);
    const t = pages[0].items.find((i) => /^professional experience$/i.test(i.str));
    return { bytes, pages, t, paints: (await paintedPages(bytes))[0] };
  };

  it('the title in the accent, bold, as tall as the body text; the hairline the accent at 55 %, the Border thickness tall', async () => {
    const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const { bytes, pages, t, paints } = await heading({});
    assert.equal(t.str, 'PROFESSIONAL EXPERIENCE');
    assert.match(t.font, /Bold/);
    assert.ok(Math.abs(t.h - first(pages, 'Leads the single-cell').h) < 0.05, `the title (${t.h}) at the body's size`);
    assert.deepEqual([...new Set((await drawState(bytes, 'PROFESSIONAL EXPERIENCE')).map((h) => h.fill))], [ACCENT]);
    const [rule] = hairlinesUnder(paints, solid(ACCENT, 0.55), t, pages[0]);
    assert.ok(rule && Math.abs(rule.y1 - rule.y0 - 1) < 0.01, 'a 1 pt hairline at the default thickness');
    const thick = await heading({ sectionBorderWidth: 3 });
    const [three] = hairlinesUnder(thick.paints, solid(ACCENT, 0.55), thick.t, thick.pages[0]);
    assert.ok(three && Math.abs(three.y1 - three.y0 - 3) < 0.01, 'Border thickness 3: 3 pt');
  });

  it('Border color prints the hairline as picked; Title case Abc prints the title as typed; Section Title size sets its size', async () => {
    const picked = await heading({ sectionBorderColor: '#0f766e' });
    assert.equal(hairlinesUnder(picked.paints, '#0f766e', picked.t, picked.pages[0]).length, 1);
    assert.equal((await heading({ sectionTitleCase: 'normal' })).t.str, 'Professional Experience');
    const big = await heading({ fontSizeSectionDelta: 4 });
    assert.ok(Math.abs(big.t.h - (11 + 4)) < 0.3, `Section Title 15 pt: ${big.t.h}`);
  });
});

describe('entries: the position bold, the institution italic under it, the dates flush right in the Text grey (T8)', () => {
  it('a post leads with the position, its dates end at the right margin on that line; the institution is italic, its location flush right', async () => {
    const { textShades } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const bytes = await render(academic([experience([JOB])], { font: 'notosans' }));
    const pages = await read(bytes);
    const [role, company, date, loc] = ['Research Fellow', 'Broadview Institute', '07/2022 – Present', 'Boston, MA'].map((s) => exactly(pages, s));
    assert.ok(role.y > company.y, 'the position above the institution');
    assert.ok(Math.abs(date.y - role.y) < 1 && Math.abs(date.x + date.w - (pages[0].W - 18 * MM)) < 0.5, 'the dates flush right on the position\'s line');
    assert.ok(Math.abs(loc.y - company.y) < 1 && Math.abs(loc.x + loc.w - (pages[0].W - 18 * MM)) < 0.5, 'the location flush right on the institution\'s line');
    assert.match(company.font, /Italic/, 'the institution in italic');
    assert.doesNotMatch(role.font, /Italic/);
    assert.deepEqual([...new Set((await drawState(bytes, '07/2022')).map((h) => h.fill))], [textShades('#111111').sub], 'dates in the Text grey');
  });
});

describe('pages break cleanly: a long CV runs on, no title left at a page\'s foot, nothing past the margins (T8)', () => {
  const longJob = (k) => ({ ...JOB, company: `Institute ${k}`, description: `<ul>${Array.from({ length: 8 }, (_, i) => `<li>Result ${k}.${i}: a finding reported across two journals and three conferences.</li>`).join('')}</ul>` });
  it('three pages or more, each title followed on its page by its first entry, every line within the margins', async () => {
    const sections = [experience([1, 2, 3, 4, 5].map(longJob)), ...EVERY_TYPE(), experience([6, 7].map(longJob))];
    sections.at(-1).title = 'Teaching';
    const pages = await read(await render(academic(sections, { font: 'notosans' })));
    assert.ok(pages.length >= 3, `${pages.length} pages`);
    for (const [k, page] of pages.entries()) {
      assert.deepEqual(overlaps(page), [], `page ${k + 1}`);
      const bottom = Math.min(...page.items.map((i) => i.y));
      assert.ok(bottom > 14 * MM - 3, `page ${k + 1}: its last line (${bottom.toFixed(1)}) above the bottom margin`);
      const last = page.items.reduce((a, b) => (b.y < a.y ? b : a));
      assert.ok(!/^[A-Z &]+$/.test(last.str) || !TITLES.concat('TEACHING').includes(last.str), `page ${k + 1} ends with the title ${last.str}`);
    }
  });
});
