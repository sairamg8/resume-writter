// R2-147 (section icons) — Design → Section Headings → Icons (settings.sectionIcons): On prints a small
// icon, one per section type, just before every section title in the PDF (= the preview) on every
// template — both of the Sidebar's columns, its Single · ATS-safe layout, every heading style — in the
// title's colour, about its size, on its line; the title's words print as they did. Off, or unset,
// prints exactly the drawing every résumé printed before. Word, Markdown and ATS text keep the words
// alone: the same text on and off. No title printed an icon, whatever a résumé wanted.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, section, render, renderDocx, loadModule, TEMPLATES } from './harness.mjs';
import { snapshot } from './parity/measure.mjs';
import { headingIcon } from './parity/marks.mjs';

before(setup);
after(teardown);

/** Short sections, so every template prints them on one page: the text compares whole. */
const SECTIONS = [
  ['experience', { company: 'Quillmark', role: 'Kilnwright', startDate: '01/2020', endDate: '12/2022' }],
  ['education', { institution: 'Brackenridge', degree: 'BSc Physics', startDate: '2014', endDate: '2018' }],
  ['skills', { category: 'Tools', skills: 'Zephyrscript, Git' }],
  ['languages', { language: 'Occitan', proficiency: 'Native' }],
  ['certifications', { name: 'Glacierwatch', issuer: 'Snowline Board', date: '03/2021' }],
  ['custom', { title: 'Stargazer', subtitle: 'Orrery Club', date: '2020' }],
];

/** A résumé on `template`; `icons` undefined stores no sectionIcons at all, as every résumé before R2-147. */
function cv(template, icons, settings = {}, sectionSettings = {}) {
  const r = resume({
    template,
    settings,
    personal: { name: 'Wren Calloway', title: 'Surveyor', email: 'wren@example.com', summary: '<p>Maps quiet coastlines.</p>' },
    sections: SECTIONS.map(([type, entry]) => section(type, [entry], sectionSettings)),
  });
  if (icons === undefined) delete r.settings.sectionIcons;
  else r.settings.sectionIcons = icons;
  return r;
}

const shot = async (r) => snapshot(await render(r));

/** Every section title `r` prints, as runs (any page), in the order of its sections. */
function titles(snap, r) {
  const all = snap.pages.flatMap((p) => p.items);
  return r.sections.map((s) => all.find((t) => t.str.trim().toLowerCase() === s.title.trim().toLowerCase()) || { missing: s.title });
}

/** The failures of `on` against `off`: a title missing, one without its icon, or one its icon does not fit. */
function iconFailures(label, r, on, off) {
  const out = [];
  for (const t of titles(on, r)) {
    if (t.missing) { out.push(`${label}: "${t.missing}" does not print`); continue; }
    const icon = headingIcon(on, t);
    const name = t.str.trim();
    if (!icon) { out.push(`${label}: no icon before "${name}"`); continue; }
    if (icon.size < t.h * 0.5 || icon.size > t.h * 1.3) out.push(`${label}: "${name}"'s icon is ${icon.size.toFixed(1)} pt, its title ${t.h.toFixed(1)} pt`);
    if (icon.gap < 0 || icon.gap > t.h) out.push(`${label}: "${name}"'s icon is ${icon.gap.toFixed(1)} pt from it`);
    if (icon.mid < -t.h * 0.2 || icon.mid > t.h * 0.9) out.push(`${label}: "${name}"'s icon is off its line`);
  }
  for (const t of titles(off, r)) if (!t.missing && headingIcon(off, t)) out.push(`${label}: off, an icon prints before "${t.str.trim()}"`);
  if (on.text !== off.text) out.push(`${label}: the text changed — ${on.text.slice(0, 120)} / ${off.text.slice(0, 120)}`);
  return out;
}

const VARIANTS = [...TEMPLATES.map((template) => [template, {}]), ['sidebar', { sidebarSingleColumn: true }]];

