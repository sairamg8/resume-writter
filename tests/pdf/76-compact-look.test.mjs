// T9 — the Compact template's own look (CompactTemplatePDF.jsx): a dense one-pager — the type and spacing
// it brings when picked (TEMPLATES.compact.style: 9 pt text, narrow margins, the title on the name's line,
// a one-page measure), each section title followed by a short rule on its own line (Line after on Compact,
// sectionHeadingLook's `short`), the short sections in a grid of whole items two to a row, the experience in
// one column with its dates flush right in the Text grey — and the demo on one page at A4 and Letter.
// Read from the PDF itself: pdf.js text positions, fonts and the painted operator list. How it parses:
// 76-compact-ats; its letter, Word files, the switch and its starter: 76-compact-letter.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allText, allItems, overlaps, drawState, loadModule, MM } from './harness.mjs';
import { paintedPages } from './banner-paint.mjs';

before(setup);
after(teardown);

const ACCENT = '#155e75';
const PERSONAL = { name: 'Priya Natarajan', title: 'Director of Platform Engineering', email: 'priya@example.com', phone: '+1 555 0188', summary: '<p>Runs platforms product teams trust.</p>' };
/** Compact's grid: a section as picking Compact leaves it (sectionsOnSwitch drops the Grids it was created with). */
const gridded = (s) => { const { columns, ...rest } = s.settings; void columns; return { ...s, settings: rest }; };
/** A Compact résumé: the template's own defaults (createBlankResume), the accent, and `settings`. */
const compact = (sections, settings = {}, personal = {}) => resume({ template: 'compact', settings: { accentColor: ACCENT, ...settings }, sections, personal: { ...PERSONAL, ...personal } });
const first = (pages, str) => allItems(pages).find((i) => i.str.includes(str));
const exactly = (pages, str) => allItems(pages).find((i) => i.str === str);

const JOB = { company: 'Harborline Logistics', role: 'Platform Director', location: 'Chicago, IL', startDate: '04/2021', endDate: '', current: true, description: '<ul><li>Leads seven platform teams.</li></ul>' };
const SKILLS = [{ category: 'Platform', skills: 'Kubernetes, Terraform' }, { category: 'Data', skills: 'Kafka, dbt' }, { category: 'Cloud', skills: 'AWS, GCP' }];

/** Every section type, one or two entries each, the short ones in Compact's grid. */
const EVERY_TYPE = () => [
  experience([JOB]),
  gridded(section('skills', SKILLS)),
  section('projects', [{ name: 'Fleetwatch', technologies: 'Go', url: 'github.com/x/fleetwatch', startDate: '01/2022', endDate: '06/2023', description: '<p>Capacity dashboards.</p>' }]),
  section('education', [{ institution: 'Lakeshore University', degree: 'M.S. Computer Science', startDate: '09/2007', endDate: '05/2009' }]),
  gridded(section('certifications', [{ name: 'Kubernetes Administrator', issuer: 'CNCF', date: '11/2020' }, { name: 'FinOps Practitioner', issuer: 'FinOps Foundation', date: '09/2021' }])),
  section('awards', [{ title: 'Leader of the Year', issuer: 'Harborline', date: '12/2023' }, { title: 'Summit Speaker', issuer: 'PlatformCon', date: '06/2022' }]),
  gridded(section('languages', [{ language: 'English', proficiency: 'Native' }, { language: 'Tamil', proficiency: 'Fluent' }])),
  section('volunteering', [{ role: 'Mentor', org: 'Code Club', location: 'Chicago, IL', startDate: '01/2019', endDate: '12/2020' }]),
  gridded(section('references', [{ name: 'Morgan Blake', jobTitle: 'CTO', company: 'Harborline', email: 'morgan@example.com' }, { name: 'Riley Chen', jobTitle: 'VP', company: 'Brightwater' }])),
  section('interests', [{ interests: 'Cycling, Chess' }]),
  section('custom', [{ title: 'Open Source Talk', subtitle: 'KubeCon', date: '02/2024' }], {}, { title: 'Talks' }),
];
const FACTS = ['Harborline Logistics', 'Platform Director', 'Chicago, IL', 'Leads seven platform teams.', 'Kubernetes, Terraform', 'Kafka, dbt', 'Fleetwatch',
  'github.com/x/fleetwatch', 'Capacity dashboards.', 'Lakeshore University', 'M.S. Computer Science', 'Kubernetes Administrator', 'FinOps Foundation',
  'Leader of the Year', 'PlatformCon', 'English', 'Native', 'Tamil', 'Mentor', 'Code Club', 'Morgan Blake', 'morgan@example.com', 'Riley Chen', 'Cycling', 'Chess',
  'Open Source Talk', 'KubeCon'];
