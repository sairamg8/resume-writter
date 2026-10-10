import { collection, doc, getDocsFromServer, runTransaction, writeBatch } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { sortAddresses } from '@/utils/jobMapAccessLogic';

// Loaded on demand, never with the start-up code (the Job Map access panel imports it, and the panel is
// loaded by the Job Map page for an account that may use it). The documents are `jobmap_access/<email>`:
// firestore.rules lets only a Job Map admin (isJobMapAdmin) read or write them, so the first read doubles
// as the admin check, and any other account is refused it.

const ACCESS = 'jobmap_access';

/**
 * The calls over a Firestore: `fs` the SDK's functions (collection, doc, getDocsFromServer, runTransaction,
 * writeBatch), `cloud` its database (null: a build with no cloud), `now` the clock. The tests run this very
 * code on tests/pdf/fake-firestore.mjs.
 */
export function accessIoOver(fs, cloud, now = Date.now) {
  return {
    /**
     * { admin: true, addresses } (sorted) when the read is answered; { admin: false } when the rules refuse it
     * (permission-denied: not an admin) or there is no cloud. Any other failure (offline, unavailable) throws,
     * for the panel's retry: nothing is known about the account then.
     */
    async list() {
      if (!cloud) return { admin: false };
      try {
        const snap = await fs.getDocsFromServer(fs.collection(cloud, ACCESS));
        return { admin: true, addresses: sortAddresses(snap.docs.map((d) => d.id)) };
      } catch (e) {
        if (e?.code === 'permission-denied') return { admin: false };
        throw e;
      }
    },

    /**
     * Creates `jobmap_access/<address>` with { allowed: true, createdAt } and resolves true; an address that
     * already has a document is left as it is (its fields stay) and resolves false.
     */
    add(address) {
      return fs.runTransaction(cloud, async (tx) => {
        const ref = fs.doc(cloud, ACCESS, address);
        if ((await tx.get(ref)).exists()) return false;
        tx.set(ref, { allowed: true, createdAt: now() });
        return true;
      });
    },

    /** Deletes `jobmap_access/<address>` (the id as listed). */
    async remove(address) {
      const batch = fs.writeBatch(cloud);
      batch.delete(fs.doc(cloud, ACCESS, address));
      await batch.commit();
    },
  };
}

/** The real calls; without Firebase configured every list says "not an admin". */
export const jobMapAccessIo = accessIoOver({ collection, doc, getDocsFromServer, runTransaction, writeBatch }, db);
