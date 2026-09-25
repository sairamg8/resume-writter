// T7 — the Banner template's own look (BannerTemplatePDF.jsx): a band of the accent from the paper's top
// and side edges holding the header, its text on the page margins; a strip of it along the top of
// every later page; one white column below; each section title a filled accent chip, the title
// reversed out of it (Boxed on Banner, sectionHeadingLook's chip). Read from the PDF itself — pdf.js
// text positions and the painted operator list — for every section type and the design controls the
// band and chips answer to. The header's own controls: 68-banner-header. How it parses: 68-banner-ats.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allText, overlaps, drawState, loadModule, bodyItems, runningHeaderItems, MM } from './harness.mjs';
import { paintedPages, topBands, fillsBehind } from './banner-paint.mjs';

before(setup);
after(teardown);

const ACCENT = '#1e3a8a';
const base = (settings = {}) => ({ accentColor: ACCENT, marginH: 18, marginV: 14, fontSizeBase: 10, headingStyle: 'box', ...settings });
const banner = (sections, settings, personal = {}) => resume({ template: 'banner', settings: base(settings), sections, personal: { title: 'Principal Architect', email: 'pat@example.com', phone: '+1 555 0100', summary: '<p>Builds fast, accessible web apps.</p>', ...personal } });
const first = (pages, str, page = 0) => pages[page].items.find((i) => i.str.includes(str));

const JOB = { company: 'Northwind Traders', role: 'Staff Engineer', location: 'Austin, TX', startDate: '03/2022', endDate: '', current: true, description: '<ul><li>Led the checkout rebuild.</li></ul>' };

/** Every section type, one entry each. */
const EVERY_TYPE = () => [
  experience([JOB]),
  section('education', [{ institution: 'Lakeside State University', degree: 'B.S. Computer Science', startDate: '08/2013', endDate: '05/2017', gpa: '3.7' }]),
  section('projects', [{ name: 'Open Recipes', technologies: 'React, IndexedDB', url: 'github.com/x/open-recipes', startDate: '01/2023', endDate: '06/2023', description: '<p>Offline-first recipe manager.</p>' }]),
  section('volunteering', [{ role: 'Workshop Mentor', org: 'Code Club', location: 'Oakland, CA', startDate: '01/2019', endDate: '12/2020' }]),
  section('custom', [{ title: 'Conference Speaker', subtitle: 'JSConf EU', location: 'Berlin, DE', date: '06/2022' }], {}, { title: 'Talks' }),
  section('skills', [{ category: 'Frontend', skills: 'React, TypeScript' }]),
  section('languages', [{ language: 'Spanish', proficiency: 'Professional' }]),
  section('certifications', [{ name: 'AWS Certified Developer', issuer: 'Amazon Web Services', date: '05/2023' }]),
  section('awards', [{ title: 'Hackathon Winner', issuer: 'Devpost', date: '04/2021' }]),
  section('references', [{ name: 'Taylor Brooks', jobTitle: 'Engineering Manager', company: 'Tailspin Toys', email: 'taylor@example.com' }]),
  section('interests', [{ interests: 'Climbing, Chess' }]),
];
const FACTS = ['Northwind Traders', 'Staff Engineer', 'Austin, TX', 'Led the checkout rebuild.', 'Lakeside State University', 'B.S. Computer Science',
  'Open Recipes', 'React, IndexedDB', 'github.com/x/open-recipes', 'Offline-first recipe manager.', 'Workshop Mentor', 'Code Club', 'Conference Speaker',
  'JSConf EU', 'Berlin, DE', 'React, TypeScript', 'Spanish', 'Professional', 'AWS Certified Developer', 'Amazon Web Services', 'Hackathon Winner',
  'Devpost', 'Taylor Brooks', 'Tailspin Toys', 'taylor@example.com', 'Climbing', 'Chess'];

/** A job with `n` bullets, for a résumé long enough to run onto page 2. */
const longJob = (k, n = 9) => ({ ...JOB, company: `Company ${k}`, description: `<ul>${Array.from({ length: n }, (_, i) => `<li>Bullet ${k}.${i} about shipping measurable work across teams and quarters.</li>`).join('')}</ul>` });

describe('Banner prints every section type (T7)', () => {
  it('every fact of every section type, every title in a chip, no text overprinting another or off the paper', async () => {
    const bytes = await render(banner(EVERY_TYPE()));
    const pages = await read(bytes);
    assert.deepEqual(FACTS.filter((f) => !allText(pages).includes(f)), []);
    const paints = await paintedPages(bytes);
    for (const [k, page] of pages.entries()) {
      assert.deepEqual(overlaps(page), [], `page ${k + 1}`);
      for (const i of page.items) assert.ok(i.x >= 0 && i.x + i.w <= page.W + 0.01 && i.y > 0 && i.y < page.H, `${i.str}: on the paper`);
    }
    const titles = ['PROFESSIONAL EXPERIENCE', 'EDUCATION', 'PROJECTS', 'VOLUNTEERING', 'TALKS', 'SKILLS', 'LANGUAGES', 'CERTIFICATIONS', 'AWARDS & HONORS', 'REFERENCES', 'INTERESTS'];
    for (const t of titles) {
      const k = pages.findIndex((p) => p.items.some((i) => i.str === t));
      assert.ok(k >= 0, `${t} printed`);
      assert.equal(fillsBehind(paints[k], ACCENT, first(pages, t, k)).length, 1, `${t}: in one accent chip`);
    }
  });
});

