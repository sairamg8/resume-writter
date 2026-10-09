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

/**
 * Whether Firestore can name a document `id`: not empty, no "/" (a path, not an id), not "." or
 * "..", not "__…__". One it cannot was never in the cloud (an imported job's "linkedin/3912345",
 * held: R5-HUNT7), so its deletion is nothing to send (R5-HUNT8).
 */
export const cloudCanName = (id) => typeof id === 'string' && id !== '' && !id.includes('/')
  && id !== '.' && id !== '..' && !/^__.*__$/.test(id);

/**
 * How many items one batch takes: Firestore refuses a batch of more than 500 writes, and each
 * batch also writes the deletion list (twice) and the order, so some are kept back.
 */
const BATCH_ITEMS = 450;

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
     * Whole items written (`sets`) — each id comes off the deletion list, as an edit made where the
     * deletion was never seen wins (collectionSyncPlan.js) — ids removed and added to it
     * (`deletes`), and the list's `order` when given. Resolves when the server has it. A batch
     * holds 500 writes at most: a bigger change (a first sync of some hundreds of jobs) goes in
     * several, one after the other, sets then deletes then the order, each with its own deletion
     * list writes; the first is handed over before this returns.
     */
    commit(uid, { sets = [], deletes = [], order = null }) {
      const send = (part) => {
        const batch = fs.writeBatch(db);
        part.sets.forEach((x) => batch.set(itemDoc(uid, x.id), asStored(x)));
        part.deletes.forEach((id) => batch.delete(itemDoc(uid, id)));
        if (part.deletes.length) batch.set(metaDoc(uid), { deleted: fs.arrayUnion(...part.deletes) }, { merge: true });
        if (part.sets.length) batch.set(metaDoc(uid), { deleted: fs.arrayRemove(...part.sets.map((x) => x.id)) }, { merge: true });
        if (part.order) batch.set(metaDoc(uid), { order: part.order }, { merge: true });
        return batch.commit();
      };
      const parts = [{ sets: [], deletes: [], order: null }];
      const put = (kind, x) => {
        let part = parts.at(-1);
        if (part.sets.length + part.deletes.length >= BATCH_ITEMS) { part = { sets: [], deletes: [], order: null }; parts.push(part); }
        part[kind].push(x);
      };
      sets.forEach((x) => put('sets', x));
      deletes.forEach((id) => put('deletes', id));
      parts.at(-1).order = order;
      return parts.slice(1).reduce((done, part) => done.then(() => send(part)), send(parts[0]));
    },
  };
}
