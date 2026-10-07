// The JSON Resume export loads with the editor, not at start-up (R2-142, review of 38e7b70e: the start-up
// path was within ~5 kB of its 1,100 kB cap, tests/pdf/71-startup-chunks). The Dashboard imports a JSON
// Resume file, so it read isJsonResume and jsonResumeToCpwtResume from src/utils/jsonResume.js — which also
// re-exports cpwtResumeToJsonResume, so jsonResumeExport.js and what only it and the PDF/Word code use
// (entryPrints.js) sat on the start-up path, though only the editor's Export menu writes that file. The
// Dashboard now imports from jsonResumeImport.js, and the export half is in the editor's chunks.
// The start-up path is walked from the source (startup-modules.mjs); the import itself is unchanged.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { startupModules } from './startup-modules.mjs';

describe('the JSON Resume export is off the start-up path (R2-142)', () => {
  it('the Dashboard\'s import is on it; the export half (jsonResumeExport.js, entryPrints.js) is not', () => {
    const startup = startupModules();
    // The Dashboard reads a JSON Resume file with import() when one is picked (offsetting the Job Map's start-up bytes), so the reader is off it too.
    assert.ok(startup.has('src/pages/Dashboard.jsx'), 'the Dashboard is on it');
    assert.ok(!startup.has('src/utils/jsonResumeImport.js'), 'its JSON Resume reader is not: loaded when such a file is picked');
    assert.deepEqual(['src/utils/jsonResumeExport.js', 'src/utils/entryPrints.js', 'src/utils/jsonResume.js'].filter((m) => startup.has(m)), [],
      'modules only the editor and the PDF/Word code use, reached by a static import from the start-up path');
  });

  describe('jsonResume.js, which the editor and the tests read, still has all three', () => {
    before(setup);
    after(teardown);
    it('isJsonResume and the import are the same functions there as in jsonResumeImport.js; the export is there', async () => {
      const all = await loadModule('/src/utils/jsonResume.js');
      const imp = await loadModule('/src/utils/jsonResumeImport.js');
      assert.equal(all.isJsonResume, imp.isJsonResume);
      assert.equal(all.jsonResumeToCpwtResume, imp.jsonResumeToCpwtResume);
      assert.equal(typeof all.cpwtResumeToJsonResume, 'function');
      assert.equal(imp.isJsonResume({ basics: { name: 'Pat Example' } }), true);
      assert.equal(imp.isJsonResume({ personal: {}, sections: [] }), false, 'an app backup is not a JSON Resume');
    });
  });
});
