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
