import { useEffect, useRef, useState } from 'react';
import {
  collection, doc, getDocs, getDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '@/utils/firebase';

function resumesCol(uid) { return collection(db, 'users', uid, 'resumes'); }
function resumeDoc(uid, id) { return doc(db, 'users', uid, 'resumes', id); }
function deletionsDoc(uid) { return doc(db, 'users', uid, 'meta', 'deletions'); }

// Merge local + cloud resumes: newer updatedAt wins, deleted IDs excluded.
function mergeResumeLists(local, cloud, deletedIds) {
  const byId = {};
  for (const r of cloud) {
    if (!deletedIds.has(r.id)) byId[r.id] = r;
  }
  for (const r of local) {
    if (deletedIds.has(r.id)) continue;
    if (!byId[r.id] || r.updatedAt >= byId[r.id].updatedAt) byId[r.id] = r;
  }
  return Object.values(byId);
}

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

  // Single bag so we never change hook count when adding flags (HMR-safe pattern).
  const stateRef = useRef({
    initialSyncDone: false,
    cloudDisabled: false,
    prevResumes: null,
    pendingWrites: new Map(),
    pendingDeletes: new Set(),
    timer: null,
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
      setSyncStatus('idle');
      return;
    }

    if (!db || s.cloudDisabled) {
      setSyncStatus('error');
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
        const [snap, delSnap] = await Promise.all([
          getDocs(resumesCol(user.uid)),
          getDoc(deletionsDoc(user.uid)),
        ]);
        if (cancelled) return;

        const cloudResumes = snap.docs.map(d => d.data());
        const cloudDeletedIds = new Set(delSnap.exists() ? (delSnap.data().ids || []) : []);
        const localDeletedIds = new Set(appState.deletedIds || []);
        const deletedIds = new Set([...cloudDeletedIds, ...localDeletedIds]);

        const merged = mergeResumeLists(appState.resumes, cloudResumes, deletedIds);

        const batch = writeBatch(db);
        merged.forEach(r => batch.set(resumeDoc(user.uid, r.id), r));
        await batch.commit();
        if (cancelled) return;

        store.loadResumes(merged);
        s.prevResumes = merged;
        s.initialSyncDone = true;
        setSyncStatus('synced');
        setLastSynced(new Date());
      } catch (e) {
        if (cancelled) return;
        if (isCloudConfigError(e)) {
          s.cloudDisabled = true;
          s.initialSyncDone = false;
          s.prevResumes = appState.resumes;
          setSyncStatus('error');
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
    const prev = s.prevResumes || [];

    const prevIds = new Set(prev.map(r => r.id));
    const currIds = new Set(current.map(r => r.id));
    const deleted = [...prevIds].filter(id => !currIds.has(id));

    const changed = current.filter(r => {
      const p = prev.find(x => x.id === r.id);
      return !p || p.updatedAt !== r.updatedAt;
    });

    if (!deleted.length && !changed.length) return;

    deleted.forEach(id => {
      s.pendingWrites.delete(id);
      s.pendingDeletes.add(id);
    });
    changed.forEach(r => s.pendingWrites.set(r.id, r));

    s.prevResumes = current;

    clearTimeout(s.timer);
    setSyncStatus('syncing');
    s.timer = setTimeout(() => flushPending(user.uid), 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState.resumes, user]);

  async function flushPending(uid) {
    const s = stateRef.current;
    if (s.cloudDisabled || !db) return;

    const writes = Array.from(s.pendingWrites.values());
    const deletes = Array.from(s.pendingDeletes);
    s.pendingWrites.clear();
    s.pendingDeletes.clear();

    if (!writes.length && !deletes.length) return;

    try {
      const batch = writeBatch(db);
      writes.forEach(r => batch.set(resumeDoc(uid, r.id), r));
      deletes.forEach(id => batch.delete(resumeDoc(uid, id)));

      if (deletes.length) {
        const delSnap = await getDoc(deletionsDoc(uid));
        const existing = delSnap.exists() ? (delSnap.data().ids || []) : [];
        const merged = [...new Set([...existing, ...deletes])];
        batch.set(deletionsDoc(uid), { ids: merged });
      }

      await batch.commit();
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

  return { syncStatus, lastSynced, isOnline };
}
