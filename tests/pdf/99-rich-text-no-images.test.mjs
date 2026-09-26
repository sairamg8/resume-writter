// R4-ED-02: a copied screenshot pasted into a description or the summary (Firefox, Safari: a
// clipboard holding image data and no text) was left to the browser, which put its own
// <img src="data:image/png;base64,…"> into the field. The input that followed stored innerHTML as it
// was, so the description held 1–5 MB of base64 that never prints: 'browser storage is full', and the
// résumé's cloud copy went over Firestore's 1 MB. Now a paste or a drop with no text inserts nothing,
// and what the editor stores never keeps a picture, whichever way one got in.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps, withInnerHtml } from './fake-dom.mjs';

before(async () => { await setup(); withInnerHtml(); });
after(teardown);

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
/** A clipboard or a drop holding only an image file: no text/html, no text/plain. */
const imageOnly = () => ({
  getData: () => '',
  types: ['Files'],
  files: [{ name: 'screenshot.png', type: 'image/png' }],
  items: [{ kind: 'file', type: 'image/png' }],
});

async function editor() {
  const { default: RichTextEditor } = await loadModule('/src/components/RichTextEditor.jsx');
  const stored = [];
  const view = mount(RichTextEditor, { label: 'Description', value: '<p>Led the team</p>', onChange: (v) => stored.push(v) });
  const box = [...elements(view.container)].find((el) => el.getAttribute('role') === 'textbox');
  const fire = (name, event) => view.act(() => reactProps(box)[name](event));
  return { view, box, stored, fire };
}

describe('an image pasted or dropped into a rich-text field is never stored (R4-ED-02)', () => {
  it('a paste of an image alone is cancelled: the browser inserts nothing of its own', async () => {
    const { view, fire } = await editor();
    try {
      let prevented = false;
      fire('onPaste', { clipboardData: imageOnly(), preventDefault: () => { prevented = true; } });
      assert.equal(prevented, true, 'the browser\'s own paste of the image is cancelled');
    } finally { await view.unmount(); }
  });

  it('a drop of an image file is cancelled too', async () => {
    const { view, fire } = await editor();
    try {
      let prevented = false;
      fire('onDrop', { dataTransfer: imageOnly(), clientX: 1, clientY: 1, preventDefault: () => { prevented = true; } });
      assert.equal(prevented, true);
    } finally { await view.unmount(); }
  });

  it('a picture that is in the field anyway is dropped before the value is stored', async () => {
    const { view, box, stored, fire } = await editor();
    try {
      box.innerHTML = `<p>Led the team<img src="${PNG}" alt=""></p><ul><li>Shipped <picture><img src="${PNG}"></picture>it</li></ul>`;
      fire('onInput', {});
      assert.equal(stored.length, 1);
      assert.doesNotMatch(stored[0], /<img|<picture|data:/i, stored[0]);
      assert.equal(stored[0], '<p>Led the team</p><ul><li>Shipped it</li></ul>');
      assert.doesNotMatch(box.innerHTML, /<img/i, 'the field no longer shows it either');
    } finally { await view.unmount(); }
  });
});