const TITLES = ['PROFESSIONAL EXPERIENCE', 'SKILLS', 'PROJECTS', 'EDUCATION', 'CERTIFICATIONS', 'AWARDS & HONORS', 'LANGUAGES', 'VOLUNTEERING', 'REFERENCES', 'INTERESTS', 'TALKS'];

/** The fills in `colour` on the title `t`'s line, right of it: Compact's short rule. */
const rulesAfter = (paints, colour, t) => paints.filter((p) => p.paint === 'fill' && p.colour === colour
  && p.x0 > t.x + t.w && p.y0 > t.y - 1 && p.y1 < t.y + t.h);

describe('Compact prints every section type (T9)', () => {
  it('every fact inside its narrow margins, no run over another; every title in capitals with one short rule after it on its line', async () => {
    const bytes = await render(compact(EVERY_TYPE()));
    const pages = await read(bytes);
    assert.deepEqual(FACTS.filter((f) => !allText(pages).includes(f)), []);
    const paints = await paintedPages(bytes);
    for (const [k, page] of pages.entries()) {
      assert.deepEqual(overlaps(page), [], `page ${k + 1}`);
      for (const i of page.items) assert.ok(i.x >= 12 * MM - 0.5 && i.x + i.w <= page.W - 12 * MM + 0.5 && i.y > 10 * MM - 3 && i.y < page.H - 10 * MM, `${i.str}: inside the margins`);
    }
    for (const t of TITLES) {
      const k = pages.findIndex((p) => p.items.some((i) => i.str === t));
      assert.ok(k >= 0, `${t} printed whole, in capitals`);
      const title = pages[k].items.find((i) => i.str === t);
      const [rule, ...more] = rulesAfter(paints[k], ACCENT, title);
      assert.ok(rule && !more.length, `${t}: one rule after it`);
      assert.ok(Math.abs(rule.x1 - rule.x0 - 30) < 0.05 && rule.x0 - (title.x + title.w) < 9, `${t}: 30 pt long (3 × the 10 pt title), just after it`);
    }
  });
});

describe('its type and spacing: 9 pt text, narrow margins, the title on the name\'s line (T9)', () => {
  it('a new Compact résumé: body and entries at 9 pt, contacts 8.5 pt, titles 10 pt; the page 12 mm in at the sides and 10 mm from the top', async () => {
    const pages = await read(await render(compact([experience([JOB])])));
    assert.equal(first(pages, 'Leads seven').h, 9, 'the bullets at 9 pt');
    assert.equal(exactly(pages, 'Platform Director').h, 9, 'the entry title at 9 pt');
    assert.equal(first(pages, 'priya@example.com').h, 8.5, 'the contacts at 8.5 pt, the smallest text');
    assert.equal(exactly(pages, 'PROFESSIONAL EXPERIENCE').h, 10);
    assert.ok(Math.abs(exactly(pages, 'Platform Director').x - 12 * MM) < 0.5, 'the left margin 12 mm');
    const name = exactly(pages, PERSONAL.name);
    assert.ok(Math.abs(pages[0].H - (name.y + name.h) - 10 * MM) < 3, `the name under the 10 mm top margin (${(pages[0].H - name.y - name.h).toFixed(1)} pt)`);
  });

  it('the job title on the name\'s line after it, in the accent; Stack puts it under the name', async () => {
    const bytes = await render(compact([experience([JOB])]));
    const pages = await read(bytes);
    const [name, title] = [exactly(pages, PERSONAL.name), exactly(pages, PERSONAL.title)];
    assert.ok(Math.abs(name.y - title.y) < 2 && title.x > name.x + name.w, 'the title beside the name');
    assert.ok(first(pages, 'priya@example.com').y < title.y - 5, 'the contacts on the line under them');
    assert.deepEqual([...new Set((await drawState(bytes, PERSONAL.title)).map((h) => h.fill))], [ACCENT]);
    const stacked = await read(await render(compact([experience([JOB])], { headerLayout: 'stack' })));
    assert.ok(exactly(stacked, PERSONAL.title).y < exactly(stacked, PERSONAL.name).y - 10, 'Stack: under the name');
  });

  it('the demo fits one page at A4 and at Letter', async () => {
    const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
    const demo = DEMO_RESUMES.find((x) => x.template === 'compact');
    for (const pageSize of ['a4', 'letter']) {
      const pages = await read(await render({ ...demo, settings: { ...demo.settings, pageSize } }));
      assert.equal(pages.length, 1, `${pageSize}: ${pages.length} pages`);
      assert.deepEqual(overlaps(pages[0]), [], pageSize);
    }
  });
});

