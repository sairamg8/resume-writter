// The cloud sync itself — the first sync after sign-in, the write queue and its flushes, the
// read-back of a demo account's originals — as a plain object with everything outside passed
// in: the Firestore calls (`io`, cloudSyncIo.js; null without a cloud), the résumé store, the
// timers, the online flag.
// No React and no Firebase, so the tests drive this very code (tests/pdf/18-cloud-sync-*.test.mjs);
// useCloudSync only wires it to React state and the browser.
import { isOriginal } from '@/utils/demoSeed';
import { planInitialSync, queueChanges } from '@/utils/cloudSyncPlan';
import { flushOnce } from '@/utils/cloudSyncFlush';
import { deletionEntries } from '@/utils/localDeletions';

/**
 * Errors that mean cloud sync cannot work until Firebase project/rules are fixed.
 * Not the same as temporary offline — we switch to local-only and stop retrying.
 */
export function isCloudConfigError(e) {
  const code = e?.code || '';
  const msg = String(e?.message || e || '');
  return (
    code === 'permission-denied'
    || code === 'PERMISSION_DENIED'
    || msg.includes("Database '(default)' not found")
    || msg.includes('permission-denied')
    || msg.includes('Missing or insufficient permissions')
  );
}

const isOfflineError = (e) => String(e?.message || '').toLowerCase().includes('client is offline');

/**
 * The résumé store as the engine reaches it: `latest()` → { appState, store } as of the last
 * render (useCloudSync keeps it in a ref), read when the engine needs it — a first sync reads the
 * state once the account is known, a flush's forgetDeletions reaches the store's own updater.
 */
export function liveStore(latest) {
  return {
    getState: () => latest().appState,
    applyCloudSync: (result) => latest().store.applyCloudSync(result),
    forgetDeletions: (ids, before) => latest().store.forgetDeletions(ids, before),
  };
}

/**
 * createCloudSync({ io, store, report, isDemo, ... }):
 *   io        cloudIo(...) — null when this build has no cloud
 *   store     { getState() → the résumé store's state now, applyCloudSync(result) — a first
 *             sync's result (cloudSyncPlan.afterSync), forgetDeletions(ids, before) — the
 *             cloud has these deletions (localDeletions.js) }
 *   report    { status('idle'|'syncing'|'synced'|'offline'|'error'), synced(Date), account(a) } —
 *             account: { uid, cloudOriginals, cloudDeleted } once the account's list is known,
 *             else null — the cloud's originals (demoSeed.js), deleted ones included, and its
 *             deletion list, as the first sync read them
 *   isDemo    user → true for a demo account (its deleted originals are flagged, not removed)
 *   online    () → whether the browser says it is online
 *   timers    { set(fn, ms) → id, clear(id) }; flushDelay (ms) before queued changes are sent;
 *             cloudTimeout (ms) readCloudCopies waits for an answer; retryDelay (ms) before a
 *             first sync that could not reach the cloud is tried again; now() → ms
 * Returns { start(user), cancel(), resumesChanged(resumes), readCloudCopies(ids) }.
 */
