// T9 — the Compact template beyond its résumé page: the cover letter's letterhead in its look (the title on
// the name's line, over a 1 pt rule in its section titles' colour — or the résumé's own header rule where
// that is on; letterhead.js LOOKS.compact), the Word files, what picking it brings through the editor's own
// store (its type and spacing, TEMPLATES.compact.style, and the short sections' grid: sectionsOnSwitch —
// a Grids the user picked stays theirs, and switching back untouched prints what it printed before), a
// section added on it, the Design panel's note and heading sample, and the Compact one-pager starter.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, section, experience, render, renderCover, renderDocx, read, allText, allItems, loadModule, readDocx } from './harness.mjs';
import { drawing, painted } from './extractors.mjs';

before(setup);
after(teardown);

const ACCENT = '#155e75';
const PERSONAL = { name: 'Priya Natarajan', title: 'Platform Director', email: 'priya@example.com', phone: '+1 555 0188', hiddenFields: [] };
const make = (settings = {}, template = 'compact') => resume({
  template, settings: { accentColor: ACCENT, ...settings }, personal: PERSONAL,
  sections: [experience([{ description: '<p>Did things</p>' }])], coverLetter: { body: '<p>Dear Sarah,</p>', date: '2026-01-15' },
});
const item = (pages, str) => allItems(pages).find((i) => i.str === str);
/** Page 1's rules: fills or strokes wider than 400 pt and under 4 pt tall, as "colour/height". */
const rules = async (bytes) => (await painted(bytes))
  .filter((p) => (p.paint === 'stroke' || p.paint === 'fill') && p.x1 - p.x0 > 400 && p.y1 - p.y0 < 4 && p.colour !== '#ffffff')
  .map((p) => `${p.colour}/${p.paint === 'stroke' ? p.width : +(p.y1 - p.y0).toFixed(2)}`);

describe('the letterhead in Compact\'s look (T9)', () => {
  it('the title on the name\'s line, after it; under them a 1 pt rule in the accent; Stack puts the title under the name', async () => {
    const bytes = await renderCover(make());
    const pages = await read(bytes);
    const [name, title] = [item(pages, 'Priya Natarajan'), item(pages, 'Platform Director')];
    assert.ok(Math.abs(name.y - title.y) < 2 && title.x > name.x + name.w, 'one line');
    assert.deepEqual(await rules(bytes), [`${ACCENT}/1`]);
    const stacked = await read(await renderCover(make({ headerLayout: 'stack' })));
    assert.ok(item(stacked, 'Platform Director').y < item(stacked, 'Priya Natarajan').y - 10);
  });

  it('Header Bottom Border on: the résumé\'s rule at its Thickness instead; a picked Border color tints its own rule', async () => {
    assert.deepEqual(await rules(await renderCover(make({ showHeaderBorder: true, headerBorderWidth: 3 }))), [`${ACCENT}/3`]);
    assert.deepEqual(await rules(await renderCover(make({ sectionBorderColor: '#b45309' }))), ['#b45309/1']);
  });
});

describe('the Word files: the title on the name\'s line, the letter\'s rule as a bottom border (T9)', () => {
  it('the résumé\'s header prints the name and title in one paragraph; Stack in two', async () => {
    const line = (doc) => doc.texts.find((t) => t.includes('Priya Natarajan'));
    assert.match(line(await renderDocx(make())), /Priya Natarajan.*Platform Director/);
    assert.equal(line(await renderDocx(make({ headerLayout: 'stack' }))), 'Priya Natarajan');
  });

  it('the letter\'s letterhead: the name and title in one paragraph over a 1 pt accent bottom border', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const doc = readDocx(new Uint8Array(await (await renderCoverLetterDocx(make())).arrayBuffer()));
    assert.match(doc.texts[0], /Priya Natarajan.*Platform Director/);
    const border = /<w:bottom ([^>]*)\/>/.exec(doc.xml)?.[1] || '';
    assert.match(border, /w:sz="8"/, '1 pt');
    assert.match(border, new RegExp(`w:color="${ACCENT.slice(1)}"`, 'i'), 'the accent');
  });
});

/** The editor's own store over `saved` (one résumé), after `act(store)`: the résumé it leaves. */
async function afterStore(saved, act) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const map = new Map([['cpwtcv_v1', JSON.stringify({ resumes: [saved], activeId: saved.id })]]);
  globalThis.localStorage = {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
  let store = null;
  let done = false;
  function Probe() {
    store = useAppStore();
    if (!done) { done = true; act(store); }
    return null;
  }
  try {
    renderToString(createElement(Probe));
    return store.activeResume;
  } finally {
    delete globalThis.localStorage;
  }
}

const SKILLS = [{ category: 'Platform', skills: 'Kubernetes, Terraform' }, { category: 'Data', skills: 'Kafka, dbt' }];
const CERTS = [{ name: 'Kubernetes Administrator', issuer: 'CNCF', date: '11/2020' }, { name: 'FinOps Practitioner', issuer: 'FinOps', date: '09/2021' }];
const classicResume = () => resume({ template: 'classic', personal: PERSONAL, sections: [experience([{}]), section('skills', SKILLS), section('certifications', CERTS)] });
const sameRow = (pages, a, b) => Math.abs(item(pages, a).y - item(pages, b).y) < 1;

