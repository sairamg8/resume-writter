// T8 — the Academic template beyond its résumé page: the cover letter's letterhead in its look (the
// centred name over the position in italic, over the hairline its section titles print on — or the
// résumé's own header rule where that is on; letterhead.js LOOKS.academic), the Word files (the position
// in italic, the letter's hairline as a bottom border), what picking it brings (its type, header and
// spacing, TEMPLATES.academic.style — and never a reordering of the résumé's sections), and the
// Academic CV starter, whose sections open with education and publications (starterAcademic.js).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, renderCover, renderDocx, read, allText, allItems, loadModule, readDocx } from './harness.mjs';
import { painted } from './extractors.mjs';

before(setup);
after(teardown);

const ACCENT = '#7f1d1d';
const PERSONAL = { name: 'Maya Okafor', title: 'Research Fellow', email: 'maya@example.edu', phone: '+1 555 0171', hiddenFields: [] };
const make = (settings = {}) => resume({
  template: 'academic', settings: { accentColor: ACCENT, font: 'notosans', ...settings }, personal: PERSONAL,
  sections: [experience([{ description: '<p>Did things</p>' }])], coverLetter: { body: '<p>Dear Sarah,</p>', date: '2026-01-15' },
});
const item = (pages, str) => allItems(pages).find((i) => i.str === str);
/** Page 1's rules: fills or strokes wider than 400 pt and under 1.5 pt tall, as "colour/height". */
const rules = async (bytes) => (await painted(bytes))
  .filter((p) => (p.paint === 'stroke' || p.paint === 'fill') && p.x1 - p.x0 > 400 && p.y1 - p.y0 < 1.5 && p.colour !== '#ffffff')
  .map((p) => `${p.colour}/${p.paint === 'stroke' ? p.width : +(p.y1 - p.y0).toFixed(2)}`);

describe('the letterhead in Academic\'s look (T8)', () => {
  it('the name and position centred, the position in italic; under them the 0.75 pt hairline in its titles\' tone', async () => {
    const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const bytes = await renderCover(make());
    const pages = await read(bytes);
    for (const s of ['Maya Okafor', 'Research Fellow']) {
      const i = item(pages, s);
      assert.ok(Math.abs(i.x + i.w / 2 - pages[0].W / 2) < 0.5, `${s}: centred`);
    }
    assert.match(item(pages, 'Research Fellow').font, /Italic/);
    assert.deepEqual(await rules(bytes), [`${solid(ACCENT, 0.55)}/0.75`]);
  });

  it('Header Bottom Border on: the letter draws the résumé\'s rule, at its Thickness, instead of the hairline; Border color tints the hairline', async () => {
    const on = await rules(await renderCover(make({ showHeaderBorder: true, headerBorderWidth: 3 })));
    assert.deepEqual(on, [`${ACCENT}/3`]);
    const page = await rules(await render(make({ showHeaderBorder: true, headerBorderWidth: 3 })));
    assert.deepEqual(page.filter((r) => r.startsWith(ACCENT)), [`${ACCENT}/3`], `the résumé draws the same (its title's hairline aside): ${page}`);
    assert.deepEqual(await rules(await renderCover(make({ sectionBorderColor: '#0f766e' }))), ['#0f766e/0.75']);
  });

  it('Left: the letterhead on the left margin, as the résumé\'s header', async () => {
    const [page] = await read(await renderCover(make({ headerAlign: 'left' })));
    assert.ok(item([page], 'Maya Okafor').x < 60, 'the name on the left');
  });
});

describe('the Word files: the position in italic (T8)', () => {
  it('the résumé\'s header prints the job title in italic, the name not', async () => {
    const { paragraphs } = await renderDocx(make());
    const runOf = (text) => paragraphs.map((p) => p.xml.split('</w:r>').find((r) => r.includes(`>${text}<`))).find(Boolean) || '';
    assert.match(runOf('Research Fellow'), /<w:i\/>/);
    assert.doesNotMatch(runOf('Maya Okafor'), /<w:i\/>/);
    const classic = await renderDocx({ ...make(), template: 'classic' });
    const classicRun = classic.paragraphs.map((p) => p.xml.split('</w:r>').find((r) => r.includes('>Research Fellow<'))).find(Boolean) || '';
    assert.doesNotMatch(classicRun, /<w:i\/>/, 'Classic\'s title stays upright');
  });

  it('the letter\'s letterhead: the title in italic, the hairline as its bottom border', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const doc = readDocx(new Uint8Array(await (await renderCoverLetterDocx(make())).arrayBuffer()));
    const title = doc.paragraphs.find((p) => p.text === 'Research Fellow');
    assert.match(title.xml, /<w:i\/>/);
    assert.match(doc.xml, new RegExp(`<w:bottom [^>]*w:color="${solid(ACCENT, 0.55).slice(1)}"`, 'i'), 'the hairline under the letterhead');
    assert.match(doc.paragraphs.find((p) => p.text === 'Maya Okafor').xml, /<w:jc w:val="center"\/>/, 'centred');
  });
});

