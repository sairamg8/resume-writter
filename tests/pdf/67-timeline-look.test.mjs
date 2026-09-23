// T6 — the Timeline template's own look (TimelineTemplatePDF.jsx, shared/PdfTimeline.jsx): every
// section with entry headers (Experience, Education, Volunteering, Projects, custom) prints on a
// vertical accent line with a dot per entry, each entry's date set ABOVE its title; the other
// sections print as every template prints them. Read from the PDF itself — pdf.js text positions and
// the painted operator list — for every section type and each design control the rail answers to.
// How the entries parse (text order, runs, a parser's header): 67-timeline-ats.test.mjs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, renderCover, read, allText, overlaps, drawState, loadModule, MM } from './harness.mjs';
import { painted } from './extractors.mjs';

before(setup);
after(teardown);

const ACCENT = '#0f766e';
const MARGIN_MM = 18;
const base = (settings = {}) => ({ accentColor: ACCENT, marginH: MARGIN_MM, fontSizeBase: 10, ...settings });
const timeline = (sections, settings) => resume({ template: 'timeline', settings: base(settings), sections });
const rail = () => loadModule('/src/templates/pdf/shared/PdfTimeline.jsx');
const railColour = async (accent) => (await loadModule('/src/templates/pdf/shared/timelineRail.js')).railColor(accent);

/** Page 1's dots (the accent's DOT-wide fills) and rail segments (vertical strokes in the rail's colour). */
async function shapes(bytes, accent = ACCENT) {
  const { DOT } = await rail();
  const colour = await railColour(accent);
  const all = await painted(bytes);
  return {
    dots: all.filter((p) => p.paint === 'fill' && p.colour === accent && Math.abs(p.x1 - p.x0 - DOT) < 0.05 && Math.abs(p.y1 - p.y0 - DOT) < 0.05),
    rails: all.filter((p) => p.paint === 'stroke' && p.colour === colour && Math.abs(p.x1 - p.x0) < 0.01 && p.y1 - p.y0 > 1),
  };
}
const mid = (p) => ({ x: (p.x0 + p.x1) / 2, y: (p.y0 + p.y1) / 2 });
const first = (pages, str) => pages.flatMap((p) => p.items).find((i) => i.str.includes(str));

const JOB = { company: 'Northwind Traders', role: 'Staff Engineer', location: 'Austin, TX', startDate: '03/2022', endDate: '', current: true, description: '<ul><li>Led the checkout rebuild.</li></ul>' };
const JOB2 = { company: 'Contoso Bank', role: 'Frontend Engineer', location: 'Remote', startDate: '06/2019', endDate: '02/2022', description: '<ul><li>Shipped the dashboard.</li></ul>' };

/** Every section type, one entry each: the five on the rail first. */
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

describe('Timeline prints every section type (T6)', () => {
  it('every fact of every section type, no text overprinting another; a dot for each entry on the rail', async () => {
    const bytes = await render(timeline(EVERY_TYPE()));
    const pages = await read(bytes);
    const text = allText(pages);
    assert.deepEqual(FACTS.filter((f) => !text.includes(f)), []);
    for (const page of pages) assert.deepEqual(overlaps(page), []);
    assert.ok(pages[0].items.some((i) => i.str.includes('Conference Speaker')), 'the five rail sections come first, on page 1');
    const { dots, rails } = await shapes(bytes);
    assert.equal(dots.length, 5, 'Experience, Education, Projects, Volunteering and the custom section: one dot each');
    assert.equal(rails.length, 5, 'and a rail segment each');
  });
});