describe('the band: the accent from the paper\'s top and side edges, its text on the page margins (T7)', () => {
  it('one fill across the whole width from the top edge, holding the name, title and contacts, ending above the summary', async () => {
    const bytes = await render(banner([experience([JOB])]));
    const [page] = await read(bytes);
    const [band] = topBands((await paintedPages(bytes))[0], ACCENT, page.W, page.H);
    assert.ok(band, 'a full-width accent fill from the top edge');
    const name = first([page], 'Test Person');
    const contact = first([page], 'pat@example.com');
    const summary = first([page], 'Builds fast');
    assert.ok(Math.abs(name.x - 18 * MM) < 0.5, `the name on the left margin (${name.x})`);
    assert.ok(Math.abs(summary.x - 18 * MM) < 0.5, 'the summary under the band, on the same margin');
    assert.ok(band.y0 < contact.y - 15 && band.y0 > summary.y + summary.h, `the band (to ${band.y0.toFixed(1)}) holds the contacts (${contact.y.toFixed(1)}), ends above the summary`);
    for (const needle of ['Test Person', 'Principal Architect', 'pat@example.com']) {
      assert.deepEqual([...new Set((await drawState(bytes, needle)).map((h) => h.fill))], ['#ffffff'], `${needle}: reversed out of the band`);
    }
    assert.notEqual((await drawState(bytes, 'Builds fast'))[0].fill, '#ffffff', 'the summary is on the white page, in the Text colour');
  });

  it('Top / Bottom margin: the band still starts at the paper\'s edge; the text in it moves down by the change', async () => {
    const at = async (marginV) => {
      const bytes = await render(banner([experience([JOB])], { marginV }));
      const [page] = await read(bytes);
      return { band: topBands((await paintedPages(bytes))[0], ACCENT, page.W, page.H)[0], name: first([page], 'Test Person').y };
    };
    const [a, b] = [await at(10), await at(20)];
    assert.ok(a.band && b.band, 'the band from the top edge at both margins');
    assert.ok(Math.abs(a.name - b.name - 10 * MM) < 0.05, `the name moved ${(a.name - b.name).toFixed(2)} pt, want ${(10 * MM).toFixed(2)}`);
    assert.ok(Math.abs(a.band.y0 - b.band.y0 - 10 * MM) < 0.05, 'and the band\'s foot with it');
  });

  it('Left / Right margin and US Letter: the band spans the paper, the text keeps the margins', async () => {
    for (const settings of [{ marginH: 8 }, { marginH: 30 }, { pageSize: 'LETTER' }]) {
      const bytes = await render(banner([experience([JOB])], settings));
      const [page] = await read(bytes);
      assert.ok(topBands((await paintedPages(bytes))[0], ACCENT, page.W, page.H)[0], `${JSON.stringify(settings)}: full width (${page.W})`);
      const margin = (settings.marginH ?? 18) * MM;
      assert.ok(Math.abs(first([page], 'Test Person').x - margin) < 0.5, `${JSON.stringify(settings)}: the name on the margin`);
      const date = first([page], '03/2022');
      assert.ok(Math.abs(date.x + date.w - (page.W - margin)) < 0.5, `${JSON.stringify(settings)}: the date ends on the right margin`);
    }
  });

  it('Accent: the band, the chips and the strip all take it', async () => {
    const bytes = await render(banner([experience([longJob(1), longJob(2), longJob(3), longJob(4)])], { accentColor: '#9f1239' }));
    const pages = await read(bytes);
    const paints = await paintedPages(bytes);
    assert.ok(pages.length >= 2, 'two pages');
    assert.ok(topBands(paints[0], '#9f1239', pages[0].W, pages[0].H)[0], 'the band');
    assert.equal(fillsBehind(paints[0], '#9f1239', first(pages, 'EXPERIENCE')).length, 1, 'the chip');
    assert.ok(topBands(paints[1], '#9f1239', pages[1].W, pages[1].H)[0], 'the strip on page 2');
  });
});