describe('picking Academic brings its type, header and spacing, and never reorders the sections (T8)', () => {
  it('the store\'s switch sets the style; the sections stay in the résumé\'s order', async () => {
    const { templateStyleDefaults } = await loadModule('/src/constants/templates.js');
    const { headerColorsOnSwitch } = await loadModule('/src/templates/pdf/shared/headerColors.js');
    const { styleOnSwitch } = await loadModule('/src/utils/defaultData.js');
    const r = resume({ template: 'classic', sections: [experience([{}]), { ...experience([{}]), id: 'edu', type: 'education', title: 'Education', items: [] }] });
    // useResumeStore.setTemplate: the template's style over the résumé's settings, then the header colours.
    const settings = headerColorsOnSwitch(styleOnSwitch(r.settings, 'classic', 'academic'), 'classic', 'academic');
    for (const [k, v] of Object.entries(templateStyleDefaults('academic'))) assert.equal(settings[k], v, k);
    assert.deepEqual(r.sections.map((s) => s.type), ['experience', 'education'], 'the order is the résumé\'s');
    const pages = await read(await render({ ...r, template: 'academic', settings: { ...settings, font: 'notosans' } }));
    const text = allText(pages);
    assert.ok(text.indexOf('PROFESSIONAL EXPERIENCE') < text.indexOf('EDUCATION'), 'printed in that order');
  });

  it('switched away untouched, its type and spacing leave with it: every template then prints as one started on it; a font picked on Academic stays', async () => {
    const { styleOnSwitch, defaultSettings } = await loadModule('/src/utils/defaultData.js');
    const { TEMPLATE_IDS } = await loadModule('/src/constants/templates.js');
    for (const to of TEMPLATE_IDS) {
      assert.deepEqual(styleOnSwitch(defaultSettings('academic'), 'academic', to), defaultSettings(to), `academic → ${to}`);
      assert.deepEqual(styleOnSwitch(defaultSettings(to), to, 'academic'), defaultSettings('academic'), `${to} → academic`);
    }
    const tuned = { ...defaultSettings('academic'), font: 'inter', sectionGap: 20 };
    const classic = styleOnSwitch(tuned, 'academic', 'classic');
    assert.deepEqual([classic.font, classic.sectionGap, classic.headerAlign, classic.lineHeightValue], ['inter', 20, 'left', 1.5], 'the user\'s picks stay; Academic\'s own leave');
  });

  it('the Design panel says what picking it brought, under the picker, only on Academic', async () => {
    const { createElement } = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
    const html = (template) => renderToString(createElement(DesignPanel, { resume: { ...make(), template }, updateSetting: () => {}, setTemplate: () => {}, resetSettings: () => {} }));
    assert.match(html('academic'), /Academic brings its own type and spacing/);
    assert.doesNotMatch(html('classic'), /Academic brings its own type and spacing/);
  });
});

describe('the Academic CV starter: education and publications first (T8)', () => {
  it('a résumé made from it prints with Academic, its style, every section in its order, every section\'s facts', async () => {
    const { STARTER_TEMPLATES, buildResumeFromStarter } = await loadModule('/src/utils/starterTemplates.js');
    const { templateStyleDefaults } = await loadModule('/src/constants/templates.js');
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    assert.ok(STARTER_TEMPLATES.some((t) => t.id === 'academic-cv' && t.template === 'academic'), 'offered in the starter list');
    const r = normalizeResume(buildResumeFromStarter('academic-cv', 'r_academic'));
    assert.equal(r.template, 'academic');
    for (const [k, v] of Object.entries(templateStyleDefaults('academic'))) assert.equal(r.settings[k], v, k);
    assert.deepEqual(r.sections.map((s) => s.title), ['Education', 'Publications', 'Research Experience', 'Teaching', 'Grants & Awards', 'Invited Talks', 'Skills', 'References']);
    const text = allText(await read(await render({ ...r, settings: { ...r.settings, font: 'notosans' } })));
    const order = ['EDUCATION', 'PUBLICATIONS', 'RESEARCH EXPERIENCE', 'TEACHING', 'GRANTS & AWARDS', 'INVITED TALKS', 'SKILLS', 'REFERENCES'].map((t) => text.indexOf(t));
    assert.ok(order.every((at, k) => at >= 0 && (k === 0 || at > order[k - 1])), `the titles in order: ${order}`);
    for (const fact of ['Ph.D. in Computational Biology', 'Nature Methods, 21(4)', 'Postdoctoral Research Fellow', 'Broadview Institute for Genomics',
      'Introduction to Bioinformatics', 'Best Student Paper', 'Single-Cell Genomics Symposium', 'Prof. Lena Hart']) {
      assert.ok(text.includes(fact), `${fact} in: ${text}`);
    }
  });
});
