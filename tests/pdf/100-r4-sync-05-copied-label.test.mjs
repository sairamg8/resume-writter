// R4-SYNC-05: the share panel's Copy button said "Copied" for good once clicked: after Unpublish
// and Publish again (a new link), or after closing the panel and opening it again, it still read
// "Copied" for a link never copied, so the user might paste the old, dead one. It now reads "Copy"
// again for a new link and whenever the panel opens. Mounted with react-dom/client over
// tests/pdf/fake-dom.mjs. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';
import { fakeFirestore } from './fake-firestore.mjs';

let link;
let ShareLinkModal;
before(async () => {
  await setup();
  link = await loadModule('/src/utils/publicLink.js');
  ({ default: ShareLinkModal } = await loadModule('/src/components/ShareLinkModal.jsx'));
});
after(teardown);

const flush = async () => { for (let i = 0; i < 20; i += 1) await new Promise((r) => { setImmediate(r); }); };
const until = async (done) => { for (const end = Date.now() + 30_000; !done() && Date.now() < end;) await new Promise((r) => { setTimeout(r, 10); }); };
const buttons = (view) => [...elements(view.container)].filter((el) => el.tagName === 'BUTTON');
const buttonNamed = (view, name) => buttons(view).find((el) => el.textContent.trim() === name);
/** The Copy button, whatever it says now. */
const copyButton = (view) => buttons(view).find((el) => /^(Copy|Copied|Copy failed)$/.test(el.textContent.trim()));
const click = (view, el) => view.act(() => reactProps(el).onClick({}));

it('"Copied" goes back to "Copy" for a new link, and when the panel opens again', async () => {
  const cloud = fakeFirestore();
  cloud.auth = 'uid_owner';
  const io = link.publicIo(cloud.fs, cloud.db);
  const props = { isOpen: true, resume: resume({ personal: { name: 'Jordan Ellery' } }), uid: 'uid_owner', io, onClose: () => {} };
  const view = mount(ShareLinkModal, props);
  const copy = async () => {
    click(view, copyButton(view));
    await until(() => copyButton(view).textContent.trim() !== 'Copy');
    assert.notEqual(copyButton(view).textContent.trim(), 'Copy', 'the click was answered');
  };
  try {
    await until(() => buttonNamed(view, 'Publish'));
    click(view, buttonNamed(view, 'Publish'));
    await until(() => copyButton(view));
    await copy();

    click(view, buttonNamed(view, 'Unpublish'));
    click(view, buttonNamed(view, 'Yes, unpublish')); // it asks first (R4-DUX-10)
    await until(() => buttonNamed(view, 'Publish'));
    click(view, buttonNamed(view, 'Publish'));
    await until(() => copyButton(view));
    assert.equal(copyButton(view).textContent.trim(), 'Copy', 'a new link, not yet copied');

    await copy();
    view.update({ ...props, isOpen: false });
    view.update({ ...props });
    await until(() => copyButton(view));
    await flush();
    assert.equal(copyButton(view).textContent.trim(), 'Copy', 'the panel opened again');
  } finally {
    await view.unmount();
  }
});
