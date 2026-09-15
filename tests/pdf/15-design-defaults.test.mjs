// Design → Reset returns a résumé to its own template's defaults, not Classic's (M16).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, read, allText, loadModule, TEMPLATES } from './harness.mjs';

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
