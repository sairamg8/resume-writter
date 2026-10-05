// R2-147-col — Design → Template → Layout on the two-column Sidebar (src/constants/layoutOptions.js): Details
// Left (the page as it always printed), Right (the side column on the right) or Top (the details on a band
// across the top, the column beneath it); Columns Mixed (the band, the main sections across the page, then
// the short sections two to a row); and Width, the side column's share of the paper (24–45 %, 38 unset).
// Each is read back from the app's own PDF with pdf.js: where the column's fill and each section print,
// what is drawn first, where the running header and the page numbers end, and that a résumé of several
// pages breaks as the Left page does. Before this, the layout keys were stored and read nowhere.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, overlaps, runningHeaderItems, MM } from './harness.mjs';
import { snapshot } from './parity/measure.mjs';

before(setup);
after(teardown);

const SIDEBAR_BG = '#1e293b';
const MAIN_PAD = 14; // the main column's padding on the side column's side (PdfPage.jsx MAIN_PAD_LEFT)
const SIDE_PAD = 10; // the side column's padding on the main column's side (PdfPage.jsx SIDE_PAD)
const H_MARGIN = 18 * MM; // a new résumé's Left / Right margin
const BOTTOM = (14 - 0.5) * MM; // the page's bottom padding: its 14 mm margin less react-pdf's 0.5 mm epsilon

const PERSONAL = {
  name: 'Avery Stone', title: 'Platform Engineer', email: 'avery@example.com', phone: '+1 555 0142',
  location: 'Porto, Portugal', summary: '<p>Builds reliable platforms and the teams that run them.</p>',
};
const bullets = (k) => `<ul>${Array.from({ length: 5 }, (_, i) => `<li>Delivered platform milestone ${k}.${i + 1} across four regional teams, on schedule and under budget</li>`).join('')}</ul>`;

/** A Sidebar résumé with `settings`: `jobs` jobs of five bullets (8 run to three pages), then four short sections. */
const cv = (settings = {}, { jobs = 2 } = {}) => resume({
  template: 'sidebar',
  settings,
  personal: PERSONAL,
  sections: [
    experience(Array.from({ length: jobs }, (_, i) => ({ company: `Northwind ${i + 1}`, role: `Staff Engineer ${i + 1}`, description: bullets(i + 1) }))),
    section('education', [{ institution: 'University of Porto', degree: 'MSc Informatics', startDate: '09/2012', endDate: '06/2014' }]),
    section('skills', [{ category: 'Coding', skills: 'TypeScript, Go, SQL' }]),
    section('languages', [{ language: 'Portuguese', proficiency: 'Native' }, { language: 'English', proficiency: 'Fluent' }]),
    section('certifications', [{ name: 'Kubernetes Administrator', issuer: 'CNCF', date: '05/2023' }]),
  ],
});

const shot = async (settings, opts) => snapshot(await render(cv(settings, opts)));
const runs = (snap) => snap.pages.flatMap((p) => p.items);
const heading = (snap, re) => runs(snap).find((t) => re.test(t.str.trim()));
const item = (snap, text) => runs(snap).find((t) => t.str.includes(text));
/** How far down the document a run sits, pt: the pages before it, then its depth on its page. */
const flow = (snap, t) => (t.page - 1) * snap.pages[0].H + (snap.pages[0].H - t.y);
/** The Sidebar Background's fills on page `n` (1-based). */
const fillsOn = (snap, n) => snap.paint.filter((p) => p.page === n && p.paint === 'fill' && String(p.colour).toLowerCase() === SIDEBAR_BG);
/** The side column's fill on page `n`: the paper's height, `share` of its width. */
const columnFill = (snap, n) => fillsOn(snap, n).find((p) => p.y1 - p.y0 > snap.pages[0].H * 0.9);
/** The band's fill on page 1: the paper's width, at its top edge. */
const bandFill = (snap) => fillsOn(snap, 1).find((p) => p.x0 < 1 && p.x1 > snap.pages[0].W - 1 && p.y1 > snap.pages[0].H - 1 && p.y1 - p.y0 < snap.pages[0].H / 2);
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const EXPERIENCE = /^professional experience$/i;
const FOOTER = /^Page \d+ of \d+$/;

