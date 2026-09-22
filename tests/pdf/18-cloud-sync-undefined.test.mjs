// A section's Spacing Override (Before, After, Item gap) stored `undefined` when its box was
// emptied or its ↺ pressed. The Firestore SDK refuses a document holding `undefined`
// (invalid-argument, thrown by set()), so the résumé was held back — the icon said "stopped" — and
// every later edit of it failed the same way until a reload dropped the key (bug audit 2026-09-22).
// The store now removes the key, as clearSettings does, and the sync never sends `undefined`.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, syncModules, resumePath, settle } from './fake-firestore.mjs';

let mods;
let sectionActions;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
  sectionActions = await loadModule('/src/hooks/useResumeSectionActions.js');
});
after(teardown);

const USER = { uid: 'u', email: 'someone@example.com' };
const sec = (settings) => ({ id: 's', type: 'experience', title: 'Experience', visible: true, settings, items: [] });
const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [sec({ spacing: 'normal' })], dataVersion: 11, template: 'classic', ...extra });

/** The store's section updaters over one résumé, as useResumeStore makes them (patchActive). */
function sectionStore(resume) {
  let r = resume;
  const actions = sectionActions.createSectionActions((updater) => { r = { ...updater(r), updatedAt: 2 }; });
  return { actions, get: () => r };
}

describe('a cleared Spacing Override', () => {
  it('removes the key — never stores undefined (the box emptied, or its ↺)', () => {
    const s = sectionStore(cv('resume_a', 1, { sections: [sec({ spacing: 'normal', spaceBefore: 12, itemGap: 6 })] }));
    s.actions.updateSectionSettings('s', 'spaceBefore', undefined);
    s.actions.updateSectionSettings('s', 'itemGap', undefined);
    const settings = s.get().sections[0].settings;
    assert.deepEqual(settings, { spacing: 'normal' });
    assert.equal(Object.values(settings).includes(undefined), false);
  });

  it('a résumé holding undefined still reaches the cloud — not held back, the sync goes on', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
    const p = syncPage(mods, cloud, { resumes: [cv('resume_a')] });
    p.sync.start(USER);
    await settle();
    // What an older build's clear left in memory: the key, holding undefined.
    await p.change({ resumes: [cv('resume_a', 2, { sections: [sec({ spacing: 'normal', spaceBefore: undefined })] })] });
    await p.timers.fire();
    assert.deepEqual([p.seen.status, p.seen.held], ['synced', []]);
    assert.equal(cloud.resumes('u').resume_a.updatedAt, 2);
    assert.deepEqual(cloud.resumes('u').resume_a.sections[0].settings, { spacing: 'normal' });
  });
});