describe('every page after the first carries the band on as a strip (T7)', () => {
  it('a 6 pt strip along the top edge of page 2, clear of its text; none where the margin leaves no room', async () => {
    const make = (marginV) => banner([experience([longJob(1), longJob(2), longJob(3), longJob(4)])], { marginV });
    const bytes = await render(make(14));
    const pages = await read(bytes);
    const [strip] = topBands((await paintedPages(bytes))[1], ACCENT, pages[1].W, pages[1].H);
    assert.ok(strip, 'a full-width accent fill from page 2\'s top edge');
    assert.ok(Math.abs(strip.y1 - strip.y0 - 6) < 0.05, `6 pt tall (${(strip.y1 - strip.y0).toFixed(2)})`);
    const top = Math.max(...bodyItems(pages[1], 1).map((i) => i.y + i.h));
    assert.ok(top < strip.y0 - 20, `page 2's text (top ${top.toFixed(1)}) starts on the margin, under the strip (${strip.y0.toFixed(1)})`);
    // The running header ("Name · Page 2", ATS-7) prints in the margin between the strip and the text.
    const header = runningHeaderItems(pages[1], 1);
    assert.ok(header.length, 'page 2 carries its running header');
    for (const h of header) assert.ok(h.y + h.h < strip.y0 && h.y > top, `the header (${h.y.toFixed(1)}–${(h.y + h.h).toFixed(1)}) is between the text (${top.toFixed(1)}) and the strip (${strip.y0.toFixed(1)})`);
    const flush = await render(make(0));
    const flushPages = await read(flush);
    assert.ok(flushPages.length >= 2);
    assert.deepEqual(topBands((await paintedPages(flush))[1], ACCENT, flushPages[1].W, flushPages[1].H), [], 'a 0 mm margin: no strip over the text');
  });
});

describe('the section titles: filled chips, the title reversed out of them (T7)', () => {
  it('a chip as wide as its title and its padding, in the accent; the title in white', async () => {
    const bytes = await render(banner([experience([JOB])]));
    const [page] = await read(bytes);
    const title = first([page], 'EXPERIENCE');
    const [chip] = fillsBehind((await paintedPages(bytes))[0], ACCENT, title);
    assert.ok(Math.abs(chip.x0 - 18 * MM) < 0.5, 'on the left margin');
    assert.ok(Math.abs((chip.x1 - chip.x0) - (title.w + 14)) < 1, `hugs the title: ${(chip.x1 - chip.x0).toFixed(1)} for a ${title.w.toFixed(1)} pt title`);
    assert.deepEqual([...new Set((await drawState(bytes, 'EXPERIENCE')).map((h) => h.fill))], ['#ffffff']);
  });

  it('Border color fills the chip; a light fill takes a dark title that reads 4.5:1 on it', async () => {
    const { contrast } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    for (const [settings, fill] of [[{ sectionBorderColor: '#b91c1c' }, '#b91c1c'], [{ accentColor: '#fde68a' }, '#fde68a']]) {
      const bytes = await render(banner([experience([JOB])], settings));
      const [page] = await read(bytes);
      assert.equal(fillsBehind((await paintedPages(bytes))[0], fill, first([page], 'EXPERIENCE')).length, 1, `${fill}: the chip`);
      const [ink] = (await drawState(bytes, 'EXPERIENCE')).map((h) => h.fill);
      assert.ok(contrast(ink, fill) >= 4.5, `${fill}: the title ${ink} reads ${contrast(ink, fill).toFixed(2)}:1`);
    }
  });

  it('Alignment Center centres the chip; Title case Abc prints the title as typed', async () => {
    const bytes = await render(banner([experience([JOB], { alignment: 'center' })], { sectionTitleCase: 'normal' }));
    const [page] = await read(bytes);
    const title = first([page], 'Experience');
    const [chip] = fillsBehind((await paintedPages(bytes))[0], ACCENT, title);
    assert.ok(Math.abs((chip.x0 + chip.x1) / 2 - page.W / 2) < 0.5, 'centred on the page');
  });

  it('the body keeps to the Text colour: the entries\' dates in its grey, the colour left to the band and chips', async () => {
    for (const accentColor of [ACCENT, '#fde68a']) {
      const bytes = await render(banner([experience([JOB])], { accentColor, textColor: '#111111' }));
      assert.deepEqual([...new Set((await drawState(bytes, '03/2022')).map((h) => h.fill))], ['#545454'], `${accentColor}: the date`);
      assert.deepEqual([...new Set((await drawState(bytes, 'Staff Engineer')).map((h) => h.fill))], ['#111111'], `${accentColor}: the role`);
    }
  });

  it('the other heading styles print as on every template: no chip behind the title', async () => {
    for (const headingStyle of ['ruled', 'leftbar', 'line', 'underline', 'plain']) {
      const bytes = await render(banner([experience([JOB])], { headingStyle }));
      const [page] = await read(bytes);
      const title = first([page], 'EXPERIENCE');
      assert.deepEqual(fillsBehind((await paintedPages(bytes))[0], ACCENT, title), [], headingStyle);
      assert.deepEqual([...new Set((await drawState(bytes, 'EXPERIENCE')).map((h) => h.fill))], [ACCENT], `${headingStyle}: the title in the accent`);
    }
  });

  it('a title never ends a page: it moves with its entry', async () => {
    const jobs = Array.from({ length: 5 }, (_, k) => longJob(k, 6));
    for (const marginV of [10, 14, 18, 22, 26]) {
      const pages = await read(await render(banner([experience(jobs), section('skills', [{ category: 'Frontend', skills: 'React' }])], { marginV })));
      for (const [k, page] of pages.entries()) {
        const t = page.items.find((i) => i.str === 'SKILLS');
        if (t) assert.ok(page.items.some((i) => i.y < t.y - 2), `margin ${marginV}: SKILLS on page ${k + 1} has its entry under it`);
      }
    }
  });
});
