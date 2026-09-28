// R4-DUX-10: in Share a public link, one click on Unpublish deleted the public copy and the
// account's record of it, and publishing again mints a new link, so every link already sent went
// dead with no warning. Unpublish now asks first, inline: it says anyone with the link loses it
// and publishing again makes a new link; Cancel keeps the copy, "Yes, unpublish" takes it down.
// Mounted with react-dom/client over tests/pdf/fake-dom.mjs. Fictional data only.
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
const click = (view, el) => view.act(() => reactProps(el).onClick({}));

it('Unpublish asks first; Cancel keeps the link, "Yes, unpublish" takes it down', async () => {
  const cloud = fakeFirestore();
  cloud.auth = 'uid_owner';
  const io = link.publicIo(cloud.fs, cloud.db);
  const r = resume({ personal: { name: 'Jordan Ellery' } });
  const props = { isOpen: true, resume: r, uid: 'uid_owner', io, onClose: () => {} };
  const view = mount(ShareLinkModal, props);
  const text = () => view.container.textContent;
  try {
    await until(() => buttonNamed(view, 'Publish'));
    click(view, buttonNamed(view, 'Publish'));
    await until(() => buttonNamed(view, 'Unpublish'));
    const { shareId } = cloud.doc(`users/uid_owner/shares/${r.id}`);
    assert.ok(cloud.doc(`public/${shareId}`), 'published');

    // The first click only asks.
    click(view, buttonNamed(view, 'Unpublish'));
    await flush();
    assert.ok(cloud.doc(`public/${shareId}`), 'one click leaves the public copy up');
    assert.ok(cloud.doc(`users/uid_owner/shares/${r.id}`), 'and the record of it');
    assert.match(text(), /Anyone with this link will no longer be able to open it/);
    assert.match(text(), /Publishing again later makes a new link/);
    assert.ok(buttonNamed(view, 'Yes, unpublish'), 'a confirm button');

    click(view, buttonNamed(view, 'Cancel'));
    await flush();
    assert.equal(buttonNamed(view, 'Yes, unpublish'), undefined, 'Cancel closes the question');
    assert.ok(buttonNamed(view, 'Unpublish'));
    assert.ok(cloud.doc(`public/${shareId}`), 'Cancel keeps the copy');

    // Closing the panel mid-question does not leave it armed for the next opening.
    click(view, buttonNamed(view, 'Unpublish'));
    view.update({ ...props, isOpen: false });
    view.update({ ...props });
    await until(() => buttonNamed(view, 'Unpublish'));
    assert.equal(buttonNamed(view, 'Yes, unpublish'), undefined, 'the panel opened again asks afresh');

    click(view, buttonNamed(view, 'Unpublish'));
    click(view, buttonNamed(view, 'Yes, unpublish'));
    await until(() => buttonNamed(view, 'Publish'));
    assert.equal(cloud.doc(`public/${shareId}`), undefined, 'confirmed, the copy is gone');
    assert.equal(cloud.doc(`users/uid_owner/shares/${r.id}`), undefined);
  } finally {
    await view.unmount();
  }
});
