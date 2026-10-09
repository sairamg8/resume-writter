// The cloud side of the custom interview stages (jobStages.js): one small array of short names,
// `stages`, in the account's jobs meta document `users/{uid}/meta/jobs` — the document the jobs'
// cloud sync keeps its deletion list and order in (collectionSyncIo.js), which only ever writes
// its own fields with merge, as this does. Names are added and removed with arrayUnion and
// arrayRemove, so a name another device adds meanwhile is never lost. The Firestore calls are passed
// in (`fs`), as collectionSyncIo.js has them, so a test runs this very code on a fake Firestore.
// Signing out deletes nothing here: the account's list stays in its cloud. No React, no aliases.
import { MAX_CLOUD_STAGES, cloudStageName, mergeAccountStages, subscribeStageChanges } from './jobStages.js';

export function stagesIo(fs, db) {
  const metaDoc = (uid) => fs.doc(db, 'users', uid, 'meta', 'jobs');
  const write = (uid, stages) => {
    const batch = fs.writeBatch(db);
    batch.set(metaDoc(uid), { stages }, { merge: true });
    return batch.commit();
  };
  return {
    /** The names the account's cloud holds (an empty list when none, or not a list). */
    async read(uid) {
      const snap = await fs.getDocFromServer(metaDoc(uid));
      const saved = snap.exists() ? snap.data().stages : null;
      return Array.isArray(saved) ? saved : [];
    },
    add: (uid, names) => write(uid, fs.arrayUnion(...names)),
    remove: (uid, name) => write(uid, fs.arrayRemove(name)),
  };
}

/**
 * Keep account `uid`'s list and its cloud copy together while a job form is open: the cloud's
 * names come in, the ones only this browser has go up, and each later change is sent. A failure
 * (offline, refused) is logged and nothing else: the list is still the browser's, and the next
 * form to open sends again what the cloud lacks. Returns the function that stops it. `io` is null
 * in a build without a cloud.
 */
export function watchStages(uid, io, log = () => {}) {
  if (!uid || !io) return () => {};
  let live = true;
  // How many names the cloud holds, so additions stop at its cap.
  let size = 0;
  const failed = (e) => log('Interview stages not synced', e);
  io.read(uid).then((names) => {
    if (!live) return;
    size = names.filter(cloudStageName).slice(0, MAX_CLOUD_STAGES).length;
    const send = mergeAccountStages(uid, names);
    if (send.length) { size += send.length; io.add(uid, send).catch(failed); }
  }).catch(failed);
  const stop = subscribeStageChanges((change) => {
    if (change.uid !== uid) return;
    if (change.removed !== undefined) { io.remove(uid, change.removed).catch(failed); return; }
    if (!cloudStageName(change.added) || size >= MAX_CLOUD_STAGES) return;
    size += 1;
    io.add(uid, [change.added]).catch(failed);
  });
  return () => { live = false; stop(); };
}
