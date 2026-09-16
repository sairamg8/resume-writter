// Template headers: the header rule and the header controls, checked on real PDFs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, read, drawState, loadModule, TEMPLATES } from './harness.mjs';
import { drawing, painted } from './extractors.mjs';

before(setup);
after(teardown);

const ACCENT = '#e11d48';
const PERSONAL = {
  email: 'alex@example.com', phone: '+1 555 0100', location: 'San Francisco, CA',
  website: 'alexjohnson.dev', linkedin: 'linkedin.com/in/alexj', github: 'github.com/alexj',
  summary: '<p>An experienced engineer.</p>',
};

const pageOf = async (template, settings) =>
  drawing(await render(resume({ template, personal: PERSONAL, settings: { accentColor: ACCENT, ...settings } })));
const drawnCache = new Map();
/**
 * Page 1 of a résumé with PERSONAL, drawn once per template and settings. The key keeps an
 * undefined setting: { showHeaderBorder: undefined } unsets the new résumé's `false`.
 */
const drawn = (template, settings) => {
  const key = `${template} ${JSON.stringify(settings, (_, v) => (v === undefined ? '(unset)' : v))}`;
  if (!drawnCache.has(key)) drawnCache.set(key, pageOf(template, settings));
  return drawnCache.get(key);
};

/**
 * The controls Header Customization shows for Classic, Minimal and Executive and hides for
 * Modern and Sidebar, as [label, settings it starts from, settings the control sets].
 */
const HEADER_CONTROLS = [
  ['Text Alignment: Center', {}, { headerAlign: 'center' }],
  ['Name & Title Layout: Inline', {}, { headerLayout: 'inline' }],
  ['Name & Title Spacing', { headerLayout: 'inline' }, { headerLayout: 'inline', headerInlineGap: 24 }],
  ['Header Bottom Border', { showHeaderBorder: false }, { showHeaderBorder: true }],
  ['Border Thickness', { showHeaderBorder: true }, { showHeaderBorder: true, headerBorderWidth: 6 }],
  ['Contact Layout: Single', {}, { contactLayout: 'single' }],
  ['Contact Layout: 2 Grid', {}, { contactLayout: '2grid' }],
  ['Contact Style: Bullet', {}, { contactStyle: 'bullet' }],
  ['Contact Style: Bar', {}, { contactStyle: 'bar' }],
];
/** Its icon controls, which the Design panel offers for every template too. */
const ICON_CONTROLS = [
  ['Icon set: Classic', {}, { iconSet: 'lucide' }],
  ['Icon size', {}, { iconSize: 16 }],
];
const changing = async (template, controls) => {
  const out = [];
  for (const [label, from, to] of controls) if (await drawn(template, from) !== await drawn(template, to)) out.push(label);
  return out;
};

describe('header controls', () => {
  // The comparison's soundness check, not a fix's proof: the same résumé twice must draw the
  // same page, or every control below would seem to change it. (pdf.js names fonts per
  // document — g_d0_f1, g_d2_f1 — which drawing() makes neutral.)
  it('a résumé rendered twice draws the same page (the comparison below is sound)', async () => {
    assert.equal(await pageOf('executive', {}), await pageOf('executive', {}));
  });

  // FIDA-50: the editor hid these controls for Executive, whose PDF honours every one; FIDA-20:
  // it offered the rule for Minimal, whose PDF ignored it. hasHeaderControls() decides what the
  // editor shows, and this pins it to the PDF: it fails if Executive's controls are hidden again
  // or a template shows one its PDF ignores.
  for (const template of TEMPLATES) {
    it(`${template}: Header Customization shows its controls exactly where each one changes the PDF (FIDA-50, FIDA-20)`, async () => {
      const { hasHeaderControls } = await loadModule('/src/constants/templates.js');
      const shown = hasHeaderControls(template);
      const all = HEADER_CONTROLS.map(([label]) => label);
      assert.deepEqual(await changing(template, HEADER_CONTROLS), shown ? all : [],
        shown ? `controls with no effect on the ${template} PDF` : `the ${template} PDF honours controls the editor hides`);
      assert.deepEqual(await changing(template, ICON_CONTROLS), ICON_CONTROLS.map(([label]) => label), 'icon set and size');
    });
  }

  // R3-12: the list above had two of the five packs. Every chip against every other: a pack
  // mapped to another (as 0ac42b6 fixed) draws a page it shares. 09-contact-icons checks that
  // each draws its own shapes.
  it('each icon set the chips offer draws a page of its own', async () => {
    const { ICON_SET_OPTIONS } = await loadModule('/src/utils/contactIcons.jsx');
    for (const template of ['classic', 'minimal', 'executive']) {
      const pages = await Promise.all(ICON_SET_OPTIONS.map(({ id }) => drawn(template, { iconSet: id })));
      assert.equal(new Set(pages).size, ICON_SET_OPTIONS.length, `${template}: ${ICON_SET_OPTIONS.map(({ id }) => id)}`);
    }
  });
});

