// Sending the cloud sync's queued changes: one flush, with the Firestore calls passed in (`io`).
// No Firebase here, so tests run it against a fake Firestore (tests/pdf/18-cloud-sync.test.mjs);
// the engine passes the real calls (cloudSyncIo.js).
//
// Flushes are not queued behind each other. Firestore applies one client's batches in the order
// they are handed to it, and a flush reads nothing first (R8-4), so its batch is handed over the
// moment it runs: order is kept (R4-3) without waiting for the server's acknowledgement of the
// one before. A queue that waited for it held every later flush behind an acknowledgement that
// never comes — the network gone, or its account signed out (Firestore keeps that write until
// the account is back) — so nothing else reached the cloud for the rest of the visit (VM4-3).
import { planFlush } from '@/utils/cloudSyncPlan';

/**
 * Send one flush of account `uid`'s queue — `writes` (résumés), `deletes` (ids), `kept` (the
 * deletes that were originals), `listed` (the deletion list as this browser knows it),
 * `demoAccount` (planFlush) — as ONE batch:
 * io.commit(uid, plan). Nothing is read first: the batch adds to and takes off the deletion list
 * itself (R8-4), and io.commit is called before anything is awaited — flushes started in order
 * reach Firestore in order. Resolves to the plan sent once the server has it.
 */
export async function flushOnce({ uid, writes, deletes, kept, listed, demoAccount = false }, io) {
  const plan = planFlush(writes, deletes, listed, { demoAccount, kept });
  await io.commit(uid, plan);
  return plan;
}
