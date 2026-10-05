// R2-148 — a résumé's public copy is never left where nothing can find it. firestore.rules forbid listing
// `public/`, and a copy was found only through its résumé's record (`users/{uid}/shares/{resumeId}`): one
// no record named — the record lost, or a second copy a race left — stayed public for good, with no panel,
// Dashboard Delete or sync able to take it down. Now every copy is written to the account's index,
// `users/{uid}/meta/publicCopies` ({ copies: { [shareId]: resumeId } }), in the same transaction as the
// copy, and taken out with it: the panel reads a copy its record no longer names, Publish reuses it,
// Unpublish and Delete take it down, and the sync's unpublishDeleted finds it. The index document lives
// under the account's own rule (`users/{uid}/{document=**}`), so firestore.rules need no change.
// Over tests/pdf/fake-firestore.mjs, whose transactions run again as the SDK's do and which applies
// firestore.rules. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { fakeFirestore, deferred, settle, resumePath, listPath } from './fake-firestore.mjs';

let link;
before(async () => {
  await setup();
  link = await loadModule('/src/utils/publicLink.js');
});
after(teardown);

const UID = 'uid_owner';
const A = 'resume_alpha';
const B = 'resume_bravo';
const INDEX = `users/${UID}/meta/publicCopies`;
const cv = (id, title = 'Designer') => Object.assign(resume({ personal: { name: 'Jordan Ellery', title } }), { id });

/** An account in the cloud holding these résumés (their documents, as the sync stores them). */
function account(ids = [A, B]) {
  const c = fakeFirestore(Object.fromEntries(ids.map((id) => [resumePath(UID, id), { ...cv(id), updatedAt: 1 }])));
  c.auth = UID;
  return { c, io: link.publicIo(c.fs, c.db) };
}
const copies = (c) => [...c.data.keys()].filter((p) => p.startsWith('public/')).sort();
const index = (c) => c.doc(INDEX)?.copies;
const written = (ops) => ops.map(([, path]) => path);
/** Every document write the server has taken so far (a transaction that writes nothing commits no op). */
const writes = (c) => c.commits.reduce((n, ops) => n + ops.length, 0);
/** The record of a résumé's link is lost (as a wiped `shares` collection, or an older build's race, leaves it). */
const loseRecord = (c, id) => c.data.delete(`users/${UID}/shares/${id}`);
/** A second copy of `id` the index names beside its record's, as a race on an older build left one. */
function strayCopy(c, id, from, stray = 'stray_copy_id') {
  c.data.set(`public/${stray}`, c.doc(`public/${from}`));
  c.data.set(INDEX, { copies: { ...index(c), [stray]: id } });
  return stray;
}

