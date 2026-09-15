// The Firestore calls behind the cloud sync, with the SDK's functions passed in (`fs`: collection,
// doc, getDocs, getDoc, writeBatch), so the tests run this very code against a fake Firestore
// (tests/pdf/fake-firestore.mjs). useCloudSync passes the real functions and `db`; nothing else in
// the sync touches Firebase.

/** `{ ...data, id }` with the document's own id: a flagged sample stub holds no id field (R4-5). */
const withId = (d) => ({ ...d.data(), id: d.id });

export function cloudIo(fs, db) {
  const resumesCol = (uid) => fs.collection(db, 'users', uid, 'resumes');
  const resumeDoc = (uid, id) => fs.doc(db, 'users', uid, 'resumes', id);
  const deletionsDoc = (uid) => fs.doc(db, 'users', uid, 'meta', 'deletions');

  async function readDeletions(uid) {
    const snap = await fs.getDoc(deletionsDoc(uid));
    return snap.exists() ? (snap.data().ids || []) : [];
  }

  return {
    readDeletions,

    /** The account as the first sync needs it: `{ docs, deleted }` — its résumés and its deletion list. */
    async readCloud(uid) {
      const [snap, deleted] = await Promise.all([fs.getDocs(resumesCol(uid)), readDeletions(uid)]);
      return { docs: snap.docs.map(withId), deleted };
    },

    /** The résumés with these ids that the account holds, flagged ones included. */
    async readDocs(uid, ids) {
      const snaps = await Promise.all(ids.map((id) => fs.getDoc(resumeDoc(uid, id))));
      return snaps.filter((d) => d.exists()).map(withId);
    },

    /**
     * One batch: whole résumés written, samples flagged (the rest of the document kept), the rest
     * removed, and the deletion list (`tombstones`, null = left alone). Resolves when the server
     * has it.
     */
    commit(uid, { sets, flags, hardDeletes, tombstones }) {
      const batch = fs.writeBatch(db);
      sets.forEach((r) => batch.set(resumeDoc(uid, r.id), r));
      flags.forEach((id) => batch.set(resumeDoc(uid, id), { deleted: true }, { merge: true }));
      hardDeletes.forEach((id) => batch.delete(resumeDoc(uid, id)));
      if (tombstones) batch.set(deletionsDoc(uid), { ids: tombstones });
      return batch.commit();
    },
  };
}
