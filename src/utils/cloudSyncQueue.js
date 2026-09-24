// The cloud sync's write queue (cloudSyncEngine.js): every change of the store queued as it comes
// (queueChanges) and sent after a pause, one flush at a time. The engine's state `s` and its
// failure handling are passed in; no React and no Firebase, so the tests drive this very code
// through the engine over a fake Firestore (tests/pdf/18-cloud-sync-*.test.mjs).
//
// A flush first reads the server's copies of the résumés it sends — the deletion list only when
// one the cloud had is gone, and nothing is written from what it read (R8-4, R2-029) — and keeps
// another device's edit made since this page last saw the cloud (cloudSyncLineage.js, R2-004):
// until then it wrote its whole copy over it. Flushes still reach
// Firestore in the order they were made (R4-3): each one's batch is handed over after the one
// before it, once that one's read is answered — never after its acknowledgement, which may not
// come (VM4-3); a read with no answer within cloudTimeout fails the flush, and the next first sync
// sends what it held.
import { queueChanges } from '@/utils/cloudSyncPlan';
import { flushOnce } from '@/utils/cloudSyncFlush';
import { checkFlush } from '@/utils/cloudSyncLineage';

/** Nothing waiting to be sent: queueChanges adds to it, a flush takes it whole. */
export const emptyQueue = () => ({ writes: new Map(), deletes: new Set(), kept: new Set(), marked: new Set() });

const noAnswer = () => Object.assign(new Error('The cloud did not answer in time.'), { code: 'deadline-exceeded' });

/**
 * createQueue(ctx) — ctx: the engine's { s (its state), io, store, report, held, timers,
 * flushDelay, cloudTimeout, now, isDemo, failed(e, user, what), settled(), scheduleRetry(ms) }.
 * Returns { dropQueue(), resumesChanged(resumes), withDeadline(promise) }.
 */
export function createQueue({ s, io, store, report, held, timers, flushDelay, cloudTimeout, now, isDemo, failed, settled, scheduleRetry }) {
  function dropQueue() {
    timers.clear(s.timer);
    s.timer = null;
    s.queue = emptyQueue();
  }

  /** `promise`, or a deadline-exceeded failure (retried: cloudSyncRetry.js) once cloudTimeout passes without its answer. */
  function withDeadline(promise) {
    let id;
    const deadline = new Promise((_, reject) => { id = timers.set(() => reject(noAnswer()), cloudTimeout); });
    return Promise.race([promise, deadline]).finally(() => timers.clear(id));
  }

  /** The store's résumés after every change: what changed is queued and sent after a pause. */
  function resumesChanged(current) {
    s.lineage.held(current);
    held.release(current); // changed or deleted: tried again
    if (s.stopped && s.user && current !== s.stopped) {
      // Refused for good with no résumé to hold: a change is tried once, after the pause.
      s.stopped = current;
      scheduleRetry(flushDelay);
      return;
    }
    if (!s.user || !s.initialSyncDone || s.cloudDisabled || !io) return;
    const queued = queueChanges(s.queue, s.prevResumes || [], current, held.replaced(s.user.uid, current));
    if (!queued.dirty) return;
    s.queue = queued;
    s.prevResumes = current;

    timers.clear(s.timer);
    report.status('syncing');
    const { user } = s;
    s.timer = timers.set(() => sendPending(user), flushDelay);
  }

  /** Put these résumés in the store as the queue has seen them: nothing is queued for them again. */
  function putBack(list) {
    if (!list.length) return;
    s.prevResumes = [...(s.prevResumes || []), ...list];
    store.restoreResumes(list);
  }

  /** Send the changes waiting (cloudSyncFlush.js), checked against the server's copies first. */
  async function sendPending(user) {
    const current = () => s.user?.uid === user.uid;
    const { kept, marked } = s.queue;
    const queued = [...s.queue.writes.values()];
    const queuedDeletes = [...s.queue.deletes];
    const source = s.prevResumes || []; // the résumés the queue was made from (cloudSyncHeld.js)
    s.queue = emptyQueue();
    // Signed out or switched since (R8-5): the queue is not sent — and not left for the next
    // account's flush either, should start() not have dropped it (V2W1a-2).
    if (!current() || s.cloudDisabled || !io) return;
    const sendable = held.sendable(user.uid, queued);
    if (!sendable.length && !queuedDeletes.length) {
      if (s.initialSyncDone) report.status(held.size ? 'stopped' : 'synced'); // all of it held back
      return;
    }

    const before = s.turn;
    let handedOver;
    s.turn = new Promise((resolve) => { handedOver = resolve; });
    const sentAt = now();
    try {
      await before;
      if (!current()) return;
      const docs = await withDeadline(io.readDocs(user.uid, [...sendable.map((r) => r.id), ...queuedDeletes]));
      if (!current()) return;
      const { writes, copies, deletes, back } = checkFlush({ writes: sendable, deletes: queuedDeletes, docs, lineage: s.lineage });
      s.lineage.synced(docs);
      // A résumé the cloud had and has no longer may have been deleted on another device: this
      // edit was made where that deletion was never seen, so it wins and comes off the deletion
      // list (R2-029). Until then it was written under the listed id, and every device left it out.
      const missing = writes.filter((r) => s.lineage.knows(r.id) && !docs.some((d) => d.id === r.id)).map((r) => r.id);
      const listed = missing.length ? await withDeadline(io.readDeleted(user.uid)) : [];
      if (!current()) return;
      // In a demo account a deleted original is flagged, not removed: its last copy stays in the
      // cloud so that restoring the originals on any device brings back the edited version.
      // Writing it again (a restore) replaces the whole document, flag included.
      const flush = {
        uid: user.uid, writes: [...writes, ...copies], deletes, kept, marked, demoAccount: isDemo(user),
        listRemove: missing.filter((id) => listed.includes(id)),
      };
      const sending = flush.writes.length || deletes.length
        ? flushOnce(flush, { commit: (uid, plan) => held.commit(uid, plan, source, current) })
        : null;
      s.lineage.synced(flush.writes);
      handedOver();
      putBack([...copies, ...back]);
      const sent = await sending;
      // The cloud has them: the store stops keeping them for the next first sync, which would send
      // them again — over a restore another device made since (R8-1).
      if (deletes.length) store.forgetDeletions(deletes, sentAt, user.uid);
      // What the cloud holds now, kept for the next visit's first sync (cloudSyncLineage.js).
      if (sent) {
        store.noteCloudVersions(user.uid, {
          ...Object.fromEntries(sent.sets.map((r) => [r.id, r.updatedAt])),
          ...Object.fromEntries([...sent.hardDeletes, ...sent.flags].map((id) => [id, null])),
        });
      }
      // Not "synced" while a first sync is still owed (offline, or the cloud stopped answering).
      if (!current() || !s.initialSyncDone) return;
      settled();
    } catch (e) {
      // An account signed out since: its refusal says nothing about the one signed in now (R8-5).
      if (!current()) return;
      failed(e, user, 'flush');
    } finally {
      handedOver();
    }
  }

  return { dropQueue, resumesChanged, withDeadline };
}