describe('the account\'s index of its public copies (R2-148)', () => {
  it('Publish writes each copy into the index in the same write; an Update leaves it be; Unpublish takes the entry out, and an empty index goes', async () => {
    const { c, io } = account();
    const a = await io.publish(UID, cv(A));
    assert.deepEqual(index(c), { [a.shareId]: A }, 'the copy is in the index');
    assert.ok(written(c.commits.at(-1)).includes(INDEX) && written(c.commits.at(-1)).includes(`public/${a.shareId}`), 'one write: the copy, its record and the index');
    const b = await io.publish(UID, cv(B));
    assert.deepEqual(index(c), { [a.shareId]: A, [b.shareId]: B });

    const commits = c.commits.length;
    await io.publish(UID, cv(A, 'Art Director'), { shareId: a.shareId }); // "Update the public copy"
    assert.equal(c.commits.length, commits + 1);
    assert.ok(!written(c.commits.at(-1)).includes(INDEX), 'the same link: the index is not written again');

    await io.unpublish(UID, A, a.shareId);
    assert.deepEqual(index(c), { [b.shareId]: B });
    await io.unpublish(UID, B, b.shareId);
    assert.equal(c.doc(INDEX), undefined, 'no copy left: no index document');
    assert.deepEqual(copies(c), []);
  });

  it('a copy whose record is lost: the panel still finds it, and its Unpublish takes it and its entry down', async () => {
    const { c, io } = account();
    const { shareId } = await io.publish(UID, cv(A));
    loseRecord(c, A);
    const shown = await io.readShare(UID, A);
    assert.equal(shown?.shareId, shareId, 'the panel shows the copy (was: "not published", the copy public for good)');
    assert.equal(shown.copy.personal.name, 'Jordan Ellery');
    await io.unpublish(UID, A, shown.shareId);
    assert.deepEqual(copies(c), []);
    assert.equal(c.doc(INDEX), undefined);
    assert.equal(await io.readShare(UID, A), null);
  });

  it('a copy whose record is lost goes with the résumé deleted from the Dashboard', async () => {
    const { c, io } = account();
    await io.publish(UID, cv(A));
    const b = await io.publish(UID, cv(B));
    loseRecord(c, A);
    assert.equal(await io.unpublishResume(UID, A), true, 'there was one');
    assert.deepEqual(copies(c), [`public/${b.shareId}`], 'its copy went; the other résumé\'s stays');
    assert.deepEqual(index(c), { [b.shareId]: B });
  });

  it('a Publish from a panel that saw no link, the record lost, reuses the copy the index names: one copy, the link anyone holds still works', async () => {
    const { c, io } = account();
    const first = await io.publish(UID, cv(A));
    loseRecord(c, A);
    const again = await io.publish(UID, cv(A, 'Art Director'));
    assert.equal(again.shareId, first.shareId, 'the same link');
    assert.deepEqual(copies(c), [`public/${first.shareId}`], 'no second copy');
    assert.equal(c.doc(`public/${first.shareId}`).resume.personal.title, 'Art Director');
    assert.equal(c.doc(`users/${UID}/shares/${A}`).shareId, first.shareId, 'the record names it again');
    assert.deepEqual(index(c), { [first.shareId]: A });
  });

  it('a second copy the index names beside the record\'s: Publish keeps the record\'s and takes the other down; so does Unpublish, both', async () => {
    const { c, io } = account();
    const { shareId } = await io.publish(UID, cv(A));
    const stray = strayCopy(c, A, shareId);
    const next = await io.publish(UID, cv(A));
    assert.equal(next.shareId, shareId);
    assert.deepEqual(copies(c), [`public/${shareId}`], 'the stray copy is down');
    assert.deepEqual(index(c), { [shareId]: A });

    strayCopy(c, A, shareId, stray);
    await io.unpublish(UID, A, shareId);
    assert.deepEqual(copies(c), [], 'both copies are down');
    assert.equal(c.doc(INDEX), undefined);
  });

  it('the sync\'s unpublishDeleted finds a copy only the index names, and leaves the copy of a résumé the account holds again', async () => {
    const { c, io } = account();
    const a = await io.publish(UID, cv(A));
    const b = await io.publish(UID, cv(B));
    loseRecord(c, A);
    loseRecord(c, B);
    // A deleted for good (removed and listed); B deleted too, but another device's edit wrote it back (R2-029).
    c.data.delete(resumePath(UID, A));
    c.data.set(listPath(UID), { ids: [A] });
    assert.deepEqual(await io.unpublishDeleted(UID, [A, B]), [A], 'A\'s copy went (was: [], no record named it)');
    assert.deepEqual(copies(c), [`public/${b.shareId}`], 'the copy of the résumé the account holds stays');
    assert.equal(c.doc(`public/${a.shareId}`), undefined);
    assert.deepEqual(index(c), { [b.shareId]: B });

    const before = writes(c);
    assert.deepEqual(await io.unpublishDeleted(UID, [A, B]), [], 'run again: nothing to take down');
    assert.equal(writes(c), before, 'and nothing written');
  });

  it('a takedown run again finds nothing and writes nothing: a second Unpublish, a second Delete', async () => {
    const { c, io } = account();
    const { shareId } = await io.publish(UID, cv(A));
    assert.equal(await io.unpublishResume(UID, A), true);
    const before = writes(c);
    assert.equal(await io.unpublishResume(UID, A), false, 'nothing left');
    await io.unpublish(UID, A, shareId); // a stale panel's Unpublish
    assert.equal(writes(c), before, 'no write: the rules refuse deleting a copy that is not there');
    assert.deepEqual(copies(c), []);
    assert.equal(c.doc(INDEX), undefined);
  });

  it('two résumés published at the same moment (two devices): the index lists both — the second\'s write is refused and runs again on the first\'s index', async () => {
    const { c, io } = account();
    const phone = link.publicIo(c.fs, c.db);
    const both = deferred();
    c.hold.read = both.promise; // both read the index before either writes
    const pending = [io.publish(UID, cv(A)), phone.publish(UID, cv(B))];
    await settle();
    c.hold.read = null;
    both.resolve();
    const [a, b] = await Promise.all(pending);
    assert.deepEqual(index(c), { [a.shareId]: A, [b.shareId]: B }, 'neither entry is lost');
    assert.deepEqual(copies(c), [`public/${a.shareId}`, `public/${b.shareId}`].sort());
  });

  it('a Publish on another device between an Unpublish\'s read and its write: the Unpublish runs again, and the other copy keeps its entry', async () => {
    const { c, io } = account();
    const a = await io.publish(UID, cv(A));
    const phone = link.publicIo(c.fs, c.db);
    let other = null;
    c.afterRead = (path) => {
      if (other || path !== INDEX) return;
      c.afterRead = null;
      other = phone.publish(UID, cv(B));
    };
    await io.unpublish(UID, A, a.shareId);
    const b = await other;
    assert.deepEqual(copies(c), [`public/${b.shareId}`]);
    assert.deepEqual(index(c), { [b.shareId]: B }, 'B\'s entry, written meanwhile, is kept; A\'s is gone');
  });
});
