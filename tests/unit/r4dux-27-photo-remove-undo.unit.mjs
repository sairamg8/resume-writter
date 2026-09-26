// R4-DUX-27: Personal Info → Photo → "Remove photo" dropped the upload at once, with no way back but
// uploading it again. It now raises a "Photo removed" notice whose Undo puts the very same photo back
// (the photo is the one field Remove clears: Shape, Size and the rest are Design settings, untouched).
// Mounted with react-dom/client over fake-dom inside the kit's ToastProvider. Fictional data only.
// Run: node --test tests/unit/r4dux-27-photo-remove-undo.unit.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, useState } from 'react';
import { kitLoader, patchFakeDom, mount, ev, reactProps, byAttr, byText } from './ui-dom-harness.mjs';

let kit;
let PhotoSection;
let ToastProvider;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ({ PhotoSection } = await kit.load('/src/components/PersonalInfoEditorPhoto.jsx'));
  ({ ToastProvider } = await kit.load('/src/components/ui/Toast.jsx'));
});
after(() => kit?.close());

// A 1×1 PNG: a photo the PDF can draw as it is, so no copy is started.
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

it('Remove photo raises "Photo removed"; its Undo puts the same photo back', async () => {
  const calls = [];
  const settings = { photoShape: 'square', photoSize: 'large' };
  function Panel() {
    const [personal, setPersonal] = useState({ name: 'Robin Sample', photo: PHOTO });
    const updatePersonal = (field, value) => {
      calls.push([field, value]);
      setPersonal((p) => ({ ...p, [field]: value }));
    };
    return h(PhotoSection, {
      resume: { id: 'resume_a', personal, settings, sections: [] }, personal, updatePersonal,
      toggleFieldVisibility: () => {}, hidden: new Set(), s: settings, set: () => {},
      template: 'classic', coverLetter: {}, open: true, onToggle: () => {},
    });
  }
  const view = mount(() => h(ToastProvider, null, h(Panel)), {});
  try {
    const remove = byText(view.container, 'Remove photo');
    assert.ok(remove, 'a photo is there to remove');
    view.act(() => reactProps(remove).onClick(ev()));
    assert.deepEqual(calls, [['photo', null]], 'Remove takes the photo out at once');
    assert.equal(byText(view.container, 'Remove photo'), null, 'the panel shows no photo');

    const region = byAttr(view.document.body, 'role', 'status')[0];
    assert.match(region.textContent, /Photo removed/, 'a notice says so');
    const undo = byText(region, 'Undo');
    assert.ok(undo, 'the notice offers Undo');
    view.act(() => reactProps(undo).onClick(ev()));
    assert.deepEqual(calls[1], ['photo', PHOTO], 'Undo puts the same upload back');
    assert.equal(calls.length, 2, 'and nothing else');
    assert.ok(byText(view.container, 'Remove photo'), 'the panel shows the photo again');
    assert.equal(byAttr(view.container, 'alt', 'Profile')[0]?.getAttribute('src'), PHOTO);
  } finally { await view.unmount(); }
});
