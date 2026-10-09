// The cloud side of the custom interview stages (jobStages.js): one small array of short names,
// `stages`, in the account's jobs meta document `users/{uid}/meta/jobs` — the document the jobs'
// cloud sync keeps its deletion list and order in (collectionSyncIo.js), which only ever writes
// its own fields with merge, as this does. Names are added and removed with arrayUnion and
// arrayRemove, so a name another device adds meanwhile is never lost. A removal also leaves the
// name in `removedStages` (a tombstone, the way the jobs' sync keeps its `deleted` list), written in
// the same batch, so a device that still holds the name finds it removed and drops it instead of
// sending it up again; adding a name takes it off that list. The field is new and only added:
// a build that does not know it reads and writes `stages` as before. The Firestore calls are passed
// in (`fs`), as collectionSyncIo.js has them, so a test runs this very code on a fake Firestore.
// Signing out deletes nothing here: the account's list stays in its cloud. No React, no aliases.
import { MAX_CLOUD_STAGES, MAX_CLOUD_TOMBSTONES, cloudStageName, confirmStageRemoved, mergeAccountStages, subscribeStageChanges } from './jobStages.js';

export function stagesIo(fs, db) {
  const metaDoc = (uid) => fs.doc(db, 'users', uid, 'meta', 'jobs');
  const write = (uid, fields) => {
    const batch = fs.writeBatch(db);
    batch.set(metaDoc(uid), fields, { merge: true });
    return batch.commit();
  };
  const list = (v) => (Array.isArray(v) ? v : []);
  return {
    /** The names the account's cloud holds, and the ones it remembers as removed (empty lists when none, or not lists). */
    async read(uid) {
      const snap = await fs.getDocFromServer(metaDoc(uid));
      const data = snap.exists() ? snap.data() : {};
      return { stages: list(data.stages), removed: list(data.removedStages) };
    },
    add: (uid, names) => write(uid, { stages: fs.arrayUnion(...names), removedStages: fs.arrayRemove(...names) }),
    /** `known`: the names already remembered as removed; full, the oldest make room for this one. */
    remove(uid, name, known = []) {
      const others = known.filter((s) => s !== name);
      const removedStages = others.length >= MAX_CLOUD_TOMBSTONES
        ? [...others.slice(-(MAX_CLOUD_TOMBSTONES - 1)), name]
        : fs.arrayUnion(name);
      return write(uid, { stages: fs.arrayRemove(name), removedStages });
    },
  };
}

/**
 * Keep account `uid`'s list and its cloud copy together while a job form is open: the cloud's
 * names come in, the ones only this browser has go up, a name the cloud has removed leaves this
 * browser's list, a removal made here that the cloud lacks goes up, and each later change is sent.
 * A failure (offline, refused) is logged and nothing else: the list is still the browser's, and
 * the next form to open sends again what the cloud lacks. Returns the function that stops it. `io`
 * is null in a build without a cloud.
 */
export function watchStages(uid, io, log = () => {}) {
  if (!uid || !io) return () => {};
  let live = true;
  // How many names the cloud holds, so additions stop at its cap; and the names it remembers as removed.
  let size = 0;
  let removedNow = [];
  const failed = (e) => log('Interview stages not synced', e);
  const sendRemoval = (name) => {
    if (!cloudStageName(name)) { confirmStageRemoved(uid, name); return; }
    io.remove(uid, name, removedNow).then(() => {
      removedNow = [...removedNow.filter((s) => s !== name), name].slice(-MAX_CLOUD_TOMBSTONES);
      confirmStageRemoved(uid, name);
    }).catch(failed);
  };
  io.read(uid).then(({ stages, removed }) => {
    if (!live) return;
    size = stages.filter(cloudStageName).slice(0, MAX_CLOUD_STAGES).length;
    removedNow = removed.filter(cloudStageName).slice(-MAX_CLOUD_TOMBSTONES);
    const { add, remove } = mergeAccountStages(uid, stages, removedNow);
    if (add.length) {
      size += add.length;
      removedNow = removedNow.filter((s) => !add.includes(s));
      io.add(uid, add).catch(failed);
    }
    remove.forEach(sendRemoval);
  }).catch(failed);
  const stop = subscribeStageChanges((change) => {
    if (change.uid !== uid) return;
    if (change.removed !== undefined) { sendRemoval(change.removed); return; }
    if (!cloudStageName(change.added) || size >= MAX_CLOUD_STAGES) return;
    size += 1;
    removedNow = removedNow.filter((s) => s !== change.added);
    io.add(uid, [change.added]).catch(failed);
  });
  return () => { live = false; stop(); };
}
