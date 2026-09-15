// The cloud sync itself — the first sync after sign-in, the write queue and its flushes, the
// sample read-back — as a plain object with everything outside passed in: the Firestore calls
// (`io`, cloudSyncIo.js; null without a cloud), the résumé store, the timers, the online flag.
// No React and no Firebase, so the tests drive this very code (tests/pdf/18-cloud-sync-*.test.mjs);
// useCloudSync only wires it to React state and the browser.
import { isDemoId } from '@/utils/demoSeed';
import { planInitialSync, queueChanges } from '@/utils/cloudSyncPlan';
import { flushOnce, serialQueue } from '@/utils/cloudSyncFlush';
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
 * createCloudSync({ io, store, report, isDemo, ... }):
 *   io        cloudIo(...) — null when this build has no cloud
 *   store     { getState() → the résumé store's state now, applyCloudSync(result) — a first
 *             sync's result (cloudSyncPlan.afterSync), forgetDeletions(ids, before) — the
 *             cloud has these deletions (localDeletions.js) }
 *   report    { status('idle'|'syncing'|'synced'|'offline'|'error'), synced(Date), account(a) } —
 *             account: { uid, cloudDemo } once the account's list is known, else null
 *   isDemo    user → true for a demo account (its deleted samples are flagged, not removed)
 *   online    () → whether the browser says it is online
 *   timers    { set(fn, ms) → id, clear(id) }; flushDelay (ms) before queued changes are sent;
 *             cloudTimeout (ms) readCloudDemo waits for an answer; now() → ms
 * Returns { start(user), cancel(), resumesChanged(resumes), readCloudDemo(ids) }.
 */
export function createCloudSync({
  io, store, report, isDemo = () => false,
  online = () => true, timers = { set: setTimeout, clear: clearTimeout },
  flushDelay = 1500, cloudTimeout = 5000, now = () => Date.now(), log = () => {},
}) {
  const s = {
    user: null,
    gen: 0, // bumped by every start/cancel: a first sync from an older one drops its result
    initialSyncDone: false,
    cloudDisabled: false,
    prevResumes: null,
    pendingWrites: new Map(),
    pendingDeletes: new Set(),
    listed: new Set(), // the cloud deletion list as this browser knows it (read, then added to)
    timer: null,
    flushes: serialQueue(), // one flush at a time, in order (R4-3)
    account: null,
  };

  function setAccount(account) {
    s.account = account;
    report.account(account);
  }

  /** Whenever the signed-in user (or null) changes, or the browser goes online or offline. */
  function start(user) {
    s.gen += 1;
    s.user = user || null;

    if (!user) {
      s.initialSyncDone = false;
      s.cloudDisabled = false;
      s.prevResumes = null;
      s.listed = new Set();
      report.status('idle');
      setAccount(null);
      return;
    }

    if (!io || s.cloudDisabled) {
      report.status('error');
      // Nothing to wait for: this browser's résumés are the whole list.
      if (s.account?.uid !== user.uid) setAccount({ uid: user.uid, cloudDemo: [] });
      return;
    }

    if (!online()) {
      s.initialSyncDone = false;
      report.status('offline');
      return;
    }

    initialSync(user, s.gen);
  }

  /** Drop the result of a first sync still running (the page is going away). */
  function cancel() {
    s.gen += 1;
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
      s.listed = new Set([...cloud.deleted, ...plan.listAdd]);
      s.initialSyncDone = true;
      const cloudDemo = cloud.docs.filter((r) => isDemoId(r.id)).map(({ deleted: _deleted, ...r }) => r);
      setAccount({ uid: user.uid, cloudDemo });
      report.status('synced');
      report.synced(new Date());
    } catch (e) {
      if (gen !== s.gen) return;
      if (isCloudConfigError(e)) {
        s.cloudDisabled = true;
        s.initialSyncDone = false;
        report.status('error');
        setAccount({ uid: user.uid, cloudDemo: [] });
        // One clear message — app keeps working on localStorage only
        log(
          '[CloudSync] Cloud sync disabled (local-only). '
          + 'Signed-in user cannot read/write Firestore — check rules are published '
          + 'and a "(default)" database exists. Resume data still saves in this browser.',
        );
        return;
      }
      // Offline / transient: do not enable write queue (avoids spam retries)
      s.initialSyncDone = false;
      const offline = !online() || isOfflineError(e);
      report.status(offline ? 'offline' : 'error');
      if (!offline) log('[CloudSync] sync unavailable:', e?.code || e?.message || e);
    }
  }

  /** The store's résumés after every change: what changed is queued and sent after a pause. */
  function resumesChanged(current) {
    if (!s.user || !s.initialSyncDone || s.cloudDisabled || !io) return;
    const queued = queueChanges({ writes: s.pendingWrites, deletes: s.pendingDeletes }, s.prevResumes || [], current);
    if (!queued.dirty) return;
    s.pendingWrites = queued.writes;
    s.pendingDeletes = queued.deletes;
    s.prevResumes = current;

    timers.clear(s.timer);
    report.status('syncing');
    const { user } = s;
    s.timer = timers.set(() => flushPending(user), flushDelay);
  }

  /** Queue a flush of the changes waiting by the time it runs (after any flush before it). */
  function flushPending(user) {
    return s.flushes(() => sendPending(user));
  }

  async function sendPending(user) {
    if (s.cloudDisabled || !io) return;

    const writes = Array.from(s.pendingWrites.values());
    const deletes = Array.from(s.pendingDeletes);
    s.pendingWrites.clear();
    s.pendingDeletes.clear();

    if (!writes.length && !deletes.length) return;

    const sentAt = now();
    try {
      // In a demo account a deleted sample résumé is flagged, not removed: its last copy stays in
      // the cloud so that restoring the samples on any device brings back the edited version.
      // Writing it again (a restore) replaces the whole document, flag included.
      const sent = await flushOnce({ uid: user.uid, writes, deletes, listed: s.listed, demoAccount: isDemo(user) }, io);
      sent.listAdd.forEach((id) => s.listed.add(id));
      sent.listRemove.forEach((id) => s.listed.delete(id));
      // The cloud has them: the store stops keeping them for the next first sync, which would send
      // them again — over a restore another device made since (R8-1).
      if (deletes.length) store.forgetDeletions(deletes, sentAt);
      report.status('synced');
      report.synced(new Date());
    } catch (e) {
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
   * The account's sample résumés with these `ids` as the cloud holds them now, flagged ones
   * included — a restore then brings back an edit another device made after this one's first
   * sync (R4-4). null when there is no cloud to ask, or it gives no answer within cloudTimeout.
   */
  function readCloudDemo(ids) {
    if (!s.user || !io || s.cloudDisabled || !s.initialSyncDone || !online()) return Promise.resolve(null);
    const read = io.readDocs(s.user.uid, ids);
    const timeout = new Promise((resolve) => { timers.set(() => resolve(null), cloudTimeout); });
    return Promise.race([read, timeout]).catch(() => null);
  }

  return { start, cancel, resumesChanged, readCloudDemo };
}