describe('Design → Template → Layout prints the Sidebar\'s columns where it says (R2-147-col)', () => {
  it('unset, it is the page every résumé printed: the column 38 % of the paper on the left, the same drawing as the defaults stored or values no build offered', async () => {
    const unset = await shot({}, { jobs: 8 });
    const stored = await shot({ layoutColumns: 'two', layoutDetails: 'left', layoutSideWidth: 38 }, { jobs: 8 });
    const unknown = await shot({ layoutColumns: 'grid', layoutDetails: 'bottom', layoutSideWidth: 'wide' }, { jobs: 8 });
    assert.ok(unset.pages.length >= 2, 'the fixture runs past page 1');
    assert.equal(stored.drawing, unset.drawing, 'the defaults stored print the page with none');
    assert.equal(unknown.drawing, unset.drawing, 'values no build offered print the defaults');
    const { W } = unset.pages[0];
    unset.pages.forEach((_, i) => {
      const fill = columnFill(unset, i + 1);
      assert.ok(fill && near(fill.x0, 0, 0.5) && near(fill.x1, W * 0.38, 0.5), `page ${i + 1}: the column's fill is 0 → 38 % (${fill?.x0}–${fill?.x1})`);
    });
    assert.ok(near(heading(unset, EXPERIENCE).x, W * 0.38 + MAIN_PAD), 'the main column starts past the column');
    assert.ok(near(heading(unset, /^education$/i).x, H_MARGIN), 'the column\'s text on the left margin');
  });

  it('Details Right: the column on the right, its details still the first text drawn, the main column from the left margin', async () => {
    const snap = await shot({ layoutDetails: 'right' }, { jobs: 8 });
    const { W } = snap.pages[0];
    snap.pages.forEach((_, i) => {
      const fill = columnFill(snap, i + 1);
      assert.ok(fill && near(fill.x0, W * 0.62, 0.5) && near(fill.x1, W, 0.5), `page ${i + 1}: the column's fill runs 62 % → the right edge (${fill?.x0}–${fill?.x1})`);
    });
    assert.match(snap.pages[0].items[0].str, /Avery/, 'the name is the first text drawn (a reader meets it first)');
    assert.ok(near(heading(snap, EXPERIENCE).x, H_MARGIN), `the main column on the left margin (${heading(snap, EXPERIENCE).x})`);
    assert.ok(near(heading(snap, /^education$/i).x, W * 0.62 + SIDE_PAD), `the column's text past its padding (${heading(snap, /^education$/i).x})`);
    const name = item(snap, 'Avery');
    assert.ok(name.x > W * 0.62 && name.x + name.w < W - H_MARGIN + 1, 'the name in the column');
    // The main column's text stays clear of the column.
    const over = runs(snap).filter((t) => t.str.includes('Delivered platform') && t.x + t.w > W * 0.62 - MAIN_PAD + 1);
    assert.deepEqual(over.map((t) => t.str), [], 'no bullet runs into the column');
  });

  it('Details Right: the running header and the page numbers end at the main column\'s text, clear of the column', async () => {
    const snap = await shot({ layoutDetails: 'right', pageNumbers: true }, { jobs: 8 });
    const { W } = snap.pages[0];
    const edge = W * 0.62 - MAIN_PAD;
    assert.ok(snap.pages.length >= 2, 'the fixture runs past page 1');
    snap.pages.forEach((p, i) => {
      const footer = p.items.filter((t) => FOOTER.test(t.str.trim()));
      assert.equal(footer.length, 1, `page ${i + 1}: one page number`);
      assert.ok(near(footer[0].x + footer[0].w, edge, 1.5), `page ${i + 1}: the number ends at ${(footer[0].x + footer[0].w).toFixed(1)}, the main column's text at ${edge.toFixed(1)}`);
      if (!i) return;
      const header = runningHeaderItems(p, i);
      assert.ok(header.length, `page ${i + 1}: its running header is the first text drawn`);
      const end = Math.max(...header.map((t) => t.x + t.w));
      assert.ok(near(end, edge, 1.5), `page ${i + 1}: the running header ends at ${end.toFixed(1)}, the main column's text at ${edge.toFixed(1)}`);
    });
  });

  it('Details Top: the details on a band across the top, the column and the main column beneath it', async () => {
    const snap = await shot({ layoutDetails: 'top' }, { jobs: 8 });
    const { W, H } = snap.pages[0];
    const band = bandFill(snap);
    assert.ok(band, 'a band of the Sidebar Background across the paper\'s top');
    const [name, email, about, edu, exp] = [item(snap, 'Avery'), item(snap, PERSONAL.email), heading(snap, /^about me$/i), heading(snap, /^education$/i), heading(snap, EXPERIENCE)];
    assert.match(snap.pages[0].items[0].str, /Avery/, 'the name is the first text drawn');
    for (const [label, t] of [['the name', name], ['the e-mail', email]]) {
      assert.ok(t.page === 1 && t.y > band.y0 && t.y < H, `${label} is on the band`);
      assert.ok(t.x >= H_MARGIN - 1 && t.x + t.w <= W - H_MARGIN + 1, `${label} keeps the page margins`);
    }
    assert.ok(about.y < band.y0 && edu.y < band.y0, 'the columns start under the band');
    assert.ok(near(edu.x, H_MARGIN) && near(exp.x, W * 0.38 + MAIN_PAD), `the column on the left (${edu.x}), the main column past it (${exp.x})`);
    snap.pages.forEach((_, i) => {
      const fill = columnFill(snap, i + 1);
      assert.ok(fill && near(fill.x1, W * 0.38, 0.5), `page ${i + 1}: the column's fill under the band`);
    });
    assert.equal(runs(snap).filter((t) => /^CONTACT$/i.test(t.str.trim())).length, 0, 'no Contact section in the column: the contacts are on the band');
  });

  it('Mixed: the band, the main sections across the page, then the short sections two to a row, one entry to a line', async () => {
    const snap = await shot({ layoutColumns: 'mixed', layoutDetails: 'right' }, { jobs: 2 });
    const { W } = snap.pages[0];
    assert.ok(bandFill(snap), 'the details on a band across the top (Details does not apply)');
    assert.equal(columnFill(snap, 1), undefined, 'no side column');
    const [exp, about, edu, skills, langs, certs] = [EXPERIENCE, /^about me$/i, /^education$/i, /^skills$/i, /^languages$/i, /^certifications$/i].map((re) => heading(snap, re));
    assert.ok(near(exp.x, H_MARGIN) && near(about.x, H_MARGIN), 'the main sections on the left margin');
    assert.ok(runs(snap).some((t) => t.str.includes('Delivered platform') && t.x + t.w > W * 0.62), 'a bullet runs across the page');
    const lastJob = Math.max(...runs(snap).filter((t) => t.str.includes('Delivered platform')).map((t) => flow(snap, t)));
    for (const t of [edu, skills, langs, certs]) assert.ok(flow(snap, t) > lastJob, `"${t.str}" prints after the main sections`);
    assert.ok(near(edu.x, H_MARGIN) && near(skills.x, W * 0.38 + MAIN_PAD) && near(edu.y, skills.y, 0.5), `row 1: Education (${edu.x}) and Skills (${skills.x}) side by side`);
    assert.ok(near(langs.x, H_MARGIN) && near(certs.x, W * 0.38 + MAIN_PAD) && near(langs.y, certs.y, 0.5), `row 2: Languages (${langs.x}) and Certifications (${certs.x}) side by side`);
    assert.ok(flow(snap, langs) > flow(snap, item(snap, 'University of Porto')), 'row 2 under row 1');
    const [pt, en] = [item(snap, 'Portuguese'), item(snap, 'English')];
    assert.ok(near(pt.x, en.x) && en.y < pt.y - 1, 'Languages (Grids 2 stored) prints one language to a line in its column');
    assert.match(snap.pages[0].items[0].str, /Avery/, 'the name is the first text drawn');
  });

  it('Width: the column is that share of the paper and the main column starts past it; in Mixed it is the left one of each row', async () => {
    for (const pct of [24, 45]) {
      const snap = await shot({ layoutSideWidth: pct });
      const { W } = snap.pages[0];
      const fill = columnFill(snap, 1);
      assert.ok(fill && near(fill.x1, (W * pct) / 100, 0.5), `${pct} %: the column's fill ends at ${fill?.x1}`);
      assert.ok(near(heading(snap, EXPERIENCE).x, (W * pct) / 100 + MAIN_PAD), `${pct} %: the main column starts at ${heading(snap, EXPERIENCE).x}`);
    }
    const right = await shot({ layoutDetails: 'right', layoutSideWidth: 30 });
    assert.ok(near(columnFill(right, 1).x0, right.pages[0].W * 0.7, 0.5), 'Right: 30 % at the right edge');
    const mixed = await shot({ layoutColumns: 'mixed', layoutSideWidth: 30 });
    assert.ok(near(heading(mixed, /^skills$/i).x, mixed.pages[0].W * 0.3 + MAIN_PAD), 'Mixed: the second of a row starts past 30 %');
    const clamped = await shot({ layoutSideWidth: 99 });
    assert.ok(near(columnFill(clamped, 1).x1, clamped.pages[0].W * 0.45, 0.5), 'a stored 99 prints the most the control offers, 45 %');
  });

  it('every layout breaks pages as Left does: nothing past the bottom margin, no overlaps, no title alone at a page foot, the column on every page', async () => {
    const titles = /^(professional experience|about me|education|skills|languages|certifications)$/i;
    for (const settings of [{ layoutDetails: 'right' }, { layoutDetails: 'top' }, { layoutColumns: 'mixed' }, { layoutSideWidth: 26 }]) {
      const label = JSON.stringify(settings);
      const snap = await shot(settings, { jobs: 8 });
      assert.ok(snap.pages.length >= 2, `${label}: the fixture runs past page 1`);
      assert.ok(new Set(runs(snap).filter((t) => t.str.includes('Delivered platform')).map((t) => t.page)).size >= 2, `${label}: Experience splits across pages`);
      snap.pages.forEach((p, i) => {
        const header = new Set(runningHeaderItems(p, i));
        const body = p.items.filter((t) => !header.has(t));
        const low = body.filter((t) => t.y < BOTTOM - 0.5);
        assert.deepEqual(low.map((t) => t.str), [], `${label} page ${i + 1}: text past the bottom margin`);
        assert.deepEqual(overlaps(p), [], `${label} page ${i + 1}: text overlaps`);
        for (const t of body.filter((x) => titles.test(x.str.trim()))) {
          assert.ok(body.some((x) => x !== t && x.y < t.y - 1 && x.x >= t.x - 5 && x.x < t.x + 200), `${label} page ${i + 1}: "${t.str}" is the last text of its column on the page`);
        }
        if (!settings.layoutColumns) assert.ok(columnFill(snap, i + 1), `${label} page ${i + 1}: the column's fill`);
      });
    }
  });
});