describe('section titles: an inline heading, the title and a short rule after it (T9)', () => {
  const heading = async (settings, sectionSettings = {}) => {
    const bytes = await render(compact([experience([JOB], sectionSettings)], settings));
    const pages = await read(bytes);
    const t = pages[0].items.find((i) => /^professional experience$/i.test(i.str));
    return { bytes, t, paints: (await paintedPages(bytes))[0] };
  };

  it('the title bold in the accent; the rule in the accent, as tall as Border thickness, in a picked Border color', async () => {
    const own = await heading({});
    assert.match(own.t.font, /Bold/);
    assert.deepEqual([...new Set((await drawState(own.bytes, 'PROFESSIONAL EXPERIENCE')).map((h) => h.fill))], [ACCENT]);
    const [rule] = rulesAfter(own.paints, ACCENT, own.t);
    assert.ok(rule && Math.abs(rule.y1 - rule.y0 - 1) < 0.01, 'a 1 pt rule at the default thickness');
    const thick = await heading({ sectionBorderWidth: 3 });
    const [three] = rulesAfter(thick.paints, ACCENT, thick.t);
    assert.ok(three && Math.abs(three.y1 - three.y0 - 3) < 0.01, 'Border thickness 3: 3 pt');
    const picked = await heading({ sectionBorderColor: '#b45309' });
    assert.equal(rulesAfter(picked.paints, '#b45309', picked.t).length, 1, 'Border color');
  });

  it('Title case Abc prints the title as typed, Section Title size sets it and the rule\'s length; a centred section has a rule each side', async () => {
    assert.equal((await heading({ sectionTitleCase: 'normal' })).t.str, 'Professional Experience');
    const big = await heading({ fontSizeSectionDelta: 5 });
    assert.equal(big.t.h, 14);
    const [long] = rulesAfter(big.paints, ACCENT, big.t);
    assert.ok(long && Math.abs(long.x1 - long.x0 - 42) < 0.05, 'the rule 3 × 14 pt');
    const centred = await heading({}, { alignment: 'center' });
    const sides = centred.paints.filter((p) => p.paint === 'fill' && p.colour === ACCENT && p.y0 > centred.t.y - 1 && p.y1 < centred.t.y + centred.t.h);
    assert.deepEqual(sides.map((p) => (p.x1 <= centred.t.x ? 'before' : p.x0 >= centred.t.x + centred.t.w ? 'after' : 'over')), ['before', 'after']);
  });

  it('Line after keeps its full-width rule on every other template (Classic)', async () => {
    const bytes = await render(resume({ template: 'classic', settings: { accentColor: ACCENT, headingStyle: 'line' }, sections: [experience([JOB])] }));
    const [page] = await read(bytes);
    const t = page.items.find((i) => i.str === 'PROFESSIONAL EXPERIENCE');
    const wide = (await paintedPages(bytes))[0].filter((p) => p.paint === 'fill' && p.x0 > t.x + t.w && p.y0 > t.y - 1 && p.y1 < t.y + t.h);
    assert.ok(wide.length === 1 && wide[0].x1 > page.W - 18 * MM - 1, 'to the column\'s end');
  });
});

