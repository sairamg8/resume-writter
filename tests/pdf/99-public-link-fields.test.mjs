// R2-148-d: firestore.rules lets a write to public/{shareId} — the one document anyone can read —
// carry only what src/utils/publicLink.js writes: `{ owner, resume, publishedAt }`, the copy
// publicSnapshot's template, settings, personal, sections and data version, each of its type
// (isPublishedCopy). Before, the rule checked the owner alone, so an account could put any other
// field there. tests/pdf/fake-firestore.mjs applies the same check (tests/unit/firestore-rules.unit.mjs
// pins the rule's lists to publicLink.js); here the app's own publish still passes it, and a
// hand-made write with anything more, less or of another type is refused. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { fakeFirestore } from './fake-firestore.mjs';

let link;
before(async () => {
  await setup();
  link = await loadModule('/src/utils/publicLink.js');
});
after(teardown);

/** A signed-in account's cloud, its public-link calls, and a raw batch writing public/{id}. */
function account() {
  const cloud = fakeFirestore();
  cloud.auth = 'uid_owner';
  const io = link.publicIo(cloud.fs, cloud.db);
  const write = (shareId, value) => {
    const batch = cloud.fs.writeBatch(cloud.db);
    batch.set(cloud.fs.doc(cloud.db, 'public', shareId), value);
    return batch.commit();
  };
  return { cloud, io, write };
}

const sample = () => resume({ personal: { name: 'Jordan Ellery', title: 'Product Designer', email: 'jordan.ellery@example.org' } });
/** What publish() writes for `r`, as a plain document. */
const doc = (r, extra = {}) => ({ owner: 'uid_owner', resume: link.publicSnapshot(r), publishedAt: 1_700_000_000_000, ...extra });

describe('a published copy carries only what publicLink.js writes (R2-148-d)', () => {
  it("the app's publish, and its update, pass", async () => {
    const { cloud, io } = account();
    const r = sample();
    const { shareId } = await io.publish('uid_owner', r);
    assert.deepEqual(Object.keys(cloud.doc(`public/${shareId}`)).toSorted(), ['owner', 'publishedAt', 'resume']);
    await io.publish('uid_owner', { ...r, personal: { ...r.personal, title: 'Art Director' } }, { shareId });
    assert.equal(cloud.doc(`public/${shareId}`).resume.personal.title, 'Art Director');
    const bare = { ...r };
    delete bare.dataVersion;
    await io.publish('uid_owner', bare, { shareId });
    assert.equal(cloud.doc(`public/${shareId}`).resume.dataVersion, undefined, 'a résumé with no data version publishes too');
  });

  it('another field, on the document or on its copy, is refused', async () => {
    const { cloud, write } = account();
    const r = sample();
    await assert.rejects(write('share_a', doc(r, { tracker: 'https://tracker.example.com/pixel.gif' })), /permission/i,
      'before: written — any field went into the one document anyone can read');
    await assert.rejects(write('share_b', doc(r, { resume: { ...link.publicSnapshot(r), coverLetter: { body: 'Private' } } })), /permission/i);
    assert.equal(cloud.doc('public/share_a'), undefined);
    assert.equal(cloud.doc('public/share_b'), undefined);
  });

  it('a field missing, or of another type, is refused', async () => {
    const { write } = account();
    const r = sample();
    const { publishedAt: _p, ...noTime } = doc(r);
    const { sections: _s, ...noSections } = link.publicSnapshot(r);
    for (const [why, value] of [
      ['no publishedAt', noTime],
      ['no sections', doc(r, { resume: noSections })],
      ['publishedAt a string', doc(r, { publishedAt: 'yesterday' })],
      ['sections a map', doc(r, { resume: { ...link.publicSnapshot(r), sections: { a: 1 } } })],
      ['template a number', doc(r, { resume: { ...link.publicSnapshot(r), template: 7 } })],
      ['dataVersion a string', doc(r, { resume: { ...link.publicSnapshot(r), dataVersion: '13' } })],
      ['resume a string', doc(r, { resume: 'hello' })],
    ]) {
      await assert.rejects(write(`share_${why.replace(/\W/g, '_')}`, value), /permission/i, why);
    }
  });

  it('an update that adds a field is refused, and the copy stays as it was', async () => {
    const { cloud, io, write } = account();
    const { shareId } = await io.publish('uid_owner', sample());
    await assert.rejects(write(shareId, doc(sample(), { note: 'extra' })), /permission/i);
    assert.equal(cloud.doc(`public/${shareId}`).note, undefined);
    assert.equal(cloud.doc(`public/${shareId}`).resume.personal.name, 'Jordan Ellery');
  });
});
