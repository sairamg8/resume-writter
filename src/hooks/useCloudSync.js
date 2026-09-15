import { useEffect, useRef, useState } from 'react';
import {
  collection, doc, getDocs, getDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { isDemoId } from '@/utils/demoSeed';
import { planInitialSync, queueChanges } from '@/utils/cloudSyncPlan';
import { flushOnce, serialQueue } from '@/utils/cloudSyncFlush';

function resumesCol(uid) { return collection(db, 'users', uid, 'resumes'); }
function resumeDoc(uid, id) { return doc(db, 'users', uid, 'resumes', id); }
function deletionsDoc(uid) { return doc(db, 'users', uid, 'meta', 'deletions'); }

/** The Firestore calls behind a flush and the first sync (cloudSyncFlush's `io`). */
const firestore = {
  async readDeletions(uid) {
    const snap = await getDoc(deletionsDoc(uid));
    return snap.exists() ? (snap.data().ids || []) : [];
  },
  /** One batch: whole résumés written, samples flagged, the rest removed, the deletion list. */
  commit(uid, { sets, flags, hardDeletes, tombstones }) {
    const batch = writeBatch(db);
    sets.forEach(r => batch.set(resumeDoc(uid, r.id), r));
    flags.forEach(id => batch.set(resumeDoc(uid, id), { deleted: true }, { merge: true }));
    hardDeletes.forEach(id => batch.delete(resumeDoc(uid, id)));
    if (tombstones) batch.set(deletionsDoc(uid), { ids: tombstones });
    return batch.commit();
  },
};

/**
 * Errors that mean cloud sync cannot work until Firebase project/rules are fixed.
 * Not the same as temporary offline — we switch to local-only and stop retrying.
 */
function isCloudConfigError(e) {
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

export function useCloudSync({ user, appState, store }) {
  // Hook order is fixed — never add/remove hooks conditionally.
  const [syncStatus, setSyncStatus] = useState('idle'); // idle|syncing|synced|offline|error
  const [lastSynced, setLastSynced] = useState(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  // Set once the signed-in account's résumé list is known (first sync done, or no cloud to sync
  // with): { uid, cloudDemo } — cloudDemo is the cloud's sample résumés, deleted ones included.
  const [account, setAccount] = useState(null);

  // Single bag so we never change hook count when adding flags (HMR-safe pattern).
  const stateRef = useRef({
    initialSyncDone: false,
    cloudDisabled: false,
    prevResumes: null,
    pendingWrites: new Map(),
    pendingDeletes: new Set(),
    tombstones: new Set(), // the cloud deletion list as last read or written
    timer: null,
    flushes: serialQueue(), // one flush at a time, in order (R4-3)
  });

  // ── Online / offline detection ────────────────────────────────────────────
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // ── Initial sync when user signs in ──────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current;

    if (!user) {
      s.initialSyncDone = false;
      s.cloudDisabled = false;
      s.prevResumes = null;
      s.tombstones = new Set();
      setSyncStatus('idle');
      setAccount(null);
      return;
    }

    if (!db || s.cloudDisabled) {
      setSyncStatus('error');
      // Nothing to wait for: this browser's résumés are the whole list.
      setAccount(a => (a?.uid === user.uid ? a : { uid: user.uid, cloudDemo: [] }));
      return;
    }

    if (!navigator.onLine) {
      s.prevResumes = appState.resumes;
      s.initialSyncDone = false;
      setSyncStatus('offline');
      return;
    }

    let cancelled = false;

    async function initialSync() {
      setSyncStatus('syncing');
      try {
        const [snap, cloudDeleted] = await Promise.all([
          getDocs(resumesCol(user.uid)),
          firestore.readDeletions(user.uid),
        ]);
        if (cancelled) return;

        // The document id, not a field: a flagged sample the cloud never held is a bare stub.
        const cloudResumes = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        const plan = planInitialSync({
          local: appState.resumes, localDeleted: appState.deletedIds || [], cloud: cloudResumes, cloudDeleted,
        });

        // Deletions this browser never sent reach the cloud in the same batch, before the store
        // forgets them (loadResumes clears deletedIds) — else the next sync restores them (R4-1).
        await firestore.commit(user.uid, {
          sets: plan.merged, flags: plan.flags, hardDeletes: plan.hardDeletes, tombstones: plan.tombstones,
        });
        if (cancelled) return;

        const { merged } = plan;
        store.loadResumes(merged);
        s.prevResumes = merged;
        s.tombstones = new Set(plan.tombstones || cloudDeleted);
        s.initialSyncDone = true;
        const cloudDemo = cloudResumes.filter(r => isDemoId(r.id)).map(({ deleted: _deleted, ...r }) => r);
        setAccount({ uid: user.uid, cloudDemo });
        setSyncStatus('synced');
        setLastSynced(new Date());
      } catch (e) {
        if (cancelled) return;
        if (isCloudConfigError(e)) {
          s.cloudDisabled = true;
          s.initialSyncDone = false;
          s.prevResumes = appState.resumes;
          setSyncStatus('error');
          setAccount({ uid: user.uid, cloudDemo: [] });
          // One clear message — app keeps working on localStorage only
          console.info(
            '[CloudSync] Cloud sync disabled (local-only). '
            + 'Signed-in user cannot read/write Firestore — check rules are published '
            + 'and a "(default)" database exists. Resume data still saves in this browser.',
          );
          return;
        }
        // Offline / transient: do not enable write queue (avoids spam retries)
        s.prevResumes = appState.resumes;
        s.initialSyncDone = false;
        const offline = !navigator.onLine
          || String(e?.message || '').toLowerCase().includes('client is offline');
        setSyncStatus(offline ? 'offline' : 'error');
        if (!offline) {
          console.info('[CloudSync] sync unavailable:', e?.code || e?.message || e);
        }
      }
    }

    initialSync();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, isOnline]);

  // ── Watch for local mutations and debounce-write ──────────────────────────
  useEffect(() => {
    const s = stateRef.current;
    if (!user || !s.initialSyncDone || s.cloudDisabled || !db) return;

    const current = appState.resumes;
    const queued = queueChanges({ writes: s.pendingWrites, deletes: s.pendingDeletes }, s.prevResumes || [], current);
    if (!queued.dirty) return;
    s.pendingWrites = queued.writes;
    s.pendingDeletes = queued.deletes;
    s.prevResumes = current;

    clearTimeout(s.timer);
    setSyncStatus('syncing');
    s.timer = setTimeout(() => flushPending(user.uid), 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState.resumes, user]);

  /** Queue a flush of the changes waiting by the time it runs (after any flush before it). */
  function flushPending(uid) {
    return stateRef.current.flushes(() => sendPending(uid));
  }

  async function sendPending(uid) {
    const s = stateRef.current;
    if (s.cloudDisabled || !db) return;

    const writes = Array.from(s.pendingWrites.values());
    const deletes = Array.from(s.pendingDeletes);
    s.pendingWrites.clear();
    s.pendingDeletes.clear();

    if (!writes.length && !deletes.length) return;

    try {
      // A deleted sample résumé is flagged, not removed: its last copy stays in the cloud so that
      // restoring the samples on any device brings back the edited version. Writing it again
      // (a restore) replaces the whole document, flag included.
      const tombstones = await flushOnce({ uid, writes, deletes, tombstones: s.tombstones }, firestore);
      if (tombstones) s.tombstones = new Set(tombstones);
      setSyncStatus('synced');
      setLastSynced(new Date());
    } catch (e) {
      if (isCloudConfigError(e)) {
        s.cloudDisabled = true;
        s.initialSyncDone = false;
        setSyncStatus('error');
        console.info('[CloudSync] Cloud sync disabled (local-only).');
        return;
      }
      const offline = !navigator.onLine
        || String(e?.message || '').toLowerCase().includes('client is offline');
      setSyncStatus(offline ? 'offline' : 'error');
      if (!offline) {
        console.info('[CloudSync] flush unavailable:', e?.code || e?.message || e);
      }
    }
  }

  return { syncStatus, lastSynced, isOnline, account };
}