/** Does the header print its accent rule? No sections and no contacts: the rule is the only accent stroke. */
async function headerRule(template, settings) {
  const pages = await read(await render(resume({ template, settings: { accentColor: ACCENT, ...settings } })));
  return pages[0].strokes.has(ACCENT);
}

/**
 * How thick page 1 prints its accent rule, in pt: react-pdf strokes a border at twice its width
 * and clips it to the box, so half the stroke's line width. [] without a rule.
 */
async function ruleThickness(template, settings) {
  const bytes = await render(resume({ template, settings: { accentColor: ACCENT, showHeaderBorder: true, ...settings } }));
  return [...new Set((await painted(bytes)).filter((p) => p.paint === 'stroke' && p.colour === ACCENT).map((p) => p.width))];
}

describe('header rule', () => {
  it('executive: no rule unless the toggle turns it on — not for older résumés without the setting (FIDA-18)', async () => {
    assert.equal(await headerRule('executive', { showHeaderBorder: undefined }), false, 'unset');
    assert.equal(await headerRule('executive', { showHeaderBorder: false }), false, 'off');
    assert.equal(await headerRule('executive', { showHeaderBorder: true }), true, 'on');
  });

  it('minimal: the Header Bottom Border toggle draws the rule; unset stays off (FIDA-20)', async () => {
    assert.equal(await headerRule('minimal', { showHeaderBorder: undefined }), false, 'unset');
    assert.equal(await headerRule('minimal', { showHeaderBorder: false }), false, 'off');
    assert.equal(await headerRule('minimal', { showHeaderBorder: true }), true, 'on');
  });

  // Guard: Classic drew its rule for an unset setting before FIDA-18 too; the fix must keep it.
  it('classic: an unset setting keeps the rule (the Classic design), the toggle still turns it off', async () => {
    assert.equal(await headerRule('classic', { showHeaderBorder: undefined }), true, 'unset');
    assert.equal(await headerRule('classic', { showHeaderBorder: false }), false, 'off');
  });

  // R3-7: the Thickness box said "px", but the value prints as points. The label says "pt" now
  // (Cypress 16-headers); this guard pins the unit — the PDF is unchanged, so a saved value prints
  // as it always has.
  it('Thickness prints in points, as its label says: a stored 1, 2, 6 or 12 is a rule that many pt thick', async () => {
    for (const template of ['classic', 'minimal', 'executive']) {
      for (const headerBorderWidth of [1, 2, 6, 12]) {
        assert.deepEqual(await ruleThickness(template, { headerBorderWidth }), [headerBorderWidth], `${template} ${headerBorderWidth}`);
      }
      assert.deepEqual(await ruleThickness(template, { headerBorderWidth: undefined }), [2], `${template}: unset is 2 pt`);
    }
  });
});

describe('unknown template ids (M15)', () => {
  it('a template id the app does not offer (the old seed\'s "dark", an import\'s) prints exactly as Classic', async () => {
    for (const settings of [{ showHeaderBorder: undefined }, { showHeaderBorder: false }, { headerAlign: 'center' }]) {
      const classic = await drawn('classic', settings);
      for (const template of ['dark', 'aurora', '']) {
        assert.equal(await drawn(template, settings), classic, `${template} with ${JSON.stringify(settings)}`);
      }
    }
  });
});

