// R5-HUNT12-SETTINGS-NOT-OBJECT-CRASHES-NEW-AND-WORD: a native .json with no settings, "settings":
// null or a string, stamped with a current (or a too-high) dataVersion, kept them as they came, as
// only the v8 migration created settings. /new then read the Classic card's settings.accentColor on
// undefined and showed the error screen on every visit, and Word export of the résumé and its letter
// threw. Now normalizeResume stores settings that are not an object as {}, which prints the defaults.
// Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, readDocx } from './harness.mjs';

before(setup);
after(teardown);

const files = () => [
  { dataVersion: 13, personal: { name: 'Ann Lee' }, sections: [] },
  { dataVersion: 13, personal: { name: 'Ann Lee' }, sections: [], settings: null },
  { dataVersion: 999, personal: { name: 'Ann Lee' }, sections: [] },
  { dataVersion: 13, personal: { name: 'Ann Lee' }, sections: [], settings: 'dark' },
  { dataVersion: 13, personal: { name: 'Ann Lee' }, sections: [], settings: ['x'] },
];

describe('a current file whose settings are not an object', () => {
  it('is loaded with settings {}, and a résumé whose settings are an object keeps its own', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const file of files()) {
      const r = normalizeResume(file);
      assert.ok(r.settings && typeof r.settings === 'object' && !Array.isArray(r.settings), JSON.stringify(file));
      assert.equal(normalizeResume(r), r, 'the second load changes nothing');
    }
    const own = normalizeResume({ dataVersion: 13, personal: {}, sections: [], settings: { accentColor: '#112233' } });
    assert.equal(own.settings.accentColor, '#112233');
  });

  it("/new's Classic card reads its settings, and 'Header spacing' reset finds an object", async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const { withLook } = await loadModule('/src/utils/templateSwitch.js');
    for (const file of files()) {
      const card = withLook(normalizeResume(file), { engine: 'classic' });
      assert.doesNotThrow(() => card.settings.accentColor, JSON.stringify(file));
      assert.doesNotThrow(() => 'headerSpacing' in card.settings);
    }
  });

  it('exports the résumé and its letter to Word', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const { renderResumeDocx, renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    for (const file of files()) {
      const r = normalizeResume({ ...file, coverLetter: { body: '<p>Dear team,</p>' } });
      const cv = await readDocx(new Uint8Array(await (await renderResumeDocx(r)).arrayBuffer()));
      assert.match(JSON.stringify(cv), /Ann Lee/);
      const letter = await readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
      assert.match(JSON.stringify(letter), /Dear team/);
    }
  });
});