describe('the rail, the dot and the date above the title (T6)', () => {
  it('the date sits above its title, both INSET in; the dot is on the rail, level with the date', async () => {
    const { DOT, RAIL_X, RAIL_W, INSET } = await rail();
    const bytes = await render(timeline([experience([JOB, JOB2])]));
    const pages = await read(bytes);
    const margin = MARGIN_MM * MM;
    const { dots, rails } = await shapes(bytes);
    assert.equal(dots.length, 2);
    for (const [k, [date, title]] of [['03/2022 – Present', 'Staff Engineer'], ['06/2019 – 02/2022', 'Frontend Engineer']].entries()) {
      const d = first(pages, date);
      const t = first(pages, title);
      assert.ok(d.y > t.y + 5, `${date} (${d.y}) prints above ${title} (${t.y})`);
      assert.ok(Math.abs(d.x - (margin + INSET)) < 0.1 && Math.abs(t.x - (margin + INSET)) < 0.1, `${date}, ${title}: text ${INSET} pt in (${d.x}, ${t.x})`);
      const dot = mid(dots.toSorted((a, b) => b.y0 - a.y0)[k]);
      assert.ok(Math.abs(dot.x - (margin + RAIL_X)) < 0.05, `dot ${k} centred on the rail (${dot.x})`);
      assert.ok(dot.y > d.y && dot.y < d.y + 0.8 * d.h, `dot ${k} (${dot.y}) level with the date's capitals (baseline ${d.y}, size ${d.h})`);
      assert.ok(dot.x + DOT / 2 < d.x, 'the dot stays left of the text');
    }
    for (const r of rails) assert.ok(Math.abs(r.x0 + RAIL_W / 2 - (margin + RAIL_X)) < 0.05, `rail centred on RAIL_X (${r.x0})`);
    const [upper, lower] = rails.toSorted((a, b) => b.y0 - a.y0);
    assert.ok(Math.abs(upper.y0 - lower.y1) < 0.5, `the line runs unbroken from one entry to the next (${upper.y0} → ${lower.y1})`);
  });

  it('the date is bold, in the accent, a point under the body size', async () => {
    const bytes = await render(timeline([experience([JOB])], { fontSizeBase: 11 }));
    const d = first(await read(bytes), '03/2022 – Present');
    assert.match(d.font, /Bold/);
    assert.deepEqual((await drawState(bytes, '03/2022')).map((h) => h.fill), [ACCENT]);
    assert.ok(Math.abs(d.h - 10) < 0.5, `10 pt at a base of 11 (${d.h})`);
  });

  it('a section that is not on the rail prints no dot and no line', async () => {
    const bytes = await render(timeline([section('skills', [{ category: 'Frontend', skills: 'React' }]), section('awards', [{ title: 'Hackathon Winner', date: '04/2021' }])]));
    const { dots, rails } = await shapes(bytes);
    assert.deepEqual([dots.length, rails.length], [0, 0]);
  });
});

