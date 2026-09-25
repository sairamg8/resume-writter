// The Firestore calls behind the cloud sync of a plain list (collectionSyncEngine.js) — the jobs
// under `users/{uid}/jobs`, the boards under `users/{uid}/boards` — with the SDK's functions passed
// in (`fs`: collection, doc, getDocsFromServer, getDocFromServer, writeBatch, arrayUnion,
// arrayRemove), as cloudSyncIo.js does for the résumés, so the tests run this very code against a
// fake Firestore (tests/pdf/fake-firestore.mjs). firestore.rules keeps every document under
// `users/{uid}` to that account.
//
// Reads go to the server only (R8-4: a sync planned from the SDK's stale cache wrote it back over
// newer work). The deletion list is never read before it is written: ids are added and removed in
// the batch itself, so no entry another device adds meanwhile is lost.

/** `{ ...data, id }` with the document's own id. */
const withId = (d) => ({ ...d.data(), id: d.id });

/** An item as the server takes it: what its JSON holds (a field holding `undefined` left out, as the SDK refuses one). */
export const asStored = (x) => JSON.parse(JSON.stringify(x));

/** The path segments of item `id` of list `name` in account `uid`: what the size guard counts. */
export const itemPath = (name, uid, id) => ['users', uid, name, id];

export function collectionIo(fs, db, name) {
  const itemsCol = (uid) => fs.collection(db, 'users', uid, name);
  const itemDoc = (uid, id) => fs.doc(db, ...itemPath(name, uid, id));
  const metaDoc = (uid) => fs.doc(db, 'users', uid, 'meta', name);

  return {
    /** The account's list as a first sync needs it: `{ docs, deleted, order }`. */
    async read(uid) {
      const [snap, meta] = await Promise.all([fs.getDocsFromServer(itemsCol(uid)), fs.getDocFromServer(metaDoc(uid))]);
      const m = meta.exists() ? meta.data() : {};
      const ids = (v) => (Array.isArray(v) ? v.filter((id) => typeof id === 'string') : []);
      return { docs: snap.docs.map(withId), deleted: ids(m.deleted), order: ids(m.order) };
    },

    /** The server's copies of these items now, those that exist: a flush keeps a newer one another device wrote. */
    async readItems(uid, ids) {
      const snaps = await Promise.all(ids.map((id) => fs.getDocFromServer(itemDoc(uid, id))));
      return snaps.filter((d) => d.exists()).map(withId);
    },

    /**
     * One batch: whole items written (`sets`) — each id comes off the deletion list, as an edit
     * made where the deletion was never seen wins (collectionSyncPlan.js) — ids removed and added to
     * it (`deletes`), and the list's `order` when given. Resolves when the server has it.
     */
    commit(uid, { sets = [], deletes = [], order = null }) {
      const batch = fs.writeBatch(db);
      sets.forEach((x) => batch.set(itemDoc(uid, x.id), asStored(x)));
      deletes.forEach((id) => batch.delete(itemDoc(uid, id)));
      if (deletes.length) batch.set(metaDoc(uid), { deleted: fs.arrayUnion(...deletes) }, { merge: true });
      if (sets.length) batch.set(metaDoc(uid), { deleted: fs.arrayRemove(...sets.map((x) => x.id)) }, { merge: true });
      if (order) batch.set(metaDoc(uid), { order }, { merge: true });
      return batch.commit();
    },
  };
}