describe('picking Compact brings its style and lays the short sections out in its grid (T9)', () => {
  it('the store\'s switch sets its style and drops the Grids each section was created with: skills and certifications print two to a row', async () => {
    const { templateStyleDefaults } = await loadModule('/src/constants/templates.js');
    const r = await afterStore(classicResume(), (s) => s.setTemplate('compact'));
    for (const [k, v] of Object.entries(templateStyleDefaults('compact'))) assert.equal(r.settings[k], v, k);
    assert.deepEqual(r.sections.map((s) => s.settings.columns), [1, undefined, undefined], 'experience keeps its own; the short sections take Compact\'s');
    const pages = await read(await render(r));
    assert.ok(sameRow(pages, 'Platform:', 'Data:') && sameRow(pages, 'Kubernetes Administrator', 'FinOps Practitioner'), 'two to a row');
  });

  it('a Grids the user picked stays theirs; switched back untouched, the résumé prints what it printed on Classic', async () => {
    const picked = classicResume();
    picked.sections[1].settings.columns = 3;
    const r = await afterStore(picked, (s) => s.setTemplate('compact'));
    assert.equal(r.sections[1].settings.columns, 3, 'Grids 3 stays');
    const original = classicResume();
    const back = await afterStore(await afterStore(original, (s) => s.setTemplate('compact')), (s) => s.setTemplate('classic'));
    assert.equal(await drawing(await render(back)), await drawing(await render(original)), 'Classic → Compact → Classic prints as before');
  });

  it('a section added on Compact is in its grid; its type and spacing leave with it for every template, and come back', async () => {
    const r = await afterStore(resume({ template: 'compact', personal: PERSONAL, sections: [] }), (s) => s.addSection('certifications'));
    assert.equal(r.sections[0].settings.columns, undefined, 'added: Compact\'s Grids');
    const { styleOnSwitch, defaultSettings } = await loadModule('/src/utils/defaultData.js');
    const { TEMPLATE_IDS } = await loadModule('/src/constants/templates.js');
    for (const to of TEMPLATE_IDS) {
      assert.deepEqual(styleOnSwitch(defaultSettings('compact'), 'compact', to), defaultSettings(to), `compact → ${to}`);
      assert.deepEqual(styleOnSwitch(defaultSettings(to), to, 'compact'), defaultSettings('compact'), `${to} → compact`);
    }
  });
});

describe('the Design panel on Compact (T9)', () => {
  it('says what picking it brought, under the picker, only on Compact; Section Headings\' Line after sample shows its short rule', async () => {
    const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
    const html = (template) => renderToString(createElement(DesignPanel, { resume: { ...make(), template }, updateSetting: () => {}, setTemplate: () => {}, resetSettings: () => {} }));
    assert.match(html('compact'), /Compact brings its own type and spacing/);
    assert.doesNotMatch(html('classic'), /Compact brings its own type and spacing/);
    const { HeadingControls } = await loadModule('/src/components/DesignPanelHeadings.jsx');
    const sample = (template) => renderToString(createElement(HeadingControls, { settings: { accentColor: ACCENT }, template, updateSetting: () => {} }));
    assert.match(sample('compact'), /class="w-3 h-px"/, 'Compact: a short rule');
    assert.doesNotMatch(sample('classic'), /class="w-3 h-px"/, 'Classic: to the end');
  });
});

describe('the Compact one-pager starter (T9)', () => {
  it('a résumé made from it prints with Compact and its style on one page at A4 and Letter, every section in order, its skills in the grid', async () => {
    const { STARTER_TEMPLATES, buildResumeFromStarter } = await loadModule('/src/utils/starterTemplates.js');
    const { templateStyleDefaults } = await loadModule('/src/constants/templates.js');
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    assert.ok(STARTER_TEMPLATES.some((t) => t.id === 'compact-leader' && t.template === 'compact'), 'offered in the starter list');
    const r = normalizeResume(buildResumeFromStarter('compact-leader', 'r_compact'));
    assert.equal(r.template, 'compact');
    for (const [k, v] of Object.entries(templateStyleDefaults('compact'))) assert.equal(r.settings[k], v, k);
    for (const pageSize of ['a4', 'letter']) {
      const pages = await read(await render({ ...r, settings: { ...r.settings, pageSize } }));
      assert.equal(pages.length, 1, `${pageSize}: one page`);
      const text = allText(pages);
      const order = ['EXPERIENCE', 'SKILLS', 'CERTIFICATIONS', 'EDUCATION', 'AWARDS', 'LANGUAGES'].map((t) => text.indexOf(t));
      assert.ok(order.every((at, k) => at >= 0 && (k === 0 || at > order[k - 1])), `${pageSize}: the titles in order: ${order}`);
      for (const fact of ['Harborline Logistics', 'Tidewater Systems', 'Certified Kubernetes Administrator', 'Prairie State University', 'Engineering Leader of the Year', 'Tamil']) {
        assert.ok(text.includes(fact), `${pageSize}: ${fact}`);
      }
      assert.ok(sameRow(pages, 'Leadership:', 'Platform:'), `${pageSize}: skills two to a row`);
    }
  });
});
