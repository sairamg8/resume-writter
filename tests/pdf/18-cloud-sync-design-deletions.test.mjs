// A saved design deleted on one device stays deleted on every device (R3-008). A design lives in the résumés it
// was saved or picked on (settings.myDesigns, B4), and Delete erased it from this browser's résumés only: a page
// left open that edited the résumé on it wrote its copy — design and all — under the id (the deleting device's
// copy became the conflict copy, R2-004), and a stale picker put it on another résumé; every device listed it again.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, syncModules, resumePath, settle } from './fake-firestore.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

let mods; let presets; let designActions; let templateSwitch;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
  presets = await loadModule('/src/constants/templatePresets.js');
  designActions = await loadModule('/src/hooks/useResumeDesignActions.js');
  templateSwitch = await loadModule('/src/utils/templateSwitch.js');
});
after(teardown);

const USER = { uid: 'u', email: 'someone@example.com' };
const D = 'design_violet';
const VIOLET = { label: 'Violet', engine: 'classic', settings: { font: 'literata', accentColor: '#6d28d9' } };
const cv = (id, updatedAt = 1, settings = {}) => ({ id, name: id, updatedAt, summary: 'v1', template: 'classic', settings, sections: [], dataVersion: DATA_VERSION });
const onViolet = () => cv('resume_x', 1, { ...VIOLET.settings, templatePreset: D, myDesigns: { [D]: VIOLET } });
const page = (cloud, state) => syncPage(mods, cloud, state);
const signIn = async (p) => { p.sync.start(USER); await settle(); };
/** A store change, then the pause's flush — and the one after it (a copy the flush put back, cleaned). */
const change = async (p, resumes) => { await p.change({ resumes }); await p.timers.fire(); await p.timers.fire(); };
async function deleteOn(p, id) { // Design → Template → Your designs → Delete (useResumeDesignActions)
  let state = p.store.state;
  designActions.createDesignActions(() => {}, (update) => { state = update(state); }).deleteDesign(id);
  await change(p, state.resumes);
}
const listed = (resumes) => presets.savedDesigns(resumes).map((d) => d.id);
const inCloud = (cloud) => Object.values(cloud.resumes('u'));

/** X on Violet, Y plain, on both devices; the laptop deletes Violet. */
async function twoDevices() {
  const cloud = fakeFirestore({ [resumePath('u', 'resume_x')]: onViolet(), [resumePath('u', 'resume_y')]: cv('resume_y') });
  const laptop = page(cloud, { resumes: [onViolet(), cv('resume_y')] });
  const phone = page(cloud, { resumes: [onViolet(), cv('resume_y')] });
  await signIn(laptop); await signIn(phone);
  assert.deepEqual(listed(phone.store.state.resumes), [D]);
  await deleteOn(laptop, D);
  assert.deepEqual(listed(laptop.store.state.resumes), []);
  return { cloud, laptop, phone };
}

describe('a saved design deleted on one device stays deleted on every device (R3-008)', () => {
  it("the phone's page, left open, edits the résumé on it: the design stays deleted, the edit stays", async () => {
    const { cloud, laptop, phone } = await twoDevices();
    await change(phone, phone.store.state.resumes.map((r) => (r.id === 'resume_x' ? { ...r, summary: 'PHONE EDIT', updatedAt: 20 } : r)));
    assert.deepEqual(listed(inCloud(cloud)), [], "before: ['design_violet'] — the phone's X brought it back on every device");
    assert.deepEqual(listed(phone.store.state.resumes), []);
    const x = cloud.resumes('u').resume_x;
    assert.equal(x.summary, 'PHONE EDIT', "the phone's edit is kept");
    assert.equal(x.settings.font, 'literata', 'X prints the look it had');
    assert.equal(presets.presetOf(x.settings, x.template), null, 'and is no longer on the design');
    assert.deepEqual(x.settings.myDesigns[D], { deleted: true }, 'X carries the deletion itself');
    const reloaded = page(cloud, JSON.parse(JSON.stringify(laptop.store.state)));
    await signIn(reloaded);
    assert.deepEqual(listed(reloaded.store.state.resumes), [], 'the laptop after a reload');
  });

  it("the phone, not yet told, picks it on another résumé: deleted again once it reads the account", async () => {
    const { cloud, phone } = await twoDevices();
    const [design] = presets.savedDesigns(phone.store.state.resumes); // its picker still lists it
    await change(phone, phone.store.state.resumes.map((r) => (r.id === 'resume_y'
      ? { ...templateSwitch.withLook(r, { engine: design.engine, preset: design.id, design }), updatedAt: 30 } : r)));
    assert.deepEqual(listed(inCloud(cloud)), [], "before: ['design_violet'] — Y brought it back on every device");
    const reloaded = page(cloud, JSON.parse(JSON.stringify(phone.store.state)));
    await signIn(reloaded);
    await reloaded.timers.fire();
    assert.deepEqual(listed(reloaded.store.state.resumes), []);
    const y = cloud.resumes('u').resume_y;
    assert.deepEqual(y.settings.myDesigns[D], { deleted: true }, 'Y holds the deletion too, so it outlives X');
    assert.equal(y.settings.font, 'literata', 'Y keeps the look it was given');
    assert.equal(y.settings.templatePreset, undefined);
  });

  it('two devices cleaning the same copy write the same version: no conflict copy', () => {
    const tomb = cv('resume_a', 5, { myDesigns: { [D]: { deleted: true } } });
    const live = onViolet();
    const [once, twice] = [presets.buryDeletedDesigns([tomb, live]), presets.buryDeletedDesigns([tomb, live])];
    assert.equal(once[1].updatedAt, live.updatedAt + 1);
    assert.deepEqual(once, twice);
    assert.equal(presets.buryDeletedDesigns(once), once, 'nothing left to do: the same list');
  });
});
