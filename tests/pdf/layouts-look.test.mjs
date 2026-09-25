// R2-138 B2 — the ten designed layouts are engines of their own, each drawing marks no other template draws:
// Gridline's hairlines, Registry's bar and dotted rules, Bookend's heavy rules and page foot, Lectern's centre
// line, Chronicle's thick-and-thin masthead and double rules, Keystone's wedge and edged boxes, Banded's bands to
// the paper's edges, Keel's bar, Linen's stitch and short underlines, Broadsheet's headline rule and overlines.
// Each is offered in the picker with its label, its ATS tier and Classic's header controls; its marks are fills
// and strokes, never text (its page reads word for word as Classic's does with the same settings); and its cover
// letter closes its letterhead on the same mark. How they parse: layouts-ats.test.mjs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, render, renderCover, read, loadModule, withoutRunningHeaders, MM } from './harness.mjs';
import { painted } from './extractors.mjs';

before(setup);
after(teardown);

const DESIGNED = ['gridline', 'registry', 'bookend', 'lectern', 'chronicle', 'keystone', 'banded', 'keel', 'linen', 'broadsheet'];
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;

/** A designed layout's demo résumé (tests/fixtures/sampleResumes.js), with `settings` over its own. */
async function demo(template, settings = {}) {
  const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
  const r = structuredClone(DEMO_RESUMES.find((x) => x.template === template));
  r.settings = { ...r.settings, ...settings };
  return r;
}

/** Page 1 of `r`: its painted marks, its text items, the name's item, the page's column edges (pt, PDF space: y up). */
async function page1(r) {
  const bytes = await render(r);
  const [p] = await read(bytes);
  const marks = (await painted(bytes)).filter((m) => m.paint === 'fill' || m.paint === 'stroke');
  const left = (r.settings.marginH ?? 18) * MM;
  return { bytes, marks, items: p.items, name: p.items.find((i) => i.str === r.personal.name), left, right: p.W - left, width: p.W, height: p.H };
}

/** The marks in colour `c` (case-insensitive). */
const inColour = (marks, c) => marks.filter((m) => m.colour?.toLowerCase() === c.toLowerCase());
/** The marks spanning the column from `left` to `right`. */
const across = (marks, { left, right }) => marks.filter((m) => near(m.x0, left, 1) && near(m.x1, right, 1));
/** The section titles' items on page 1, by their text. */
const titleItems = (items, titles) => items.filter((i) => titles.includes(i.str));

describe('the picker offers each designed layout with its label, its ATS tier and Classic\'s header controls (R2-138 B2)', () => {
  it('each is a template the app offers, listed after the others, a single column on the white page (Banded: under its band)', async () => {
    const { TEMPLATE_IDS, TEMPLATE_PICKER, templateLabel, atsRating, hasHeaderControls, templateDesc } = await loadModule('/src/constants/templates.js');
    assert.deepEqual(TEMPLATE_IDS.slice(-DESIGNED.length), DESIGNED);
    assert.deepEqual(TEMPLATE_PICKER.map((t) => t.id).slice(-DESIGNED.length), DESIGNED);
    for (const id of DESIGNED) {
      assert.equal(templateLabel(id), `${id[0].toUpperCase()}${id.slice(1)}`, id);
      assert.equal(atsRating(id).tier, id === 'banded' ? 'good' : 'certified', id);
      assert.ok(atsRating(id).safe, `${id}: badged ATS-safe`);
      assert.equal(hasHeaderControls(id), true, `${id}: every Header Customization control`);
      assert.ok(templateDesc(id).length > 20, `${id}: says what it draws`);
    }
  });

  it('its own heading mark belongs to the heading style it brings; under another style it prints that style as every template does', async () => {
    const { sectionHeadingLook } = await loadModule('/src/templates/pdf/shared/sectionHeadingLook.js');
    const { templateStyleDefaults } = await loadModule('/src/constants/templates.js');
    const own = { gridline: 'framed', broadsheet: 'overline', registry: 'dotted', chronicle: 'double', linen: 'soft', keystone: 'edge', banded: 'bleed' };
    for (const id of DESIGNED) {
      const { headingStyle } = templateStyleDefaults(id);
      assert.equal(sectionHeadingLook({ template: id, headingStyle }).variant, own[id] ?? null, id);
      assert.equal(sectionHeadingLook({ template: id, headingStyle: 'plain' }).variant, null, `${id} under Plain`);
      assert.equal(sectionHeadingLook({ template: 'classic', headingStyle }).variant, null, `Classic under ${headingStyle}`);
    }
  });
});