describe('modern banner summary (FIDB-11)', () => {
  const SUMMARY = '<p>SumPlain <strong>SumBold</strong></p><ul><li>SumItem</li></ul>';

  it('prints at 85% of the header text colour, however the colour is written', async () => {
    // A dark one on a light accent, where it reads: on the new résumé's dark banner it prints a
    // readable tint (34-modern-banner-text, ONB-1).
    const cases = [
      ['#ffffff', '#ffffff'], ['#fff', '#ffffff'], ['#FFF', '#ffffff'], ['#FFFFFF', '#ffffff'], ['white', '#ffffff'],
      ['rgb(255,255,255)', '#ffffff'], ['#1e293b', '#1e293b', '#fde68a'], ['#F8FAFC', '#f8fafc'],
    ];
    for (const [headerTextColor, fill, accentColor] of cases) {
      const settings = accentColor ? { headerTextColor, accentColor } : { headerTextColor };
      const bytes = await render(resume({ template: 'modern', personal: { summary: SUMMARY }, settings }));
      for (const word of ['SumPlain', 'SumBold', 'SumItem']) {
        const hits = await drawState(bytes, word);
        assert.equal(hits.length, 1, `${headerTextColor}: "${word}" drawn once`);
        assert.equal(hits[0].fill, fill, `${headerTextColor}: "${word}" in the header text colour`);
        assert.ok(Math.abs(hits[0].alpha - 0.85) < 0.005, `${headerTextColor}: "${word}" at alpha ${hits[0].alpha}`);
      }
    }
  });

  it('a header text colour with its own alpha keeps it, times 85% (as CSS opacity would)', async () => {
    const bytes = await render(resume({ template: 'modern', personal: { summary: SUMMARY }, settings: { headerTextColor: 'rgba(255,255,255,0.5)' } }));
    const [hit] = await drawState(bytes, 'SumPlain');
    assert.ok(Math.abs(hit.alpha - 0.425) < 0.005, `alpha ${hit.alpha}`);
  });
});

describe('modern banner job title', () => {
  // react-pdf's opacity replaces a colour's own alpha; the title's 90 % must multiply it (R5-9).
  it('prints at 90 % of its colour\'s own alpha, on the résumé and on its letter', async () => {
    // A header text colour at 60 % (a fully transparent one does not read on the banner, and prints
    // a readable tint: 34-modern-banner-text, ONB-1).
    const cases = [[{}, 0.9], [{ jobTitleColor: 'rgba(255,255,255,0.5)' }, 0.45], [{ headerTextColor: 'rgba(255,255,255,0.6)' }, 0.54]];
    for (const [settings, alpha] of cases) {
      const r = resume({ template: 'modern', personal: { title: 'Staff Engineer' }, settings });
      for (const [what, bytes] of [['résumé', await render(r)], ['letter', await renderCover(r)]]) {
        const [hit] = await drawState(bytes, 'Staff Engineer');
        assert.ok(Math.abs(hit.alpha - alpha) < 0.005, `${what} ${JSON.stringify(settings)}: alpha ${hit.alpha}, expected ${alpha}`);
      }
    }
  });
});

describe('modern banner name (R7-0)', () => {
  // The name sits on the accent banner with the title and the contacts. It prints in the header
  // text colour as they do, never in a colour worked out against the Sidebar Background, which
  // Modern does not draw (a value that survives from a Sidebar design, or the default navy).
  it('prints in the header text colour, like the title and contacts, whatever Sidebar Background is stored', async () => {
    const cases = [
      [{ accentColor: '#fde68a', headerTextColor: '#111111' }, '#111111'],
      [{ sidebarBg: '#ffffff' }, '#ffffff'],
      [{ sidebarBg: '#f8fafc', headerTextColor: '#fef3c7' }, '#fef3c7'],
    ];
    const personal = { name: 'Pat Sample', title: 'Staff Engineer', email: 'pat@example.com' };
    for (const [settings, ink] of cases) {
      const r = resume({ template: 'modern', personal, settings });
      for (const [what, bytes] of [['résumé', await render(r)], ['letter', await renderCover(r)]]) {
        for (const s of ['Pat Sample', 'Staff Engineer', 'pat@example.com']) {
          assert.equal((await drawState(bytes, s))[0]?.fill, ink, `${what} ${JSON.stringify(settings)}: "${s}"`);
        }
      }
    }
  });
});
