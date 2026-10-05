import { doc, getDocFromServer, runTransaction } from 'firebase/firestore';
import { db } from '@/utils/firebase';

// The calls publicIo returns (publicLink.js); every one is async.
const CALLS = ['readShare', 'publish', 'unpublish', 'unpublishResume', 'unpublishDeleted', 'readPublic'];

/**
 * publicIo(fs, db) (publicLink.js), with publicLink.js loaded at the first call rather than at start-up.
 * Its callers on the start-up path, the Dashboard (unpublish on delete) and the cloud sync (useCloudSync:
 * the copy of a résumé deleted elsewhere), call it only now and then, and the module, with the snapshot
 * builder it carries, kept the start-up path over its 1.1 MB cap (71-startup-chunks). Every call is async
 * in publicIo too, so a caller sees no difference.
 */
export function lazyPublicIo(fs, cloud) {
  let io = null;
  // A load that failed (offline, a file gone after a deploy) is tried again at the next call.
  const load = () => {
    io ??= import('@/utils/publicLink').then((m) => m.publicIo(fs, cloud), (e) => { io = null; throw e; });
    return io;
  };
  return Object.fromEntries(CALLS.map((name) => [name, (...args) => load().then((real) => real[name](...args))]));
}

/**
 * The real Firestore calls for a public link (publicLink.js); null in a build without a cloud, where
 * sharing is not offered. Its own module, not ShareLinkModal's: the Dashboard (unpublish on delete)
 * and the public page need only these calls, and importing them from the modal put the modal and the
 * kit's Dialog on the start-up path (71-startup-chunks).
 */
export const firebasePublicIo = db ? lazyPublicIo({ doc, getDocFromServer, runTransaction }, db) : null;
