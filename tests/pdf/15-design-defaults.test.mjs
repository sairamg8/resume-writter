// Design → Reset returns a résumé to its own template's defaults, not Classic's (M16).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, experience, render, renderCover, read, allText, drawState, loadModule, TEMPLATES } from './harness.mjs';
import { painted, PNG_2X2 } from './extractors.mjs';

before(setup);
after(teardown);

describe('design defaults (M16)', () => {
  it('defaultSettings(template): the ATS-safe defaults with the heading style and case the template brings', async () => {
    const { ATS_DEFAULTS, defaultSettings } = await loadModule('/src/utils/defaultData.js');
    const { templateStyleDefaults } = await loadModule('/src/constants/templates.js');
    for (const template of TEMPLATES) {
      assert.deepEqual(defaultSettings(template), { ...ATS_DEFAULTS, ...templateStyleDefaults(template) }, template);
    }
    assert.deepEqual(defaultSettings('classic'), ATS_DEFAULTS, 'Classic: exactly the ATS defaults');
    assert.equal(defaultSettings('executive').sectionTitleCase, 'normal');
    assert.equal(defaultSettings('sidebar').headingStyle, 'plain');
    assert.deepEqual(defaultSettings('dark'), ATS_DEFAULTS, 'an unknown id: Classic\'s');
    assert.notEqual(defaultSettings('classic'), ATS_DEFAULTS, 'a copy, never the shared object');
  });

  it('a new résumé of a template starts from that template\'s defaults, as picking it or Reset gives (R5-7)', async () => {
    const { createBlankResume, defaultSettings } = await loadModule('/src/utils/defaultData.js');
    const executive = createBlankResume({ id: 'r_exec', template: 'executive' });
    executive.sections = [experience([{}])];
    const text = allText(await read(await render(executive)));
    assert.ok(text.includes('Professional Experience') && !text.includes('PROFESSIONAL EXPERIENCE'), `Executive prints its titles as typed: ${text}`);
    for (const template of TEMPLATES) {
      assert.deepEqual(createBlankResume({ id: `r_${template}`, template }).settings, defaultSettings(template), template);
    }
    assert.deepEqual(createBlankResume({ id: 'r' }).settings, defaultSettings('classic'), 'no template: Classic');
  });

  it('an Executive résumé reset to its defaults prints its section titles as typed (W1b-6.2)', async () => {
    const { settingsAfterReset, sectionReset } = await loadModule('/src/utils/defaultData.js');
    const r = resume({
      template: 'executive',
      settings: { sectionTitleCase: 'upper', headingStyle: 'box', customContactIcons: { phone: 'data:img' } },
      sections: [experience([{}])],
    });
    r.settings = settingsAfterReset(r);
    assert.equal(r.settings.sectionTitleCase, 'normal', 'Executive reset gives normal case section titles');
    assert.equal(r.settings.headingStyle, 'underline', 'Executive reset gives underline heading style');
    assert.deepEqual(r.settings.customContactIcons, { phone: 'data:img' }, 'custom contact icons are preserved');
    const text = allText(await read(await render(r)));
    assert.ok(text.includes('Professional Experience') && !text.includes('PROFESSIONAL EXPERIENCE'), text);

    const typography = sectionReset('executive', ['sectionTitleCase', 'headingStyle'], { sectionTitleCase: 'upper', headingStyle: 'ruled' });
    assert.equal(typography.sectionTitleCase, 'normal');
    assert.equal(typography.headingStyle, 'underline');

    const sidebarHeadings = sectionReset('sidebar', ['headingStyle'], { headingStyle: 'box' });
    assert.equal(sidebarHeadings.headingStyle, 'plain');
  });
});