describe('the rail follows the Design controls (T6)', () => {
  it('Accent colour: the dot takes it, the line a tint of it', async () => {
    const bytes = await render(timeline([experience([JOB])], { accentColor: '#e11d48' }));
    const { dots, rails } = await shapes(bytes, '#e11d48');
    assert.deepEqual([dots.length, rails.length], [1, 1]);
  });

  it('Page margins: the rail moves with the left margin', async () => {
    const { RAIL_X } = await rail();
    const bytes = await render(timeline([experience([JOB])], { marginH: 30 }));
    const [dot] = (await shapes(bytes)).dots;
    assert.ok(Math.abs(mid(dot).x - (30 * MM + RAIL_X)) < 0.05, `${mid(dot).x}`);
  });

  it('Show dates off: no date line, and the dot is level with the title instead', async () => {
    const bytes = await render(timeline([experience([JOB], { showDates: false })]));
    const pages = await read(bytes);
    assert.ok(!allText(pages).includes('2022'), allText(pages));
    const t = first(pages, 'Staff Engineer');
    const [dot] = (await shapes(bytes)).dots;
    assert.ok(mid(dot).y > t.y && mid(dot).y < t.y + 0.8 * t.h, `dot ${mid(dot).y}, title baseline ${t.y}`);
  });

  it('Show location off, a hidden field and Date format each reach the entry', async () => {
    const text = async (settings, item = {}, design = {}) => allText(await read(await render(timeline([experience([{ ...JOB, ...item }], settings)], design))));
    assert.ok(!(await text({ showLocation: false })).includes('Austin'));
    assert.ok(!(await text({}, { hiddenFields: ['company'] })).includes('Northwind'));
    assert.ok((await text({}, {}, { dateFormat: 'MMM YYYY' })).includes('Mar 2022 – Present'));
  });

  it('Grids 2: each cell on a rail of its own, side by side', async () => {
    const bytes = await render(timeline([experience([JOB, JOB2], { columns: 2 })]));
    const { dots, rails } = await shapes(bytes);
    assert.equal(dots.length, 2);
    assert.equal(rails.length, 2);
    const [a, b] = dots.map(mid).toSorted((p, q) => p.x - q.x);
    assert.ok(Math.abs(a.y - b.y) < 0.05 && b.x - a.x > 200, `${JSON.stringify([a, b])}`);
  });

  it('Alignment Center: the date and title centre in the text column; the dot stays on the rail', async () => {
    const { RAIL_X, INSET } = await rail();
    const bytes = await render(timeline([experience([JOB], { alignment: 'center' })]));
    const pages = await read(bytes);
    const margin = MARGIN_MM * MM;
    const centre = margin + INSET + (pages[0].W - 2 * margin - INSET) / 2;
    // The date line, and the title line ("Staff Engineer — Northwind Traders": Side by side centres as one line).
    for (const s of ['03/2022 – Present', 'Staff Engineer']) {
      const y = first(pages, s).y;
      const line = pages[0].items.filter((i) => Math.abs(i.y - y) < 1);
      const [x0, x1] = [Math.min(...line.map((i) => i.x)), Math.max(...line.map((i) => i.x + i.w))];
      assert.ok(Math.abs((x0 + x1) / 2 - centre) < 1, `${s}'s line centred (${(x0 + x1) / 2} vs ${centre})`);
    }
    assert.ok(Math.abs(mid((await shapes(bytes)).dots[0]).x - (margin + RAIL_X)) < 0.05);
  });
});

describe('pagination on the rail (T6)', () => {
  const LONG = Array.from({ length: 9 }, (_, i) => ({
    ...JOB, company: `Company ${i + 1}`, role: `Role ${i + 1}`, startDate: `01/${2010 + i}`, endDate: `12/${2010 + i}`, current: false,
    description: `<ul>${Array.from({ length: 4 }, (__, k) => `<li>Delivered outcome ${k + 1} of job ${i + 1} across several teams and quarters of work.</li>`).join('')}</ul>`,
  }));

  it('a date never ends a page away from its title, and the line carries on over the break', async () => {
    const r = timeline([experience(LONG)]);
    const pages = await read(await render(r));
    assert.ok(pages.length >= 2, `${pages.length} pages`);
    const dates = LONG.map((j) => `${j.startDate} – ${j.endDate}`);
    for (const [i, date] of dates.entries()) {
      const at = pages.findIndex((p) => p.items.some((t) => t.str.includes(date)));
      const titleAt = pages.findIndex((p) => p.items.some((t) => t.str === `Role ${i + 1}`));
      assert.equal(at, titleAt, `${date}: on page ${at + 1}, its title on page ${titleAt + 1}`);
    }
    const colour = (await railColour(ACCENT)).replace('#', '');
    for (const [n, p] of pages.entries()) assert.ok([...p.strokes].some((s) => s.toLowerCase().includes(colour)), `page ${n + 1} draws the rail`);
  });
});

describe('the cover letter takes the Timeline look (T6)', () => {
  it('a rule in the rail\'s colour and width under the letterhead, where the résumé prints no header rule', async () => {
    const { RAIL_W } = await rail();
    const colour = await railColour(ACCENT);
    const r = timeline([], { showHeaderBorder: false });
    const shapesOf = await painted(await renderCover(r));
    // painted() gives a stroke's printed thickness (react-pdf strokes a border at twice its width, clipped).
    const rule = shapesOf.filter((p) => p.paint === 'stroke' && p.colour === colour && Math.abs(p.width - RAIL_W) < 0.05 && Math.abs(p.y1 - p.y0) < 0.01 && p.x1 - p.x0 > 100);
    assert.equal(rule.length, 1, JSON.stringify(shapesOf.filter((p) => p.colour === colour)));
  });
});
