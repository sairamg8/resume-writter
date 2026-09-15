// The Firestore calls behind the cloud sync, with the SDK's functions passed in (`fs`: collection,
// doc, getDocsFromServer, getDocFromServer, writeBatch, arrayUnion), so the tests run
// this very code against a fake Firestore (tests/pdf/fake-firestore.mjs). useCloudSync passes the
// real functions and `db`; nothing else in the sync touches Firebase.
//
// Reads go to the server only: when the SDK cannot reach it, getDocs/getDoc answer from the
// persistent cache, and a sync planned from that stale copy wrote it back over newer work (R8-4).
// The deletion list is never read before it is written: ids are added in the batch itself
// (arrayUnion), so no entry another device adds meanwhile is lost.

/** `{ ...data, id }` with the document's own id: a flag stub holds no id field (R4-5). */
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

    /**
     * What a restore of the originals needs: `{ docs, deleted }` — the résumés with these ids that
     * the account holds, flagged ones included, and its deletion list as it is now (an original
     * deleted for good since this device's first sync must not come back, V2OWNER-DATA-0).
     */
    async readCopies(uid, ids) {
      const [snaps, list] = await Promise.all([
        Promise.all(ids.map((id) => fs.getDocFromServer(resumeDoc(uid, id)))), fs.getDocFromServer(deletionsDoc(uid)),
      ]);
      return { docs: snaps.filter((d) => d.exists()).map(withId), deleted: list.exists() ? (list.data().ids || []) : [] };
    },

    /**
     * One batch: whole résumés written (`sets`), originals flagged (the rest of the document
     * kept; `marks` marked an original too — one marked here and deleted before the mark was
     * sent), the rest removed, and their ids added to the deletion list (`listAdd`). Nothing ever
     * comes off the list: an id on it was deleted for good. Resolves when the server has it.
     */
    commit(uid, { sets, flags, marks = [], hardDeletes, listAdd = [] }) {
      const batch = fs.writeBatch(db);
      sets.forEach((r) => batch.set(resumeDoc(uid, r.id), r));
      flags.forEach((id) => batch.set(resumeDoc(uid, id), marks.includes(id) ? { deleted: true, keep: true } : { deleted: true }, { merge: true }));
      hardDeletes.forEach((id) => batch.delete(resumeDoc(uid, id)));
      if (listAdd.length) batch.set(deletionsDoc(uid), { ids: fs.arrayUnion(...listAdd) }, { merge: true });
      return batch.commit();
    },
  };
}