export function createCloudSync({
  io, store, report, isDemo = () => false,
  online = () => true, timers = { set: setTimeout, clear: clearTimeout },
  flushDelay = 1500, cloudTimeout = 5000, retryDelay = 30000, now = () => Date.now(), log = () => {},
}) {
  const s = {
    user: null,
    gen: 0, // bumped by every start/cancel: a first sync from an older one drops its result
    initialSyncDone: false,
    cloudDisabled: false,
    prevResumes: null,
    pendingWrites: new Map(),
    pendingDeletes: new Set(),
    pendingKept: new Set(), // the pending deletes that were originals (queueChanges)
    timer: null,
    retry: null,
    account: null,
  };

  function setAccount(account) {
    s.account = account;
    report.account(account);
  }

  /** Whenever the signed-in user (or null) changes, or the browser goes online or offline. */
  function start(user) {
    s.gen += 1;
    timers.clear(s.retry);
    // Signed out, or another account: the last one's queue is not sent — without its auth it was
    // refused, and that refusal turned sync off for whoever signed in next (R8-5). Nothing is
    // lost: the store keeps the edits and deletions for that account's next first sync.
    if ((user?.uid ?? null) !== (s.user?.uid ?? null)) dropQueue();
    s.user = user || null;

    if (!user) {
      s.initialSyncDone = false;
      s.cloudDisabled = false;
      s.prevResumes = null;
      report.status('idle');
      setAccount(null);
      return;
    }

    if (!io || s.cloudDisabled) {
      report.status('error');
      // Nothing to wait for: this browser's résumés are the whole list.
      if (s.account?.uid !== user.uid) setAccount(noCloud(user));
      return;
    }

    if (!online()) {
      s.initialSyncDone = false;
      report.status('offline');
      return;
    }

    initialSync(user, s.gen);
  }

  function dropQueue() {
    timers.clear(s.timer);
    s.timer = null;
    s.pendingWrites = new Map();
    s.pendingDeletes = new Set();
    s.pendingKept = new Set();
  }

  /** The account when there is no cloud to read: this browser's résumés are the whole list. */
  const noCloud = (user) => ({ uid: user.uid, cloudOriginals: [], cloudDeleted: [] });

  /** Drop the result of a first sync still running (the page is going away). */
  function cancel() {
    s.gen += 1;
    timers.clear(s.retry);
  }

  /** Try the first sync again later — the sync icon says "will retry". */
  function scheduleRetry() {
    timers.clear(s.retry);
    const { gen, user } = s;
    s.retry = timers.set(() => { if (s.gen === gen && s.user === user) start(user); }, retryDelay);
  }

  /**
   * The cloud did not answer while signed in: nothing more is sent until a first sync gets
   * through again. A restore made meanwhile from this browser's copies stays here — the
   * flush used to write it unconditionally over the cloud's copies, newer edits from another
   * device included (VM4-6). The retry's first sync merges by time and flag (planInitialSync),
   * and the restore runs again from the cloud's copies.
   */
  function unreachable() {
    s.initialSyncDone = false;
    report.status(online() ? 'error' : 'offline');
    scheduleRetry();
  }

  async function initialSync(user, gen) {
    report.status('syncing');
    try {
      const cloud = await io.readCloud(user.uid);
      if (gen !== s.gen) return;

      // The store as it is once the account is known: what was done while it was read counts.
      const appState = store.getState();
      const planAt = now();
      const plan = planInitialSync({
        local: appState.resumes, deletions: deletionEntries(appState), cloud: cloud.docs, cloudDeleted: cloud.deleted,
        demoAccount: isDemo(user), uid: user.uid,
      });

      // Deletions this browser never sent reach the cloud in the same batch, before the store
      // forgets them (afterSync) — else the next sync restores them (R4-1).
      await io.commit(user.uid, plan);
      if (gen !== s.gen) return;

      // Applied to the store as it is now (R8-2). The watcher then compares it with the merged list,
      // so it sends what was edited, added or deleted while the batch was on its way.
      store.applyCloudSync({ uid: user.uid, snapshot: appState.resumes, merged: plan.merged, handled: plan.handled, before: planAt });
      s.prevResumes = plan.merged;
      s.initialSyncDone = true;
      // A listed id was deleted for good, whatever copy of it a stale device wrote back since
      // (V2OWNER-DATA-0): it is none of the account's originals.
      const listed = new Set(cloud.deleted);
      const cloudOriginals = cloud.docs.filter((r) => isOriginal(r) && !listed.has(r.id)).map(({ deleted: _deleted, ...r }) => r);
      setAccount({ uid: user.uid, cloudOriginals, cloudDeleted: [...cloud.deleted] });
      report.status('synced');
      report.synced(new Date());
    } catch (e) {
      if (gen !== s.gen) return;
      if (isCloudConfigError(e)) {
        s.cloudDisabled = true;
        s.initialSyncDone = false;
        report.status('error');
        setAccount(noCloud(user));
        // One clear message — app keeps working on localStorage only
        log(
          '[CloudSync] Cloud sync disabled (local-only). '
          + 'Signed-in user cannot read/write Firestore — check rules are published '
          + 'and a "(default)" database exists. Resume data still saves in this browser.',
        );
        return;
      }
      // Offline / transient: no write queue until a first sync gets through. Retried while the
      // browser says it is online; going online again re-runs it anyway.
      s.initialSyncDone = false;
      const offline = !online() || isOfflineError(e);
      report.status(offline ? 'offline' : 'error');
      if (!offline) log('[CloudSync] sync unavailable:', e?.code || e?.message || e);
      if (online()) scheduleRetry();
    }
  }

  /** The store's résumés after every change: what changed is queued and sent after a pause. */
  function resumesChanged(current) {
    if (!s.user || !s.initialSyncDone || s.cloudDisabled || !io) return;
    const queued = queueChanges({ writes: s.pendingWrites, deletes: s.pendingDeletes, kept: s.pendingKept }, s.prevResumes || [], current);
    if (!queued.dirty) return;
    s.pendingWrites = queued.writes;
    s.pendingDeletes = queued.deletes;
    s.pendingKept = queued.kept;
    s.prevResumes = current;

    timers.clear(s.timer);
    report.status('syncing');
    const { user } = s;
    s.timer = timers.set(() => sendPending(user), flushDelay);
  }

  /** Send the changes waiting: handed to Firestore at once, in order (cloudSyncFlush.js). */
  async function sendPending(user) {
    const current = () => s.user?.uid === user.uid;
    if (!current() || s.cloudDisabled || !io) return; // signed out or switched since (R8-5)

    const writes = Array.from(s.pendingWrites.values());
    const deletes = Array.from(s.pendingDeletes);
    const kept = new Set(s.pendingKept);
    s.pendingWrites.clear();
    s.pendingDeletes.clear();
    s.pendingKept.clear();

    if (!writes.length && !deletes.length) return;

    const sentAt = now();
    try {
      // In a demo account a deleted original is flagged, not removed: its last copy stays in the
      // cloud so that restoring the originals on any device brings back the edited version.
      // Writing it again (a restore) replaces the whole document, flag included.
      await flushOnce({ uid: user.uid, writes, deletes, kept, demoAccount: isDemo(user) }, io);
      // The cloud has them: the store stops keeping them for the next first sync, which would send
      // them again — over a restore another device made since (R8-1).
      if (deletes.length) store.forgetDeletions(deletes, sentAt);
      // Not "synced" while a first sync is still owed (offline, or the cloud stopped answering).
      if (!current() || !s.initialSyncDone) return;
      report.status('synced');
      report.synced(new Date());
    } catch (e) {
      // An account signed out since: its refusal says nothing about the one signed in now (R8-5).
      if (!current()) return;
      if (isCloudConfigError(e)) {
        s.cloudDisabled = true;
        s.initialSyncDone = false;
        report.status('error');
        log('[CloudSync] Cloud sync disabled (local-only).');
        return;
      }
      const offline = !online() || isOfflineError(e);
      report.status(offline ? 'offline' : 'error');
      if (!offline) log('[CloudSync] flush unavailable:', e?.code || e?.message || e);
    }
  }

  /**
   * `{ docs, deleted }`: the account's résumés with these `ids` as the cloud holds them now,
   * flagged ones included — a restore of the originals then brings back an edit another device
   * made after this one's first sync (R4-4) — and its deletion list now, so none deleted for good
   * since comes back (V2OWNER-DATA-0). null when there is no cloud to ask, or it gives no answer
   * within cloudTimeout — the sync then sends nothing until a first sync gets through again
   * (unreachable, VM4-6). It stops before this resolves, so a restore made on a null answer is
   * never queued.
   */
  function readCloudCopies(ids) {
    if (!s.user || !io || s.cloudDisabled || !s.initialSyncDone || !online()) return Promise.resolve(null);
    const { gen, user } = s;
    const read = io.readCopies(user.uid, ids);
    const timeout = new Promise((resolve) => { timers.set(() => resolve(null), cloudTimeout); });
    return Promise.race([read, timeout]).catch(() => null).then((answer) => {
      if (answer === null && s.gen === gen && s.user === user && s.initialSyncDone) unreachable();
      return answer;
    });
  }

  return { start, cancel, resumesChanged, readCloudCopies };
}