describe('each designed layout draws its own marks (R2-138 B2)', () => {
  it('Gridline: a hairline over the name and one under the header, and each title between two', async () => {
    const r = await demo('gridline');
    const p = await page1(r);
    const { gridHairlineColor, GRID_HAIRLINE } = await loadModule('/src/templates/pdf/shared/designedMarks.js');
    const lines = across(inColour(p.marks, gridHairlineColor(r.settings.accentColor)), p).filter((m) => near(m.y1 - m.y0, GRID_HAIRLINE, 0.3));
    assert.ok(lines.some((m) => m.y0 > p.name.y + 10), 'a hairline over the name');
    const titles = titleItems(p.items, ['PROFESSIONAL EXPERIENCE', 'SKILLS']);
    assert.equal(titles.length, 2);
    for (const t of titles) {
      const rules = across(inColour(p.marks, gridHairlineColor(r.settings.accentColor)), p).filter((m) => Math.abs((m.y0 + m.y1) / 2 - t.y) < 16);
      assert.ok(rules.some((m) => m.y0 > t.y) && rules.some((m) => m.y1 < t.y), `${t.str}: a hairline over it and one under it (${JSON.stringify(rules.map((m) => m.y0))} around ${t.y})`);
    }
    assert.ok(lines.filter((m) => m.y1 < p.name.y && m.y0 > titles[0].y + 15).length === 1, 'one under the header, over the first title');
  });

  it('Registry: a solid bar across the column over the name; each title over a dotted rule', async () => {
    const r = await demo('registry');
    const p = await page1(r);
    const { REGISTRY_BAR } = await loadModule('/src/templates/pdf/shared/designedMarks.js');
    const bar = across(inColour(p.marks, r.settings.accentColor), p).filter((m) => m.paint === 'fill' && near(m.y1 - m.y0, REGISTRY_BAR, 0.3));
    assert.equal(bar.length, 1, 'one bar');
    assert.ok(bar[0].y0 > p.name.y, 'over the name');
    const dotted = inColour(p.marks, r.settings.accentColor).filter((m) => m.paint === 'stroke' && m.dash?.length);
    assert.ok(dotted.length >= 2, `a dotted rule under each title on the page: ${dotted.length}`);
  });

  it('Bookend: heavy rules over the name and under the header; a thin one along the foot of every page', async () => {
    const r = await demo('bookend');
    const p = await page1(r);
    const { BOOKEND_RULE, BOOKEND_FOOT } = await loadModule('/src/templates/pdf/shared/designedMarks.js');
    const heavy = across(inColour(p.marks, r.settings.accentColor), p).filter((m) => near(m.y1 - m.y0, BOOKEND_RULE, 0.3));
    assert.equal(heavy.length, 2, 'two heavy rules');
    assert.ok(heavy.some((m) => m.y0 > p.name.y) && heavy.some((m) => m.y1 < p.name.y - 40), 'one over the name, one under the header');
    const bottomMargin = (r.settings.marginV ?? 14) * MM;
    for (const pageNo of [1, 2]) {
      const foot = across(inColour(await painted(p.bytes, pageNo), r.settings.accentColor), p).filter((m) => near(m.y1 - m.y0, BOOKEND_FOOT, 0.3));
      assert.equal(foot.length, 1, `page ${pageNo}: the foot's rule`);
      assert.ok(foot[0].y1 < bottomMargin, `page ${pageNo}: in the bottom margin`);
    }
  });

  it('Lectern: the name on the centre line over a short centred rule; each title centred between two rules', async () => {
    const r = await demo('lectern');
    const p = await page1(r);
    const mid = p.width / 2;
    assert.ok(near(p.name.x + p.name.w / 2, mid, 1), `the name centred: ${p.name.x + p.name.w / 2} vs ${mid}`);
    const { LECTERN_RULE } = await loadModule('/src/templates/pdf/shared/designedMarks.js');
    const stand = inColour(p.marks, r.settings.accentColor).filter((m) => near(m.x1 - m.x0, LECTERN_RULE.width, 0.5) && near(m.y1 - m.y0, LECTERN_RULE.height, 0.3));
    assert.equal(stand.length, 1, 'the short rule');
    assert.ok(near((stand[0].x0 + stand[0].x1) / 2, mid, 1), 'centred');
    for (const t of titleItems(p.items, ['PROFESSIONAL EXPERIENCE', 'SKILLS'])) {
      assert.ok(near(t.x + t.w / 2, mid, 2), `${t.str} centred`);
      const beside = inColour(p.marks, r.settings.accentColor).filter((m) => Math.abs((m.y0 + m.y1) / 2 - (t.y + t.h * 0.3)) < 6);
      assert.ok(beside.some((m) => m.x1 < t.x) && beside.some((m) => m.x0 > t.x + t.w), `${t.str}: a rule on each side`);
    }
  });

  it('Chronicle: PT Serif; a thick rule over a thin one under the header; each title on a double rule', async () => {
    const r = await demo('chronicle');
    const p = await page1(r);
    assert.match(p.name.font, /PT.?Serif/i, `the name in PT Serif: ${p.name.font}`);
    const { CHRONICLE_RULES } = await loadModule('/src/templates/pdf/shared/designedMarks.js');
    const fills = across(inColour(p.marks, r.settings.accentColor), p).filter((m) => m.paint === 'fill');
    const thick = fills.find((m) => near(m.y1 - m.y0, CHRONICLE_RULES.thick, 0.3));
    const thin = fills.find((m) => near(m.y1 - m.y0, CHRONICLE_RULES.thin, 0.3));
    assert.ok(thick && thin && thick.y0 > thin.y1 && near(thick.y0 - thin.y1, CHRONICLE_RULES.gap, 0.3), 'the thick rule, the gap, the thin rule');
    const t = titleItems(p.items, ['PROFESSIONAL EXPERIENCE'])[0];
    const under = across(inColour(p.marks, r.settings.accentColor), p).filter((m) => m.paint === 'stroke' && m.y0 < t.y && m.y0 > t.y - 12);
    assert.equal(under.length, 2, 'two rules under the title');
  });

  it('Keystone: a wedge wider at its top beside the name; each title boxed with an accent edge', async () => {
    const r = await demo('keystone');
    const p = await page1(r);
    const { KEYSTONE_WEDGE } = await loadModule('/src/templates/pdf/shared/designedMarks.js');
    const wedge = inColour(p.marks, r.settings.accentColor).filter((m) => m.paint === 'fill' && near(m.x1 - m.x0, KEYSTONE_WEDGE.width, 0.5) && near(m.y1 - m.y0, KEYSTONE_WEDGE.height, 0.5));
    assert.equal(wedge.length, 1, 'the wedge');
    assert.ok(wedge[0].x1 < p.name.x && near(wedge[0].x0, p.left, 0.5), 'at the margin, left of the name');
    assert.ok(wedge[0].y1 > p.name.y && wedge[0].y0 < p.name.y, 'on the name\'s row');
    const edges = inColour(p.marks, r.settings.accentColor).filter((m) => m.paint === 'stroke' && m.width === 3 && near(m.x0, p.left, 0.5));
    assert.ok(edges.length >= 2, `an edge on each boxed title: ${edges.length}`);
  });

  it('Banded: the header on a pale band from the paper\'s top and side edges; each title on a band across the paper', async () => {
    const r = await demo('banded');
    const p = await page1(r);
    const { bandedGround } = await loadModule('/src/templates/pdf/shared/designedMarks.js');
    const band = inColour(p.marks, bandedGround(r.settings.accentColor)).filter((m) => near(m.x0, 0) && near(m.x1, p.width) && near(m.y1, p.height));
    assert.equal(band.length, 1, 'the band');
    assert.ok(band[0].y0 < p.name.y - 30, 'under the name and contacts');
    const t = titleItems(p.items, ['PROFESSIONAL EXPERIENCE'])[0];
    const bands = p.marks.filter((m) => m.paint === 'fill' && near(m.x0, 0) && near(m.x1, p.width) && m.y0 < t.y && m.y1 > t.y);
    assert.ok(bands.length >= 1, 'the title on a band to the edges');
    assert.ok(near(t.x, p.left, 0.5), 'the title on the margin');
  });

  it('Keel: an accent bar down the header\'s left side, the name set off it; titles with a bar of their own', async () => {
    const r = await demo('keel');
    const p = await page1(r);
    const { KEEL_BAR, KEEL_PAD } = await loadModule('/src/templates/pdf/shared/designedMarks.js');
    const keel = inColour(p.marks, r.settings.accentColor).filter((m) => m.paint === 'stroke' && m.width === KEEL_BAR && near(m.x0, p.left, 0.5));
    assert.equal(keel.length, 1, 'the keel');
    assert.ok(keel[0].y1 > p.name.y && keel[0].y0 < p.name.y - 40, 'down the name, title and contacts');
    assert.ok(near(p.name.x, p.left + KEEL_BAR + KEEL_PAD, 0.5), `the name set off it: ${p.name.x}`);
  });

  it('Linen: Lato; a short stitch over the name; title-case titles underlined only as far as they run', async () => {
    const r = await demo('linen');
    const p = await page1(r);
    assert.match(p.name.font, /Lato/i, `the name in Lato: ${p.name.font}`);
    const { LINEN_STITCH } = await loadModule('/src/templates/pdf/shared/designedMarks.js');
    const stitch = inColour(p.marks, r.settings.accentColor).filter((m) => m.paint === 'fill' && near(m.x1 - m.x0, LINEN_STITCH.width, 0.5));
    assert.equal(stitch.length, 1, 'the stitch');
    assert.ok(stitch[0].y0 > p.name.y, 'over the name');
    const t = titleItems(p.items, ['Professional Experience'])[0];
    assert.ok(t, 'the title in title case');
    const under = inColour(p.marks, r.settings.accentColor).filter((m) => m.paint === 'stroke' && m.y0 < t.y && m.y0 > t.y - 12);
    assert.equal(under.length, 1, 'its underline');
    assert.ok(near(under[0].x1, t.x + t.w, 3), `as long as the title: ${under[0].x1} vs ${t.x + t.w}`);
  });

  it('Broadsheet: a headline name over a heavy rule in the Text colour; a rule over each title', async () => {
    const r = await demo('broadsheet');
    const p = await page1(r);
    assert.ok(p.name.h >= 24, `a headline name: ${p.name.h} pt`);
    const { BROADSHEET_RULE } = await loadModule('/src/templates/pdf/shared/designedMarks.js');
    const heavy = across(inColour(p.marks, r.settings.textColor), p).filter((m) => near(m.y1 - m.y0, BROADSHEET_RULE, 0.3));
    assert.equal(heavy.length, 1, 'the heavy rule');
    const title = p.items.find((i) => i.str === r.personal.title);
    assert.ok(heavy[0].y1 < p.name.y && heavy[0].y0 > title.y, 'between the name and the job title');
    for (const t of titleItems(p.items, ['PROFESSIONAL EXPERIENCE', 'SKILLS'])) {
      const over = across(inColour(p.marks, r.settings.accentColor), p).filter((m) => m.y0 > t.y && m.y0 < t.y + 20);
      assert.equal(over.length, 1, `${t.str}: a rule over it`);
      assert.ok(near(over[0].y1 - over[0].y0, 2, 0.3), `${t.str}: the Border thickness Broadsheet brings`);
    }
  });
});

