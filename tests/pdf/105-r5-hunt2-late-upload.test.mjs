// R5-HUNT2-LATE-PHOTO-ICON-UPLOAD-LANDS-ON-OTHER-RESUME: Personal Info → Photo, and a contact field's
// icon Upload, wait for the image to be decoded and shrunk (readImageFile) before writing it. The write
// went to whichever résumé was open by then (updatePersonal / updateSetting write to the open one), so a
// large photo picked on résumé A, with résumé B opened meanwhile, landed on B; and an icon upload wrote
// A's whole icon set, as it was when the upload started, over B's. The upload is now written to the
// résumé it was started on, into that résumé's icons as they are when it is done.
// The Cover Letter panel's own photo upload had the same flaw and is written by id too (review).
// The real Personal Info editor is mounted over the real store (useAppStore); the browser's image
// decode is held until the test lets it finish. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { MemoryStorage, settle } from './resume-tab.mjs';
import { PNG_2X2 } from './extractors.mjs';

const KEY = 'cpwtcv_v1';
const saved = {};
let release = null;
before(async () => {
  patchFakeDom();
  await setup();
  for (const k of ['createImageBitmap', 'FileReader', 'alert']) saved[k] = globalThis[k];
  // The browser, as readImageFile uses it for a small PNG — its decode held until `release()`, as a
  // large camera photo keeps it busy.
  globalThis.createImageBitmap = () => new Promise((resolve) => { release = () => resolve({ width: 2, height: 2, close() {} }); });
  globalThis.FileReader = class {
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => { this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`; this.onload(); });
    }
  };
  globalThis.alert = (m) => { throw new Error(`unexpected alert: ${m}`); };
});
after(async () => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete globalThis[k];
    else globalThis[k] = v;
  }
  await teardown();
});

const png = () => new File([Buffer.from(PNG_2X2.split(',')[1], 'base64')], 'me.png', { type: 'image/png' });
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const ICON_B = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';

/** The Personal Info editor over the store, showing its open résumé, as the Résumé tab wires it. */
async function editor(resumes) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { default: PersonalInfoEditor } = await loadModule('/src/components/PersonalInfoEditor.jsx');
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes, activeId: resumes[0].id })]]);
  const box = { store: null };
  function Page() {
    const store = useAppStore();
    box.store = store;
    const r = store.activeResume;
    return createElement(PersonalInfoEditor, {
      key: r.id, resume: r, personal: r.personal, settings: r.settings, template: r.template, coverLetter: r.coverLetter,
      updatePersonal: store.updatePersonal, toggleFieldVisibility: store.toggleFieldVisibility,
      updateSetting: store.updateSetting, clearSettings: store.clearSettings,
    });
  }
  const view = mount(Page, {});
  await settle();
  const all = () => [...elements(view.document.body)];
  return {
    view,
    all,
    of: (id) => box.store.appState.resumes.find((r) => r.id === id),
    open: (id) => view.act(() => box.store.setActiveId(id)),
    setting: (key, value) => view.act(() => box.store.updateSetting(key, value)),
    pick: (input) => view.act(() => reactProps(input).onChange({ target: { files: [png()], value: 'C:\\fakepath\\me.png' } })),
    async close() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

const cv = (id, name, settings = {}) => ({ ...resume({ personal: { name, title: 'Surveyor', email: `${id}@example.com` }, settings }), id, name });

it('a photo whose upload finishes after another résumé was opened goes to the résumé it was picked on', async () => {
  const page = await editor([cv('resume_a', 'Robin Sample'), cv('resume_b', 'Casey Example')]);
  try {
    const header = page.all().find((el) => el.tagName === 'BUTTON' && text(el) === 'Photo');
    assert.ok(header, 'the Photo panel');
    page.view.act(() => reactProps(header).onClick({}));
    const input = page.all().find((el) => el.tagName === 'INPUT' && reactProps(el).type === 'file' && reactProps(el).accept === 'image/*'
      && el.parentNode?.tagName !== 'LABEL'); // a field's icon Upload is a <label>'s
    assert.ok(input, 'the photo upload');
    page.pick(input);
    await settle();
    page.open('resume_b');
    release();
    await settle();
    assert.equal(page.of('resume_b').personal.photo ?? null, null, 'no photo put on the résumé opened meanwhile');
    assert.match(page.of('resume_a').personal.photo || '', /^data:image\/png;base64,/, 'the photo is on the résumé it was picked on');
  } finally { await page.close(); }
});

it("an icon upload that finishes after another résumé was opened leaves that résumé's icons as they are", async () => {
  const page = await editor([
    cv('resume_a', 'Robin Sample', { contactStyle: 'icon', customContactIcons: {} }),
    cv('resume_b', 'Casey Example', { contactStyle: 'icon', customContactIcons: { github: ICON_B } }),
  ]);
  try {
    const label = page.all().find((el) => el.tagName === 'LABEL' && text(el) === 'Upload');
    assert.ok(label, 'a contact field\'s icon Upload');
    page.pick([...elements(label)].find((el) => el.tagName === 'INPUT'));
    await settle();
    page.open('resume_b');
    release();
    await settle();
    assert.deepEqual(page.of('resume_b').settings.customContactIcons, { github: ICON_B }, "the other résumé's icons are its own still");
    const a = page.of('resume_a').settings.customContactIcons;
    assert.deepEqual(Object.keys(a), ['email'], 'the icon is on the résumé it was picked on');
    assert.match(a.email, /^data:image\/png;base64,/);
  } finally { await page.close(); }
});

it('an icon changed while an upload ran is kept when the upload lands', async () => {
  const page = await editor([cv('resume_a', 'Robin Sample', { contactStyle: 'icon', customContactIcons: {} })]);
  try {
    const label = page.all().find((el) => el.tagName === 'LABEL' && text(el) === 'Upload');
    page.pick([...elements(label)].find((el) => el.tagName === 'INPUT'));
    await settle();
    page.setting('customContactIcons', { github: ICON_B });
    release();
    await settle();
    const icons = page.of('resume_a').settings.customContactIcons;
    assert.equal(icons.github, ICON_B, 'the icon set meanwhile stays');
    assert.match(icons.email || '', /^data:image\/png;base64,/, 'and the upload is added');
  } finally { await page.close(); }
});

// The Cover Letter panel's own photo (the letter's clPhoto) waits for the same decode, and its
// updateCoverLetter wrote to whichever résumé was open by then (R5-HUNT2 review).
it("a cover letter photo whose upload finishes after another résumé was opened goes to the letter it was picked on", async () => {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { default: CoverLetterPanel } = await loadModule('/src/components/CoverLetterPanel.jsx');
  const resumes = [cv('resume_a', 'Robin Sample'), cv('resume_b', 'Casey Example')];
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes, activeId: 'resume_a' })]]);
  const box = { store: null };
  function Page() {
    const store = useAppStore();
    box.store = store;
    const r = store.activeResume;
    return createElement(CoverLetterPanel, {
      key: r.id, resume: r, coverLetter: r.coverLetter, personal: r.personal, settings: r.settings, template: r.template,
      updateCoverLetter: store.updateCoverLetter, updateSetting: store.updateSetting, clearSettings: store.clearSettings,
    });
  }
  const view = mount(Page, {});
  try {
    await settle();
    const input = [...elements(view.document.body)].find((el) => el.tagName === 'INPUT' && reactProps(el).type === 'file');
    assert.ok(input, "the letter's photo upload");
    view.act(() => reactProps(input).onChange({ target: { files: [png()], value: 'C:\\fakepath\\me.png' } }));
    await settle();
    view.act(() => box.store.setActiveId('resume_b'));
    release();
    await settle();
    const of = (id) => box.store.appState.resumes.find((r) => r.id === id);
    assert.equal(of('resume_b').coverLetter?.clPhoto ?? null, null, 'no photo put on the letter opened meanwhile');
    assert.match(of('resume_a').coverLetter?.clPhoto || '', /^data:image\/png;base64,/, 'the photo is on the letter it was picked on');
  } finally {
    await view.unmount();
    delete globalThis.localStorage;
  }
});
