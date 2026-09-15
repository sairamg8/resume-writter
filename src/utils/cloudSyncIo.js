// The Firestore calls behind the cloud sync, with the SDK's functions passed in (`fs`: collection,
// doc, getDocsFromServer, getDocFromServer, writeBatch, arrayUnion, arrayRemove), so the tests run
// this very code against a fake Firestore (tests/pdf/fake-firestore.mjs). useCloudSync passes the
// real functions and `db`; nothing else in the sync touches Firebase.
//
// Reads go to the server only: when the SDK cannot reach it, getDocs/getDoc answer from the
// persistent cache, and a sync planned from that stale copy wrote it back over newer work (R8-4).
// The deletion list is never read before it is written: ids are added and taken off in the
// batch itself (arrayUnion / arrayRemove), so no entry another device adds meanwhile is lost.

/** `{ ...data, id }` with the document's own id: a flagged sample stub holds no id field (R4-5). */
const withId = (d) => ({ ...d.data(), id: d.id });

export function cloudIo(fs, db) {
  const resumesCol = (uid) => fs.collection(db, 'users', uid, 'resumes');
  const resumeDoc = (uid, id) => fs.doc(db, 'users', uid, 'resumes', id);
  const deletionsDoc = (uid) => fs.doc(db, 'users', uid, 'meta', 'deletions');

  return {
    /** The account as the first sync needs it: `{ docs, deleted }` — its résumés and its deletion list. */
    async readCloud(uid) {
      const [snap, list] = await Promise.all([fs.getDocsFromServer(resumesCol(uid)), fs.getDocFromServer(deletionsDoc(uid))]);
      return { docs: snap.docs.map(withId), deleted: list.exists() ? (list.data().ids || []) : [] };
    },

    /** The résumés with these ids that the account holds, flagged ones included. */
    async readDocs(uid, ids) {
      const snaps = await Promise.all(ids.map((id) => fs.getDocFromServer(resumeDoc(uid, id))));
      return snaps.filter((d) => d.exists()).map(withId);
    },

    /**
     * One batch: whole résumés written (`sets`), samples flagged (the rest of the document kept),
     * the rest removed, ids added to the deletion list (`listAdd`) and taken off it
     * (`listRemove`, restored samples). Resolves when the server has it.
     */
    commit(uid, { sets, flags, hardDeletes, listAdd = [], listRemove = [] }) {
      const batch = fs.writeBatch(db);
      sets.forEach((r) => batch.set(resumeDoc(uid, r.id), r));
      flags.forEach((id) => batch.set(resumeDoc(uid, id), { deleted: true }, { merge: true }));
      hardDeletes.forEach((id) => batch.delete(resumeDoc(uid, id)));
      if (listAdd.length) batch.set(deletionsDoc(uid), { ids: fs.arrayUnion(...listAdd) }, { merge: true });
      if (listRemove.length) batch.set(deletionsDoc(uid), { ids: fs.arrayRemove(...listRemove) }, { merge: true });
      return batch.commit();
    },
  };
}
