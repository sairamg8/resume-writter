// R4-DUX-29: Personal Info → a contact field's icon Upload, and the header icon picker's Upload
// Image: a file that is not an image (a PDF picked with the dialog switched to All files) did
// nothing and said nothing — onPickIconFile returned early on its type. It now goes the way the
// photo upload's failures go: readImageFile refuses it and the editor alerts its message, and no
// icon is written. The real editor is mounted over the fake DOM (as in 91-icon-picker-modal).
// Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const PERSONAL = { name: 'Casey Wren', title: 'Planner', email: 'casey@example.com', phone: '+1 555 0142', location: 'Springfield' };
const flush = async () => { for (let i = 0; i < 20; i += 1) await new Promise((r) => { setImmediate(r); }); };
const pdf = () => new File(['%PDF-1.7 fictional'], 'letter.pdf', { type: 'application/pdf' });

it('a non-image file picked as a contact icon is refused with a message, from the field and from the picker', async () => {
  const { default: PersonalInfoEditor } = await loadModule('/src/components/PersonalInfoEditor.jsx');
  const { UNREADABLE_IMAGE } = await loadModule('/src/utils/imageUpload.js');
  const writes = [];
  function Store({ initial }) {
    const [held, setHeld] = useState(initial);
    return createElement(PersonalInfoEditor, {
      resume: held, personal: held.personal, settings: held.settings, template: held.template, coverLetter: held.coverLetter,
      updatePersonal: (key, value) => writes.push(['personal', key, value]),
      toggleFieldVisibility: (key) => writes.push(['hide', key]),
      clearSettings: (keys) => writes.push(['clear', keys]),
      updateSetting: (key, value) => {
        writes.push([key, value]);
        setHeld((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));
      },
    });
  }
  const alerts = [];
  const savedAlert = globalThis.alert;
  globalThis.alert = (message) => { alerts.push(message); };
  const view = mount(Store, { initial: resume({ settings: { contactStyle: 'icon', customContactIcons: {} }, personal: PERSONAL }) });
  const all = () => [...elements(view.container)];
  /** The file input inside the <label> reading `text`. */
  const fileInput = (text) => {
    const label = all().find((el) => el.tagName === 'LABEL' && el.textContent.trim() === text);
    assert.ok(label, `a "${text}" upload`);
    const input = [...elements(label)].find((el) => el.tagName === 'INPUT');
    assert.equal(input.getAttribute('type'), 'file');
    return input;
  };
  const pick = (input) => view.act(() => reactProps(input).onChange({ target: { files: [pdf()], value: 'C:\\fakepath\\letter.pdf' } }));
  try {
    pick(fileInput('Upload'));
    await flush();
    assert.deepEqual(alerts, [UNREADABLE_IMAGE], 'the field\'s Upload says the file was refused');

    const choose = all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Choose Icon');
    view.act(() => reactProps(choose).onClick({}));
    pick(fileInput('Upload Image'));
    await flush();
    assert.deepEqual(alerts, [UNREADABLE_IMAGE, UNREADABLE_IMAGE], 'the picker\'s Upload Image says so too');
    assert.deepEqual(writes.filter(([key]) => key === 'customContactIcons'), [], 'no icon written');
  } finally {
    await view.unmount();
    if (savedAlert === undefined) delete globalThis.alert;
    else globalThis.alert = savedAlert;
  }
});
