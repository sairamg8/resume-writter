// Design → Reset returns a résumé to its own template's defaults, not Classic's (M16).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, experience, render, read, allText, drawState, loadModule, TEMPLATES } from './harness.mjs';

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

  it('an Executive résumé reset to its defaults prints its section titles as typed', async () => {
    const { defaultSettings } = await loadModule('/src/utils/defaultData.js');
    const r = resume({ template: 'executive', sections: [experience([{}])] });
    r.settings = defaultSettings('executive');
    const text = allText(await read(await render(r)));
    assert.ok(text.includes('Professional Experience') && !text.includes('PROFESSIONAL EXPERIENCE'), text);
  });
});

describe('every per-template table covers every template (VM3-5)', () => {
  // Guards, each checked by mutation (a template dropped from one table fails its line): a
  // template missing from one of these tables silently printed Classic's colour fallbacks
  // (DEFAULTS[t] || DEFAULTS.classic) or Classic's component (LOADERS), or was not offered.
  it('the PDF\'s fallbacks, section defaults and components, and the Design panel\'s list, name exactly the templates the app offers', async () => {
    const { TEMPLATE_IDS, TEMPLATE_PICKER, templateLabel } = await loadModule('/src/constants/templates.js');
    const ids = TEMPLATE_IDS.toSorted();
    const tables = {
      'DEFAULTS (templateSettings.js)': (await loadModule('/src/templates/pdf/shared/templateSettings.js')).DEFAULTS,
      'TEMPLATE_SECTION_DEFAULTS': (await loadModule('/src/templates/pdf/shared/templateSectionDefaults.js')).TEMPLATE_SECTION_DEFAULTS,
      'LOADERS (pdfExportReactPDF.js)': (await loadModule('/src/utils/pdfExportReactPDF.js')).LOADERS,
    };
    for (const [name, table] of Object.entries(tables)) assert.deepEqual(Object.keys(table).toSorted(), ids, name);
    assert.deepEqual(TEMPLATE_PICKER.map((t) => t.id).toSorted(), ids, 'the Design panel\'s picker');
    assert.deepEqual(TEMPLATE_PICKER.map((t) => t.id), ['executive', 'classic', 'modern', 'minimal', 'sidebar'], 'in its order');
    for (const t of TEMPLATE_PICKER) {
      assert.equal(t.label, templateLabel(t.id), t.id);
      assert.ok(t.desc && typeof t.ats === 'boolean', `${t.id}: a description and an ATS answer`);
    }
    assert.deepEqual(TEMPLATE_PICKER.filter((t) => t.ats).map((t) => t.id), ['executive', 'classic', 'minimal'], 'the ATS badges, as before');
    assert.deepEqual(TEMPLATES, TEMPLATE_IDS, 'these tests run every template');
  });

  it('each LOADERS entry loads that template\'s own component', async () => {
    const { LOADERS } = await loadModule('/src/utils/pdfExportReactPDF.js');
    const names = Object.fromEntries(await Promise.all(Object.entries(LOADERS).map(async ([id, load]) => [id, (await load()).name])));
    assert.deepEqual(names, Object.fromEntries(TEMPLATES.map((id) => [id, `${id[0].toUpperCase()}${id.slice(1)}TemplatePDF`])));
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