describe('the short sections: a grid of whole items, two to a row (T9)', () => {
  const rowOf = (pages, a, b) => [exactly(pages, a), exactly(pages, b)];
  it('skill groups, certifications, languages and references side by side, each cell its label beside its item; Grids 1 stacks them', async () => {
    const pages = await read(await render(compact(EVERY_TYPE())));
    const half = 12 * MM + (pages[0].W - 24 * MM) * 0.52;
    for (const [a, b] of [['Platform:', 'Data:'], ['Kubernetes Administrator', 'FinOps Practitioner'], ['English', 'Tamil'], ['Morgan Blake', 'Riley Chen']]) {
      const [l, r] = rowOf(pages, a, b);
      assert.ok(l && r && Math.abs(l.y - r.y) < 1 && Math.abs(l.x - 12 * MM) < 6 && r.x > half - 6, `${a} | ${b}: one row, the second cell at the column's middle`);
    }
    const [cat, list] = [exactly(pages, 'Platform:'), exactly(pages, 'Kubernetes, Terraform')];
    assert.ok(Math.abs(cat.y - list.y) < 0.5 && list.x > cat.x + cat.w, 'the category label beside its skills');
    const [lang, level] = [exactly(pages, 'English'), exactly(pages, 'Native')];
    assert.ok(Math.abs(lang.y - level.y) < 0.5 && level.x - (lang.x + lang.w) < 10, 'the proficiency beside its language, not at the cell\'s far end');
    const one = await read(await render(compact([section('skills', SKILLS, { columns: 1 })])));
    const [p, d] = rowOf(one, 'Platform:', 'Data:');
    assert.ok(p.y - d.y > 8 && Math.abs(p.x - d.x) < 0.5, 'Grids 1: one group a line');
  });

  it('the experience stays one column: its role bold, dates flush right on its line in the Text grey, company and location under it', async () => {
    const { textShades } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const bytes = await render(compact([experience([JOB])]));
    const pages = await read(bytes);
    const [role, company, date, loc] = ['Platform Director', 'Harborline Logistics', '04/2021 – Present', 'Chicago, IL'].map((s) => exactly(pages, s));
    const right = pages[0].W - 12 * MM;
    assert.ok(role.y > company.y && /Bold/.test(role.font) && !/Bold/.test(company.font), 'the role, bold, above the company');
    assert.ok(Math.abs(date.y - role.y) < 1 && Math.abs(date.x + date.w - right) < 0.5, 'the dates flush right on the role\'s line');
    assert.ok(Math.abs(loc.y - company.y) < 1 && Math.abs(loc.x + loc.w - right) < 0.5, 'the location flush right on the company\'s line');
    assert.deepEqual([...new Set((await drawState(bytes, '04/2021')).map((h) => h.fill))], [textShades('#111111').sub], 'dates in the Text grey');
  });
});

describe('pages break cleanly: a long career runs on, no title at a page\'s foot, nothing past the margins (T9)', () => {
  const longJob = (k) => ({ ...JOB, company: `Company ${k}`, description: `<ul>${Array.from({ length: 9 }, (_, i) => `<li>Result ${k}.${i}: moved a platform metric the business tracked every quarter.</li>`).join('')}</ul>` });
  for (const pageSize of ['a4', 'letter']) {
    it(`${pageSize}: several pages, each title followed on its page by its first entry, every line within the margins`, async () => {
      const sections = [experience([1, 2, 3, 4, 5, 6].map(longJob)), ...EVERY_TYPE()];
      const pages = await read(await render(compact(sections, { pageSize })));
      assert.ok(pages.length >= 2, `${pages.length} pages`);
      for (const [k, page] of pages.entries()) {
        assert.deepEqual(overlaps(page), [], `page ${k + 1}`);
        const bottom = Math.min(...page.items.map((i) => i.y));
        assert.ok(bottom > 10 * MM - 3, `page ${k + 1}: its last line (${bottom.toFixed(1)}) above the bottom margin`);
        const last = page.items.reduce((a, b) => (b.y < a.y ? b : a));
        assert.ok(!TITLES.includes(last.str), `page ${k + 1} ends with the title ${last.str}`);
      }
    });
  }
});
