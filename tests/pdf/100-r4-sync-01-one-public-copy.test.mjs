// R4-SYNC-01: publishing one résumé from two tabs or devices left a public copy nobody could take
// down. The second panel had seen no link, so its Publish made a new id and pointed the account's
// record at it; Unpublish in the first tab then deleted its copy and the record, and the second copy
// stayed public with no record naming it — no panel, Dashboard Delete or sync ever found it. And an
// Unpublish from a panel whose copy another tab had already taken down failed for good: the rules
// refuse deleting a copy that is not there. Now Publish reuses the link the account recorded, and
// Unpublish takes down the copy the panel shows and the one the record names, each only if it is
// there. A résumé has one public copy at most. Over tests/pdf/fake-firestore.mjs, which applies
// firestore.rules. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { fakeFirestore } from './fake-firestore.mjs';

let link;
before(async () => {
  await setup();
  link = await loadModule('/src/utils/publicLink.js');
});
after(teardown);

function cloud() {
  const c = fakeFirestore();
  c.auth = 'uid_owner';
  return { c, io: link.publicIo(c.fs, c.db) };
}
const copies = (c) => [...c.data.keys()].filter((p) => p.startsWith('public/'));
const cv = () => Object.assign(resume({ personal: { name: 'Jordan Ellery', title: 'Designer' } }), { id: 'resume_one' });

it('two panels that both saw no link publish one copy, and one Unpublish takes it down', async () => {
  const { c, io } = cloud();
  const r = cv();
  assert.equal(await io.readShare('uid_owner', r.id), null, 'tab 1: not published');
  assert.equal(await io.readShare('uid_owner', r.id), null, 'tab 2: not published');
  const first = await io.publish('uid_owner', r);
  const second = await io.publish('uid_owner', r); // tab 2's Publish, from its stale view
  assert.equal(second.shareId, first.shareId, 'the link the account has');
  assert.deepEqual(copies(c), [`public/${first.shareId}`]);

  await io.unpublish('uid_owner', r.id, first.shareId); // tab 1's Unpublish
  assert.deepEqual(copies(c), [], 'nothing left public');
  assert.equal(c.doc(`users/uid_owner/shares/${r.id}`), undefined);
});

it("an Unpublish from a panel whose copy another tab already took down succeeds", async () => {
  const { c, io } = cloud();
  const r = cv();
  const { shareId } = await io.publish('uid_owner', r);
  await io.unpublish('uid_owner', r.id, shareId); // the other tab
  await io.unpublish('uid_owner', r.id, shareId); // this tab's stale panel: no permission error
  assert.deepEqual(copies(c), []);
});

it("an Unpublish from a stale panel also takes down the copy another tab published since", async () => {
  const { c, io } = cloud();
  const r = cv();
  const old = await io.publish('uid_owner', r);
  await io.unpublish('uid_owner', r.id, old.shareId); // tab 2 unpublishes …
  const fresh = await io.publish('uid_owner', r); // … and publishes again: a new link
  assert.notEqual(fresh.shareId, old.shareId);
  await io.unpublish('uid_owner', r.id, old.shareId); // tab 1 still shows the old link
  assert.deepEqual(copies(c), [], 'the new copy is down too');
  assert.equal(c.doc(`users/uid_owner/shares/${r.id}`), undefined);
});

it("an Update from a stale panel puts the copy at the recorded link, leaving no second copy", async () => {
  const { c, io } = cloud();
  const r = cv();
  const old = await io.publish('uid_owner', r);
  await io.unpublish('uid_owner', r.id, old.shareId);
  const fresh = await io.publish('uid_owner', r);
  const edited = { ...r, personal: { ...r.personal, title: 'Art Director' } };
  const next = await io.publish('uid_owner', edited, { shareId: old.shareId }); // tab 1's 'Update the public copy'
  assert.equal(next.shareId, fresh.shareId);
  assert.deepEqual(copies(c), [`public/${fresh.shareId}`]);
  assert.equal(c.doc(`public/${fresh.shareId}`).resume.personal.title, 'Art Director');
  assert.equal(c.doc(`users/uid_owner/shares/${r.id}`).shareId, fresh.shareId);
});

it('a stray copy at the panel\'s link, when the record names another, is taken down on Update', async () => {
  const { c, io } = cloud();
  const r = cv();
  // As an older build left it: two copies, the record naming the second.
  const stray = await io.publish('uid_owner', r, { shareId: 'stray_copy_id' });
  c.data.set(`public/recorded_copy_id`, { ...c.doc(`public/${stray.shareId}`) });
  c.data.set(`users/uid_owner/shares/${r.id}`, { shareId: 'recorded_copy_id', publishedAt: 1 });
  const next = await io.publish('uid_owner', r, { shareId: 'stray_copy_id' });
  assert.equal(next.shareId, 'recorded_copy_id');
  assert.deepEqual(copies(c), ['public/recorded_copy_id']);
});