describe('Design → Section Headings → Icons prints an icon before every section title (R2-147)', () => {
  it('off: an explicit false prints the very drawing no setting prints, on every template', async () => {
    const wrong = [];
    for (const [template, settings] of VARIANTS) {
      const [unset, off] = [await shot(cv(template, undefined, settings)), await shot(cv(template, false, settings))];
      if (unset.drawing !== off.drawing) wrong.push(`${template}${settings.sidebarSingleColumn ? ' (single)' : ''}`);
    }
    assert.deepEqual(wrong, []);
  });

  it('on: every template, both Sidebar columns and its single layout — an icon before each title, the text as it was', async () => {
    const wrong = [];
    for (const [template, settings] of VARIANTS) {
      const label = `${template}${settings.sidebarSingleColumn ? ' (single)' : ''}`;
      const r = cv(template, true, settings);
      wrong.push(...iconFailures(label, r, await shot(r), await shot(cv(template, false, settings))));
    }
    assert.deepEqual(wrong, []);
  });

  it('every heading style, left and centred, takes the icon (Classic; Banner\'s chip, Compact\'s short rule)', async () => {
    const wrong = [];
    for (const template of ['classic', 'banner', 'compact']) {
      for (const headingStyle of ['ruled', 'leftbar', 'line', 'underline', 'box', 'plain']) {
        for (const alignment of ['left', 'center']) {
          const label = `${template} ${headingStyle} ${alignment}`;
          const r = cv(template, true, { headingStyle }, { alignment });
          wrong.push(...iconFailures(label, r, await shot(r), await shot(cv(template, false, { headingStyle }, { alignment }))));
        }
      }
    }
    assert.deepEqual(wrong, []);
  });

  it('the icon is in the title\'s colour: Classic\'s accent, Banner\'s reversed out of its chip', async () => {
    const { sectionHeadingLook } = await loadModule('/src/templates/pdf/shared/sectionHeadingLook.js');
    for (const [template, headingStyle] of [['classic', 'line'], ['classic', 'ruled'], ['banner', 'box']]) {
      const accent = '#0f766e';
      const r = cv(template, true, { headingStyle, accentColor: accent });
      const snap = await shot(r);
      const want = sectionHeadingLook({ template, headingStyle, accent }).text.toLowerCase();
      for (const t of titles(snap, r)) assert.deepEqual(headingIcon(snap, t)?.colours, [want], `${template} ${headingStyle}: "${t.str}"`);
    }
  });

  it('each section type has its own icon, and a type with none of its own prints Custom\'s', async () => {
    const { sectionIconShapes, SECTION_ICON_TYPES } = await loadModule('/src/utils/sectionIconPaths.js');
    const types = ['experience', 'education', 'skills', 'projects', 'languages', 'certifications', 'awards', 'volunteering', 'references', 'interests', 'custom'];
    for (const type of types) assert.ok(SECTION_ICON_TYPES.includes(type), type);
    const drawn = types.map((type) => JSON.stringify(sectionIconShapes(type, '#000000')));
    assert.equal(new Set(drawn).size, types.length, 'eleven different icons');
    assert.equal(JSON.stringify(sectionIconShapes('publications', '#000000')), JSON.stringify(sectionIconShapes('custom', '#000000')));
  });

  it('Word, Markdown and ATS text print the same words on and off — no glyph is added to a title', async () => {
    const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    for (const template of ['classic', 'sidebar']) {
      const [on, off] = [cv(template, true), cv(template, false)];
      assert.deepEqual((await renderDocx(on)).texts, (await renderDocx(off)).texts, `${template}: Word`);
      assert.equal(generateMarkdownResume(on), generateMarkdownResume(off), `${template}: Markdown`);
      assert.equal(generateAtsPlainText(on), generateAtsPlainText(off), `${template}: ATS text`);
      assert.match(generateAtsPlainText(on), /EXPERIENCE/i, `${template}: the ATS text keeps its headings`);
    }
  });

  it('Design → Section Headings offers Off and On, and its ↺ and Reset Design Settings put Off back', async () => {
    const { HeadingControls } = await loadModule('/src/components/DesignPanelHeadings.jsx');
    const { sectionReset, defaultSettings } = await loadModule('/src/utils/defaultData.js');
    const html = renderToString(createElement(HeadingControls, { settings: { sectionIcons: true }, template: 'classic', updateSetting: () => {} }));
    assert.match(html, />Off<\/button>/);
    assert.match(html, /bg-blue-600[^>]*>On<\/button>/, 'On is marked');
    for (const template of TEMPLATES) {
      assert.equal(defaultSettings(template).sectionIcons, false, template);
      assert.equal(sectionReset(template, ['sectionIcons'], { sectionIcons: true }).sectionIcons, false, template);
    }
  });
});
