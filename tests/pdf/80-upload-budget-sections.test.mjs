// R2-097: an upload may take only what is left of the résumé's cloud document (remainingImageBudget,
// ONB-10-NB1), but all three upload sites measured a résumé with no sections: the Photo panel, a
// contact field's own icon (Personal Info) and the letter's photo (the Cover Letter panel, whose
// own full `resume` prop was shadowed). On a long résumé an upload was accepted and the résumé then
// stopped syncing. Each site now measures the whole résumé. The panels are mounted with
// react-dom/client (tests/pdf/fake-dom.mjs) and fed a small PNG; with sections this long, there is
// no room left for it.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';
import { PNG_2X2 } from './extractors.mjs';

let RESUME_IMAGES_TOO_LARGE;
const saved = {};
before(async () => {
  await setup();
  ({ RESUME_IMAGES_TOO_LARGE } = await loadModule('/src/utils/imageUpload.js'));
  for (const k of ['createImageBitmap', 'FileReader', 'alert']) saved[k] = globalThis[k];
  // The browser, as far as readImageFile uses it for a small PNG: decoded, and read as a data URL.
  globalThis.createImageBitmap = async () => ({ width: 2, height: 2, close() {} });
  globalThis.FileReader = class {
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => { this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`; this.onload(); });
    }
  };
});
after(async () => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete globalThis[k];
    else globalThis[k] = v;
  }
  await teardown();
});

const png = () => new Blob([Buffer.from(PNG_2X2.split(',')[1], 'base64')], { type: 'image/png' });

/** A résumé whose sections leave no room in its cloud document for another image. */
const long = () => resume({ sections: [section('custom', [{ title: 'Notes', description: 'x'.repeat(960_000) }])] });

/** Mounts `component`, uploads a PNG to its `nth` file input; resolves to [what it stored, what it alerted]. */
async function upload(component, props, nth = 0) {
  const stored = [];
  const alerts = [];
  globalThis.alert = (m) => alerts.push(m);
  const view = mount(component, props(stored));
  try {
    const input = [...elements(view.container)].filter((el) => el.tagName === 'INPUT' && el.type === 'file')[nth];
    assert.ok(input, 'the upload input');
    reactProps(input).onChange({ target: { files: [png()], value: '' } });
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    return { stored, alerts };
  } finally {
    await view.unmount();
  }
}

const refused = ({ stored, alerts }, where) => {
  assert.deepEqual(stored, [], `${where}: nothing stored`);
  assert.deepEqual(alerts, [RESUME_IMAGES_TOO_LARGE], `${where}: says why`);
};

describe('an upload on a résumé whose sections fill its cloud document', () => {
  it('the Photo panel refuses it', async () => {
    const { PhotoSection } = await loadModule('/src/components/PersonalInfoEditorPhoto.jsx');
    const r = long();
    refused(await upload(PhotoSection, (stored) => ({
      resume: r, personal: r.personal, updatePersonal: (k, v) => stored.push([k, v]), toggleFieldVisibility: () => {}, hidden: new Set(),
      s: r.settings, set: () => {}, template: r.template, coverLetter: r.coverLetter, open: true, onToggle: () => {},
    })), 'photo');
  });

  it('a contact field\'s own icon (Personal Info) refuses it', async () => {
    const { default: PersonalInfoEditor } = await loadModule('/src/components/PersonalInfoEditor.jsx');
    const r = long();
    refused(await upload(PersonalInfoEditor, (stored) => ({
      resume: r, personal: r.personal, updatePersonal: () => {}, toggleFieldVisibility: () => {}, settings: r.settings,
      updateSetting: (k, v) => stored.push([k, v]), clearSettings: () => {}, template: r.template, coverLetter: r.coverLetter,
    })), 'icon');
  });

  it('the Cover Letter panel\'s photo refuses it', async () => {
    const { default: CoverLetterPanel } = await loadModule('/src/components/CoverLetterPanel.jsx');
    const r = long();
    refused(await upload(CoverLetterPanel, (stored) => ({
      resume: r, coverLetter: r.coverLetter, personal: r.personal, settings: r.settings, template: r.template,
      updateCoverLetter: (k, v) => stored.push([k, v]),
    })), 'letter photo');
  });

  it('with room left, each takes it', async () => {
    const { PhotoSection } = await loadModule('/src/components/PersonalInfoEditorPhoto.jsx');
    const r = resume({ sections: [section('custom', [{ title: 'Notes', description: 'short' }])] });
    const { stored, alerts } = await upload(PhotoSection, (out) => ({
      resume: r, personal: r.personal, updatePersonal: (k, v) => out.push([k, v]), toggleFieldVisibility: () => {}, hidden: new Set(),
      s: r.settings, set: () => {}, template: r.template, coverLetter: r.coverLetter, open: true, onToggle: () => {},
    }));
    assert.deepEqual(alerts, []);
    assert.deepEqual(stored, [['photo', PNG_2X2]]);
  });
});
