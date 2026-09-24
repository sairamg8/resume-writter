// Export → JSON Resume → import keeps the Sidebar's Layout: a résumé in "Single · ATS-safe" comes back
// in it. The file carried the template in `meta` (TUI-4) so the page comes back, but not the Layout,
// so the import reopened a Single · ATS-safe Sidebar in the two columns a portal may interleave, and
// the ATS Check warned about a page the user had made safe. The file still carries no colours, fonts
// or spacing (a known limit of the format, jsonResumeImport.js); the Layout decides the page itself.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, section, read, render, itemsWith, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const cv = (template, sidebarSingleColumn) => resume({
  template,
  settings: { sidebarSingleColumn },
  sections: [experience([{ company: 'Acme Corp', role: 'Staff Engineer' }]), section('skills', [{ category: 'Core', skills: 'Go, SQL' }])],
});

/** `r` exported as JSON Resume, written out and read back, and imported as the store imports a file (normalizeResume). */
async function roundTrip(r) {
  const { cpwtResumeToJsonResume, jsonResumeToCpwtResume } = await loadModule('/src/utils/jsonResume.js');
  const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
  return normalizeResume(jsonResumeToCpwtResume(JSON.parse(JSON.stringify(cpwtResumeToJsonResume(r)))));
}

/** One column: the Skills title starts where the Experience title does. */
async function oneColumn(r) {
  const pages = await read(await render(r));
  const [exp, skills] = [itemsWith(pages, 'EXPERIENCE')[0], itemsWith(pages, 'SKILLS')[0]];
  assert.ok(exp && skills, 'both section titles print');
  return Math.abs(exp.x - skills.x) < 2;
}

/** The ATS Check's verdict on the template's layout: pass, or warn. */
async function verdict(r) {
  const { analyzeAtsScore } = await loadModule('/src/utils/atsChecker.js');
  return analyzeAtsScore(r).categories.layout.items.find((i) => i.id === 'template').status;
}

describe('JSON Resume keeps the Sidebar\'s Single · ATS-safe Layout', () => {
  it('the repro: Sidebar in Single · ATS-safe → export → import: one column, and the ATS Check passes it', async () => {
    const back = await roundTrip(cv('sidebar', true));
    assert.equal(back.template, 'sidebar');
    assert.equal(back.settings.sidebarSingleColumn, true);
    assert.equal(await oneColumn(back), true, 'one column after the round trip');
    assert.equal(await verdict(back), 'pass');
  });

  it('Two columns comes back two columns (guard)', async () => {
    const back = await roundTrip(cv('sidebar', false));
    assert.equal(Boolean(back.settings.sidebarSingleColumn), false);
    assert.equal(await oneColumn(back), false);
  });

  it('a Layout stored on another template, where it prints nothing, is not written (the file says only what prints)', async () => {
    const { cpwtResumeToJsonResume } = await loadModule('/src/utils/jsonResume.js');
    for (const template of TEMPLATES.filter((t) => t !== 'sidebar')) {
      const file = cpwtResumeToJsonResume(cv(template, true));
      assert.equal(file.meta.layout, undefined, template);
      assert.equal(Boolean((await roundTrip(cv(template, true))).settings.sidebarSingleColumn), false, template);
    }
  });

  it('another tool\'s file, or one naming a layout the app does not know: the template\'s own', async () => {
    const { jsonResumeToCpwtResume } = await loadModule('/src/utils/jsonResume.js');
    for (const meta of [{ template: 'sidebar' }, { template: 'sidebar', layout: 'columns' }, { template: 'sidebar', layout: 7 }, { template: 'classic', layout: 'single' }]) {
      const r = jsonResumeToCpwtResume({ basics: { name: 'X' }, meta });
      assert.equal(Boolean(r.settings.sidebarSingleColumn), false, JSON.stringify(meta));
    }
  });
});
