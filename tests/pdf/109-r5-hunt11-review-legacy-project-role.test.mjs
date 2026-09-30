// R5-HUNT11-REVIEW-LEGACY-PROJECT-ROLE: an earlier build's JSON Resume import stored a project's
// `roles` as `role`, which no editor box shows and no export prints. R5-HUNT11-JSON-RESUME-PROJECT-
// ROLE-INVISIBLE put a file's roles in the description on import, and stopped counting and writing a
// stored `role` — so a résumé imported before lost its project roles for good: not shown, not printed,
// and no longer even in the JSON Resume file, the one place they still came out. Now normalizeResume
// moves a stored `role` to the end of the description as the "Role: …" paragraph the import writes,
// whatever the résumé's data version, where the editor shows it and every export prints it.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allText, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const normalizer = () => loadModule('/src/utils/normalizeResume.js');

/** A résumé an earlier build's JSON Resume import saved: its projects' roles under `role`. */
function importedEarlier() {
  const r = resume({ sections: [section('projects', [
    { name: 'Payments API', role: 'Tech Lead, Architect', description: '<p>Built it</p>' },
    { name: 'Engine', role: 'Owner <core>', description: '' },
    { name: 'Plain', role: '   ', description: '<p>Kept</p>' },
    { name: 'None', description: '<p>Untouched</p>' },
  ])] });
  r.dataVersion = 13;
  return JSON.parse(JSON.stringify(r));
}

describe('a project role an earlier import stored as `role`', () => {
  it('moves to the end of the description as the résumé loads, and `role` is dropped', async () => {
    const { normalizeResume } = await normalizer();
    const items = normalizeResume(importedEarlier()).sections[0].items;
    assert.equal(items[0].description, '<p>Built it</p><p>Role: Tech Lead, Architect</p>');
    assert.equal(items[1].description, '<p>Role: Owner &lt;core&gt;</p>', 'escaped as text');
    assert.equal(items[2].description, '<p>Kept</p>', 'a blank role adds nothing');
    assert.equal(items[3].description, '<p>Untouched</p>');
    for (const item of items) assert.equal('role' in item, false, JSON.stringify(item));
  });

  it('prints in the PDF', async () => {
    const { normalizeResume } = await normalizer();
    const text = allText(await read(await render(normalizeResume(importedEarlier()))));
    assert.match(text, /Role: Tech Lead, Architect/);
  });

  it('is idempotent, and a résumé with no project role stays the same object', async () => {
    const { normalizeResume } = await normalizer();
    const once = normalizeResume(importedEarlier());
    assert.equal(normalizeResume(once), once);
    const plain = normalizeResume(JSON.parse(JSON.stringify(resume({ sections: [section('projects', [{ name: 'X', description: '<p>a</p>' }])] }))));
    assert.equal(normalizeResume(plain), plain);
  });

  it('leaves a job\'s and a volunteer post\'s role where it is', async () => {
    const { normalizeResume } = await normalizer();
    const r = normalizeResume(JSON.parse(JSON.stringify(resume({ sections: [
      section('experience', [{ company: 'Acme', role: 'Engineer' }]),
      section('volunteering', [{ org: 'Red Cross', role: 'Coordinator' }]),
    ] }))));
    assert.equal(r.sections[0].items[0].role, 'Engineer');
    assert.equal(r.sections[1].items[0].role, 'Coordinator');
  });
});
