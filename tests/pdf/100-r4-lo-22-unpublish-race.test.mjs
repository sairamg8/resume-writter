// R4-LO-22, its other half (found by the review): Unpublish, and a résumé's deletion taking its copy
// down, read the account's record of the link and then wrote a batch. A Publish on another device
// between the two put a new copy and pointed the record at it; the batch then deleted the record and
// left that copy public with nothing naming it — no panel, Dashboard Delete or sync could take it down.
// takeDown is now one transaction: the record read is checked at the commit, and a changed one runs
// it again. Pinned: whatever wins, no copy is left public without the record naming it. Over
// tests/pdf/fake-firestore.mjs, whose runTransaction retries as the SDK's does. Fictional data only.
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

const RID = 'resume_one';
const SHARE = `users/uid_owner/shares/${RID}`;
const copies = (c) => [...c.data.keys()].filter((p) => p.startsWith('public/'));
const cv = () => Object.assign(resume({ personal: { name: 'Jordan Ellery', title: 'Designer' } }), { id: RID });

/** Another device's Publish, landed on the server just after this one read the record. */
function publishElsewhereAfterRecordRead(c) {
  c.afterRead = (path) => {
    if (path !== SHARE) return;
    c.afterRead = null;
    c.data.set('public/phone_link', { owner: 'uid_owner', resume: link.publicSnapshot(cv()), publishedAt: 2 });
    c.data.set(SHARE, { shareId: 'phone_link', publishedAt: 2 });
  };
}

/** Every public copy is the one the record names. */
function noOrphan(c, what) {
  const record = c.data.get(SHARE);
  for (const p of copies(c)) assert.equal(p, `public/${record?.shareId}`, `${what}: ${p} is public with no record naming it`);
}

for (const [what, takeDown] of [
  ['Unpublish from a panel that showed no link', (io) => io.unpublish('uid_owner', RID, 'panel_link')],
  ['a deleted résumé\'s copy taken down', (io) => io.unpublishResume('uid_owner', RID)],
  ['the sync taking down the copies of deleted résumés', (io) => io.unpublishDeleted('uid_owner', [RID])],
]) {
  it(`${what}, with a Publish elsewhere between its read and its write, leaves no orphan copy`, async () => {
    const c = fakeFirestore();
    c.auth = 'uid_owner';
    const io = link.publicIo(c.fs, c.db);
    if (what.startsWith('the sync')) {
      // The sync knows the résumé had a link: its record is there when the list is read.
      await io.publish('uid_owner', cv());
    }
    publishElsewhereAfterRecordRead(c);
    await takeDown(io);
    noOrphan(c, what);
  });
}
