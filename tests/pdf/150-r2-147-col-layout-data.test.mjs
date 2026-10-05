// R2-147-col — the Sidebar's column layout (settings.layoutColumns, layoutDetails, layoutSideWidth) travels
// with the résumé: a JSON backup and the cloud copy carry the settings as they are and normalizeResume
// keeps what is offered; the published copy (publicSnapshot) copies them; a JSON Resume export writes the
// layout in `meta.columnLayout`, as Single · ATS-safe writes `meta.layout`, and its import brings it back
// (before, an exported Mixed résumé came back as the side column); and a design the user saved, picked
// from an imported .json, puts only a layout the panel offers on the résumé.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, loadModule } from './harness.mjs';
import { snapshot } from './parity/measure.mjs';

before(setup);
after(teardown);

const LAYOUT = { layoutColumns: 'mixed', layoutDetails: 'right', layoutSideWidth: 31 };
const pick = (settings) => Object.fromEntries(Object.keys(LAYOUT).filter((k) => k in settings).map((k) => [k, settings[k]]));
const cv = (settings) => resume({
  template: 'sidebar',
  settings,
  personal: { name: 'Avery Stone', title: 'Platform Engineer', email: 'avery@example.com' },
  sections: [
    experience([{ company: 'Northwind', role: 'Staff Engineer', description: '<p>Led the billing platform rewrite.</p>' }]),
    section('skills', [{ category: 'Coding', skills: 'TypeScript, Go' }]),
    section('languages', [{ language: 'Portuguese', proficiency: 'Native' }]),
  ],
});

describe('the column layout travels with the résumé (R2-147-col)', () => {
  it('JSON Resume: the export writes it where it is not the default page, and the import brings it back', async () => {
    const { cpwtResumeToJsonResume } = await loadModule('/src/utils/jsonResumeExport.js');
    const { jsonResumeToCpwtResume } = await loadModule('/src/utils/jsonResumeImport.js');
    const file = cpwtResumeToJsonResume(cv(LAYOUT));
    assert.deepEqual(file.meta.columnLayout, { columns: 'mixed', details: 'right', width: 31 });
    const back = jsonResumeToCpwtResume(JSON.parse(JSON.stringify(file)), 'r_back');
    assert.deepEqual(pick(back.settings), LAYOUT, 'the import stores the three choices');
    // What it prints: the imported résumé's page is the exported one's.
    const [a, b] = [await render(cv(LAYOUT)), await render({ ...back, sections: cv(LAYOUT).sections, personal: cv(LAYOUT).personal })];
    assert.equal((await snapshot(b)).pages[0].items.find((t) => /^skills$/i.test(t.str.trim()))?.x, (await snapshot(a)).pages[0].items.find((t) => /^skills$/i.test(t.str.trim()))?.x, 'Skills prints where it did');
    for (const settings of [{}, { layoutColumns: 'two', layoutDetails: 'left', layoutSideWidth: 38 }, { ...LAYOUT, sidebarSingleColumn: true }]) {
      assert.equal('columnLayout' in cpwtResumeToJsonResume(cv(settings)).meta, false, `${JSON.stringify(settings)}: nothing to carry`);
    }
    assert.equal('columnLayout' in cpwtResumeToJsonResume({ ...cv(LAYOUT), template: 'classic' }).meta, false, 'another template: nothing');
    // A file with values no build offered brings only what is offered; on another template, nothing.
    const odd = jsonResumeToCpwtResume({ ...file, meta: { ...file.meta, columnLayout: { columns: 'grid', details: 'top', width: 99 } } }, 'r_odd');
    assert.deepEqual(pick(odd.settings), { layoutDetails: 'top', layoutSideWidth: 45 });
    const classic = jsonResumeToCpwtResume({ ...file, meta: { ...file.meta, template: 'classic' } }, 'r_classic');
    assert.deepEqual(pick(classic.settings), {});
  });

  it('a JSON backup and the cloud copy keep it (normalizeResume), and the published copy copies it', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const { publicSnapshot } = await loadModule('/src/utils/publicLink.js');
    const stored = JSON.parse(JSON.stringify(cv(LAYOUT)));
    assert.deepEqual(pick(normalizeResume(stored).settings), LAYOUT, 'a backup or a cloud copy comes back as it went');
    assert.deepEqual(pick(normalizeResume({ ...stored, settings: { ...stored.settings, layoutColumns: 'grid', layoutSideWidth: '40' } }).settings),
      { layoutDetails: 'right', layoutSideWidth: 40 }, 'a value no build offered is dropped, a width as text a number');
    assert.deepEqual(pick(publicSnapshot(cv(LAYOUT)).settings), LAYOUT, 'the published page prints the same columns');
  });

  it('a saved design from an imported .json puts only a layout the panel offers on the résumé', async () => {
    const { ownDesign } = await loadModule('/src/constants/templatePresets.js');
    const settings = { myDesigns: { d1: { label: 'Mine', engine: 'sidebar', settings: { layoutColumns: 'grid', layoutDetails: 'top', layoutSideWidth: '99' } } } };
    assert.deepEqual(pick(ownDesign(settings, 'd1').settings), { layoutDetails: 'top', layoutSideWidth: 45 });
  });
});
