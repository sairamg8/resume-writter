// R4-LO-22: two Publishes of one résumé within one round trip (two tabs, or a tab and a phone)
// both read "no record" before either wrote, so each made its own copy at a new link; the second
// pointed the account's record at its own, and the first stayed public with nothing naming it — no
// panel, Dashboard Delete or sync could take it down (R4-SYNC-01's remaining race). Publish is now
// one transaction: the server refuses the second's write, as the record changed since it was read,
// and it runs again and reuses the first one's link. Over tests/pdf/fake-firestore.mjs, whose
// runTransaction retries as the SDK's does and applies firestore.rules. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { fakeFirestore, deferred, settle } from './fake-firestore.mjs';

let link;
before(async () => {
  await setup();
  link = await loadModule('/src/utils/publicLink.js');
});
after(teardown);

const copies = (c) => [...c.data.keys()].filter((p) => p.startsWith('public/'));
const cv = () => Object.assign(resume({ personal: { name: 'Jordan Ellery', title: 'Designer' } }), { id: 'resume_one' });

it('two Publishes that both read "no record" make one copy, which one Unpublish takes down', async () => {
  const c = fakeFirestore();
  c.auth = 'uid_owner';
  const io = link.publicIo(c.fs, c.db);
  const r = cv();
  // Both reads are answered only once both have been sent: neither has written yet.
  const both = deferred();
  c.hold.read = both.promise;
  const tab1 = io.publish('uid_owner', r);
  const tab2 = io.publish('uid_owner', r);
  await settle();
  c.hold.read = null;
  both.resolve();
  const [first, second] = await Promise.all([tab1, tab2]);

  assert.equal(second.shareId, first.shareId, 'both panels show the one link');
  assert.deepEqual(copies(c), [`public/${first.shareId}`], 'before: two copies, one of them named by no record');
  assert.equal(c.doc(`users/uid_owner/shares/${r.id}`).shareId, first.shareId);

  await io.unpublish('uid_owner', r.id, first.shareId);
  assert.deepEqual(copies(c), [], 'nothing left public');
});

it('a Publish on another device between this one\'s read and its write shares one link with it', async () => {
  const c = fakeFirestore();
  c.auth = 'uid_owner';
  const io = link.publicIo(c.fs, c.db);
  const r = cv();
  const other = link.publicIo(c.fs, c.db); // the phone
  let phone = null;
  // Just after this tab reads "no record", before it writes, the phone publishes: it reads "no
  // record" too. Whichever writes second finds the record changed and runs again.
  c.afterRead = (path) => {
    if (phone || path !== `users/uid_owner/shares/${r.id}`) return;
    c.afterRead = null;
    phone = other.publish('uid_owner', r);
  };
  const mine = await io.publish('uid_owner', r);
  const theirs = await phone;
  assert.equal(mine.shareId, theirs.shareId);
  assert.deepEqual(copies(c), [`public/${theirs.shareId}`]);
});
