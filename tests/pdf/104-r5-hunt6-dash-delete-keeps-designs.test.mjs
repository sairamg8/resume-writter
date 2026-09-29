// R5-HUNT6-DASH-DELETE-DROPS-SAVED-DESIGNS: a design the user saves (Design → Save my design) lives on the
// résumé it was saved on — there is no list of them apart, and the picker (Editor, /new) gathers them
// from the résumés there are (savedDesigns). Deleting that résumé from the Dashboard took the design out
// of every picker, with nothing said. Now a design only the deleted résumé held goes on to the most
// recently edited record left, which goes a version on so the sync carries it; a design another résumé
// still holds, or one deleted (R3-008), is left as it is. The store's own Delete (createSyncActions),
// loaded through Vite's SSR loader.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

let createSyncActions, savedDesigns;
before(async () => {
  await setup();
  ({ createSyncActions } = await loadModule('/src/hooks/useResumeSyncActions.js'));
  ({ savedDesigns } = await loadModule('/src/constants/templatePresets.js'));
});
after(teardown);

const mine = (label) => ({ label, engine: 'classic', settings: { accentColor: '#123456' } });
const cv = (id, updatedAt, myDesigns = {}, extra = {}) => ({ id, name: id, updatedAt, sections: [], template: 'classic', settings: { myDesigns }, ...extra });

function store(resumes) {
  let state = { resumes, activeId: resumes[0].id, deletedIds: [], deletedInfo: {} };
  const actions = createSyncActions((u) => { state = typeof u === 'function' ? u(state) : u; }, () => 5000);
  return { ...actions, state: () => state };
}

it('deleting the résumé a design was saved on keeps the design, on the most recently edited one left', () => {
  const s = store([cv('resume_a', 30, { design_mine: mine('Mine') }), cv('resume_b', 10), cv('resume_c', 20)]);
  assert.deepEqual(savedDesigns(s.state().resumes).map((d) => d.label), ['Mine']);
  s.deleteResume('resume_a');
  assert.deepEqual(s.state().resumes.map((r) => r.id), ['resume_b', 'resume_c']);
  assert.deepEqual(savedDesigns(s.state().resumes).map((d) => d.label), ['Mine'], 'the design is gone from every picker');
  const heir = s.state().resumes.find((r) => r.id === 'resume_c');
  assert.equal(heir.settings.myDesigns.design_mine?.label, 'Mine', 'kept on the most recently edited résumé');
  assert.equal(heir.settings.myDesigns.design_mine.settings.accentColor, '#123456', 'its look kept');
  assert.equal(heir.updatedAt, 5000, 'a version on, so the sync sends it');
  assert.equal(s.state().resumes.find((r) => r.id === 'resume_b').updatedAt, 10, 'the other one untouched');
});

it('a design another résumé holds, and one deleted, change nothing', () => {
  const s = store([
    cv('resume_a', 30, { design_both: mine('Both'), design_gone: { deleted: true } }),
    cv('resume_b', 10, { design_both: mine('Both') }),
  ]);
  const kept = s.state().resumes[1];
  s.deleteResume('resume_a');
  assert.equal(s.state().resumes[0], kept, 'nothing to keep: the résumé left is the same object');
  assert.deepEqual(savedDesigns(s.state().resumes).map((d) => d.label), ['Both']);
});

it('a résumé is picked over a letter; with only a letter left, the letter keeps it', () => {
  const s = store([
    cv('resume_a', 30, { design_mine: mine('Mine') }),
    cv('resume_l', 40, {}, { kind: 'letter' }),
    cv('resume_b', 10),
  ]);
  s.deleteResume('resume_a');
  assert.ok(s.state().resumes.find((r) => r.id === 'resume_b').settings.myDesigns?.design_mine, 'on the résumé');
  s.deleteResume('resume_b');
  assert.deepEqual(savedDesigns(s.state().resumes).map((d) => d.label), ['Mine'], 'on the letter');
});
