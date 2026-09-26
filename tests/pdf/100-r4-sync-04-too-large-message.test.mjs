// R4-SYNC-04: publishing a résumé too large for the cloud (over 1 MB, usually its photo) said
// "Publishing failed (This résumé is too large to publish … try again.). Check your connection and
// try again." — nested brackets, and a pointer to the connection, which has nothing to do with it.
// It now shows the size message alone; a network failure keeps the connection wording. Mounted with
// react-dom/client over tests/pdf/fake-dom.mjs. Fictional data only.
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

const until = async (done) => { for (const end = Date.now() + 30_000; !done() && Date.now() < end;) await new Promise((r) => { setTimeout(r, 10); }); };
const buttonNamed = (view, name) => [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === name);
const alertText = (view) => [...elements(view.container)].find((el) => el.getAttribute('role') === 'alert')?.textContent;

async function publishIn(r, cloud) {
  const io = link.publicIo(cloud.fs, cloud.db);
  const view = mount(ShareLinkModal, { isOpen: true, resume: r, uid: 'uid_owner', io, onClose: () => {} });
  await until(() => buttonNamed(view, 'Publish'));
  view.act(() => reactProps(buttonNamed(view, 'Publish')).onClick({}));
  await until(() => alertText(view));
  return view;
}

it('a résumé over 1 MB says only that it is too large', async () => {
  const cloud = fakeFirestore();
  cloud.auth = 'uid_owner';
  const r = resume({ personal: { name: 'Jordan Ellery', photo: `data:image/jpeg;base64,${'A'.repeat(1_100_000)}` } });
  const view = await publishIn(r, cloud);
  try {
    assert.equal(alertText(view), 'This résumé is too large to publish (over 1 MB, usually its photo). Use a smaller photo and try again.');
  } finally { await view.unmount(); }
});

it('a network failure still points to the connection', async () => {
  const cloud = fakeFirestore();
  cloud.auth = 'uid_owner';
  const r = resume({ personal: { name: 'Jordan Ellery' } });
  const io = link.publicIo(cloud.fs, cloud.db);
  const view = mount(ShareLinkModal, { isOpen: true, resume: r, uid: 'uid_owner', io, onClose: () => {} });
  try {
    await until(() => buttonNamed(view, 'Publish'));
    cloud.fail.commit = Object.assign(new Error('Could not reach Cloud Firestore backend.'), { code: 'unavailable' });
    cloud.fail.read = null;
    view.act(() => reactProps(buttonNamed(view, 'Publish')).onClick({}));
    await until(() => alertText(view));
    assert.match(alertText(view), /^Publishing failed \(Could not reach Cloud Firestore backend\.\)\. Check your connection and try again\.$/);
  } finally { await view.unmount(); }
});