describe('the marks are never text: each page reads word for word as Classic\'s with the same settings (R2-138 B2)', () => {
  const words = (pages) => withoutRunningHeaders(pages).flatMap((p) => p.items.map((i) => i.str)).join(' ').split(/\s+/).filter(Boolean);
  for (const id of DESIGNED) {
    it(id, async () => {
      const r = await demo(id);
      const classic = structuredClone(r);
      classic.template = 'classic';
      // Each section as the layout resolves it (Registry's and Broadsheet's role-first jobs), stored, so Classic prints it so too.
      const { resolveSection } = await loadModule('/src/templates/pdf/shared/templateSectionDefaults.js');
      classic.sections = classic.sections.map((s) => resolveSection(s, id));
      assert.deepEqual(words(await read(await render(r))), words(await read(await render(classic))));
    });
  }
});

describe('each designed layout\'s cover letter closes its letterhead on its résumé\'s mark (R2-138 B2)', () => {
  for (const id of DESIGNED) {
    it(id, async () => {
      const r = await demo(id);
      const { resolveTemplateSettings } = await loadModule('/src/templates/pdf/shared/templateSettings.js');
      const { letterheadLook } = await loadModule('/src/templates/pdf/shared/letterhead.js');
      const look = letterheadLook(id, resolveTemplateSettings(r.settings, id));
      assert.equal(look.look, id);
      const marks = (await painted(await renderCover(r))).filter((m) => m.paint === 'fill' || m.paint === 'stroke');
      if (id === 'banded') {
        assert.deepEqual(look.rules, []);
        const [p] = await read(await renderCover(r));
        assert.ok(inColour(marks, look.band.color).some((m) => near(m.x0, 0) && near(m.x1, p.W)), 'the band, to the paper\'s edges');
        return;
      }
      assert.ok(look.rules.length >= 1, 'its mark as a rule');
      for (const rule of look.rules) {
        assert.ok(inColour(marks, rule.color).some((m) => m.x1 - m.x0 > 400), `a rule in ${rule.color}, ${rule.width} pt, across the letterhead`);
      }
    });
  }
});