// The icons uploaded under Personal Info → Fields are stored in settings, next to the design
// settings Reset returns to their defaults. Reset replaced the whole settings object, so it deleted
// every upload with no undo, while its confirmation said the résumé's content was kept (R5-6).
describe('Design → Reset keeps the contact icons the user uploaded (R5-6)', () => {
  const KEY = 'cpwtcv_v1';
  const PERSONAL = { email: 'me@example.com', phone: '+1 555 0100', github: 'github.com/me' };

  /** The app's own store over `saved` (one résumé), after Design → Reset: the résumé it leaves. */
  async function afterReset(saved) {
    const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
    const map = new Map([[KEY, JSON.stringify({ resumes: [saved], activeId: saved.id })]]);
    globalThis.localStorage = {
      get length() { return map.size; },
      key: (i) => [...map.keys()][i] ?? null,
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
    let store = null;
    let pressed = false;
    // The server renderer applies an update made while its own component renders, and renders
    // again: Reset is pressed once, and the second render's store holds its result.
    function Probe() {
      store = useAppStore();
      if (!pressed) { pressed = true; store.resetSettings(); }
      return null;
    }
    try {
      renderToString(createElement(Probe));
      return store.activeResume;
    } finally {
      delete globalThis.localStorage;
    }
  }

  const images = async (bytes) => (await painted(bytes)).filter((p) => p.paint === 'image').length;

  it('every template: the design settings go back to its defaults, the uploads stay, and its PDF and letter still draw them', async () => {
    const { defaultSettings } = await loadModule('/src/utils/defaultData.js');
    const uploads = { email: PNG_2X2, github: PNG_2X2 };
    for (const template of TEMPLATES) {
      const saved = resume({ template, personal: PERSONAL, settings: {
        accentColor: '#0d9488', iconSet: 'bold', contactStyle: 'bar', marginH: 30, customContactIcons: uploads,
      } });
      const r = await afterReset(saved);
      assert.deepEqual(r.settings, { ...defaultSettings(template), customContactIcons: uploads }, template);
      // Before: customContactIcons {}, and each PDF drew the pack's icons instead.
      assert.equal(await images(await render(r)), 2, `${template}: the résumé draws both uploads`);
      assert.equal(await images(await renderCover(r)), 2, `${template}: the cover letter draws both uploads`);
    }
  });

  it('old saved data: uploads saved with no dataVersion stay; none stored, or a value that is not a map, resets to none', async () => {
    const { defaultSettings } = await loadModule('/src/utils/defaultData.js');
    const withUploads = resume({ settings: { accentColor: '#0d9488', customContactIcons: { phone: PNG_2X2 } } });
    delete withUploads.dataVersion; // as 4bc56fe stored every résumé
    assert.deepEqual((await afterReset(withUploads)).settings, { ...defaultSettings('classic'), customContactIcons: { phone: PNG_2X2 } });
    const old = resume({ settings: { accentColor: '#0d9488' } });
    delete old.settings.customContactIcons;
    delete old.dataVersion;
    assert.deepEqual((await afterReset(old)).settings, defaultSettings('classic'));
    for (const junk of [null, 'data:image/png;base64,AAAA', [PNG_2X2]]) {
      const r = await afterReset(resume({ settings: { customContactIcons: junk } }));
      assert.deepEqual(r.settings, defaultSettings('classic'), JSON.stringify(junk));
    }
  });
});

describe('every per-template table covers every template (VM3-5)', () => {
  // Guards, each checked by mutation (a template dropped from one table fails its line): a
  // template missing from one of these tables silently printed Classic's colour fallbacks
  // (DEFAULTS[t] || DEFAULTS.classic), Classic's component (LOADERS) or Classic's cover letter
  // letterhead (LOOKS, V2FIDB-51-6: a switch whose `default:` was Classic's), or was not offered.
  it('the PDF\'s fallbacks, section defaults and components, and the Design panel\'s list, name exactly the templates the app offers', async () => {
    const { TEMPLATE_IDS, TEMPLATE_PICKER, templateLabel, atsRating } = await loadModule('/src/constants/templates.js');
    const ids = TEMPLATE_IDS.toSorted();
    const tables = {
      'DEFAULTS (templateSettings.js)': (await loadModule('/src/templates/pdf/shared/templateSettings.js')).DEFAULTS,
      'TEMPLATE_SECTION_DEFAULTS': (await loadModule('/src/templates/pdf/shared/templateSectionDefaults.js')).TEMPLATE_SECTION_DEFAULTS,
      'LOADERS (pdfExportReactPDF.js)': (await loadModule('/src/utils/pdfExportReactPDF.js')).LOADERS,
      'LOOKS (letterhead.js)': (await loadModule('/src/templates/pdf/shared/letterhead.js')).LOOKS,
    };
    for (const [name, table] of Object.entries(tables)) assert.deepEqual(Object.keys(table).toSorted(), ids, name);
    assert.deepEqual(TEMPLATE_PICKER.map((t) => t.id).toSorted(), ids, 'the Design panel\'s picker');
    // Templates added since (T6 on) are listed after the first five, in TEMPLATE_IDS' order.
    assert.deepEqual(TEMPLATE_PICKER.map((t) => t.id), ['executive', 'classic', 'modern', 'minimal', 'sidebar', 'timeline'], 'in its order');
    for (const t of TEMPLATE_PICKER) {
      assert.equal(t.label, templateLabel(t.id), t.id);
      assert.ok(t.desc && typeof t.ats === 'boolean', `${t.id}: a description and an ATS answer`);
    }
    // Derived, never a literal: the badge and the ATS Check tab read one atsRating (TUI-5), so this
    // pins the wiring rather than the answer — a template added brings its own tier and is badged by it.
    assert.deepEqual(
      TEMPLATE_PICKER.filter((t) => t.ats).map((t) => t.id),
      TEMPLATE_PICKER.filter((t) => atsRating(t.id).safe).map((t) => t.id),
      'the ATS badges come from atsRating',
    );
    assert.deepEqual(
      TEMPLATE_PICKER.filter((t) => t.ats).map((t) => t.id), ['executive', 'classic', 'modern', 'minimal', 'timeline'],
      'today that is the single-column templates; the Sidebar earns it only in its Single Layout',
    );
    assert.deepEqual(TEMPLATES.toSorted(), ['classic', 'executive', 'minimal', 'modern', 'sidebar', 'timeline'], 'these tests run every template');
  });

  it('each LOADERS entry loads that template\'s own component', async () => {
    const { LOADERS } = await loadModule('/src/utils/pdfExportReactPDF.js');
    const names = Object.fromEntries(await Promise.all(Object.entries(LOADERS).map(async ([id, load]) => [id, (await load()).name])));
    assert.deepEqual(names, Object.fromEntries(TEMPLATES.map((id) => [id, `${id[0].toUpperCase()}${id.slice(1)}TemplatePDF`])));
  });

  it('each LOOKS entry is the letterhead letterheadLook() gives that template; an id the app does not offer takes Classic\'s (V2FIDB-51-6)', async () => {
    // Swaps each entry for a marker: no other branch may answer for a template in the table.
    const { LOOKS, letterheadLook } = await loadModule('/src/templates/pdf/shared/letterhead.js');
    const s = { accentColor: '#e11d48', showHeaderBorder: true };
    const own = { ...LOOKS };
    try {
      for (const id of Object.keys(own)) LOOKS[id] = (base) => ({ ...base, from: id });
      for (const id of TEMPLATES) assert.equal(letterheadLook(id, s).from, id, id);
      for (const id of ['dark', 'Modern', undefined]) assert.equal(letterheadLook(id, s).from, id === 'Modern' ? 'modern' : 'classic', String(id));
    } finally {
      Object.assign(LOOKS, own);
    }
    for (const id of TEMPLATES) assert.equal(letterheadLook(id, s).look, id, `${id}: restored`);
  });
});

describe('Design → Section Headings marks what the PDF prints (R5-3)', () => {
  // A résumé that stores no heading style or title case (older data, an imported file) prints the
  // template's own PDF fallback. The panel marked "Ruled" and "ABC" for every template instead,
  // so the marked chip was not the printed style and clicking it changed the PDF.
  const noop = () => {};
  const LABELS = { ruled: 'Ruled', leftbar: 'Left bar', line: 'Line after', underline: 'Underline', box: 'Boxed', plain: 'Plain' };

  /** The Title case chip the section marks and the heading-style chip it marks, by their labels. */
  function marked(html) {
    const buttons = [...html.matchAll(/<button[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)]
      .map(([, cls, inner]) => ({ cls, text: inner.replace(/<[^>]*>/g, '').replace(/<!-- -->/g, '').trim() }));
    return {
      titleCase: buttons.find((b) => b.cls.includes('bg-blue-600'))?.text,
      // Each chip draws an "ABC" sample above its label.
      style: buttons.find((b) => b.cls.includes('border-blue-500'))?.text.replace(/^ABC/, ''),
    };
  }

  const section = async (settings, template) => {
    const { HeadingControls } = await loadModule('/src/components/DesignPanelHeadings.jsx');
    return marked(renderToString(createElement(HeadingControls, { settings, template, updateSetting: noop })));
  };

  it('with nothing stored, each template marks the chip its PDF prints, not Classic\'s Ruled/ABC', async () => {
    const { DEFAULTS } = await loadModule('/src/templates/pdf/shared/templateSettings.js');
    for (const template of TEMPLATES) {
      assert.deepEqual(await section({}, template), {
        titleCase: DEFAULTS[template].sectionTitleCase === 'upper' ? 'ABC' : 'Abc',
        style: LABELS[DEFAULTS[template].headingStyle],
      }, template);
    }
  });

  it('a stored style still wins, and a case the panel does not offer still marks "Abc" (V2W2b-5)', async () => {
    assert.deepEqual(await section({ headingStyle: 'box', sectionTitleCase: 'title' }, 'classic'),
      { titleCase: 'Abc', style: 'Boxed' });
    assert.deepEqual(await section({ headingStyle: 'ruled', sectionTitleCase: 'upper' }, 'executive'),
      { titleCase: 'ABC', style: 'Ruled' });
  });

  it('those fallbacks are what the PDF prints: Classic\'s accent "Line after", Executive\'s titles as typed', async () => {
    const unset = { headingStyle: '', sectionTitleCase: '', accentColor: '#e11d48' };
    const classic = resume({ template: 'classic', settings: unset, sections: [experience([{}])] });
    // 'line' prints the title in the accent colour, where 'ruled' prints it neutral grey.
    const bytes = await render(classic);
    assert.deepEqual((await drawState(bytes, 'ROFESSIONAL')).map((h) => h.fill), ['#e11d48']);
    const executive = resume({ template: 'executive', settings: unset, sections: [experience([{}])] });
    const text = allText(await read(await render(executive)));
    assert.ok(text.includes('Professional Experience') && !text.includes('PROFESSIONAL EXPERIENCE'), text);
  });
});
