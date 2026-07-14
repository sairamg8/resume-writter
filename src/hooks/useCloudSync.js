import { useEffect, useRef, useState } from 'react';
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, writeBatch,
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

export function useCloudSync({ user, appState, store }) {
  const [syncStatus, setSyncStatus] = useState('idle'); // idle|syncing|synced|offline|error
  const [lastSynced, setLastSynced]   = useState(null);
  const [isOnline, setIsOnline]       = useState(navigator.onLine);

  const initialSyncDone = useRef(false);
  const prevResumesRef  = useRef(null);
  const pendingWrites   = useRef(new Map()); // id → resume
  const pendingDeletes  = useRef(new Set()); // ids
  const timerRef        = useRef(null);

  // ── Online / offline detection ────────────────────────────────────────────
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ── Initial sync when user signs in ──────────────────────────────────────
  useEffect(() => {
    if (!user) {
      initialSyncDone.current = false;
      prevResumesRef.current  = null;
      setSyncStatus('idle');
      return;
    }

    async function initialSync() {
      setSyncStatus('syncing');
      try {
        const [snap, delSnap] = await Promise.all([
          getDocs(resumesCol(user.uid)),
          getDoc(deletionsDoc(user.uid)),
        ]);

        const cloudResumes    = snap.docs.map(d => d.data());
        const cloudDeletedIds = new Set(delSnap.exists() ? (delSnap.data().ids || []) : []);
        // Combine Firestore deletions with any locally-tracked ones (guards against
        // page refresh before the 1.5s debounce flushes deletions to Firestore).
        const localDeletedIds = new Set(appState.deletedIds || []);
        const deletedIds      = new Set([...cloudDeletedIds, ...localDeletedIds]);

        const merged = mergeResumeLists(appState.resumes, cloudResumes, deletedIds);

        // Push merged list back to Firestore in one batch
        const batch = writeBatch(db);
        merged.forEach(r => batch.set(resumeDoc(user.uid, r.id), r));
        await batch.commit();

        store.loadResumes(merged);
        prevResumesRef.current = merged;
        initialSyncDone.current = true;
        setSyncStatus('synced');
        setLastSynced(new Date());
      } catch (e) {
        console.error('[CloudSync] initial sync failed:', e);
        // Still mark done so local edits queue up; Firestore will flush offline writes when reconnected
        prevResumesRef.current  = appState.resumes;
        initialSyncDone.current = true;
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
      }
    }

    initialSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // ── Watch for local mutations and debounce-write ──────────────────────────
  useEffect(() => {
    if (!user || !initialSyncDone.current) return;

    const current = appState.resumes;
    const prev    = prevResumesRef.current || [];

    // Detect deletions
    const prevIds = new Set(prev.map(r => r.id));
    const currIds = new Set(current.map(r => r.id));
    const deleted = [...prevIds].filter(id => !currIds.has(id));

    // Detect additions / updates
    const changed = current.filter(r => {
      const p = prev.find(x => x.id === r.id);
      return !p || p.updatedAt !== r.updatedAt;
    });

    if (!deleted.length && !changed.length) return;

    deleted.forEach(id => {
      pendingWrites.current.delete(id);
      pendingDeletes.current.add(id);
    });
    changed.forEach(r => pendingWrites.current.set(r.id, r));

    prevResumesRef.current = current;

    clearTimeout(timerRef.current);
    setSyncStatus('syncing');
    timerRef.current = setTimeout(() => flushPending(user.uid), 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState.resumes, user]);

  async function flushPending(uid) {
    const writes  = Array.from(pendingWrites.current.values());
    const deletes = Array.from(pendingDeletes.current);
    pendingWrites.current.clear();
    pendingDeletes.current.clear();

    try {
      const batch = writeBatch(db);
      writes.forEach(r  => batch.set(resumeDoc(uid, r.id), r));
      deletes.forEach(id => batch.delete(resumeDoc(uid, id)));

      // Persist deleted IDs so other devices don't re-pull them
      if (deletes.length) {
        const delSnap  = await getDoc(deletionsDoc(uid));
        const existing = delSnap.exists() ? (delSnap.data().ids || []) : [];
        const merged   = [...new Set([...existing, ...deletes])];
        batch.set(deletionsDoc(uid), { ids: merged });
      }

      await batch.commit();
      setSyncStatus('synced');
      setLastSynced(new Date());
    } catch (e) {
      console.error('[CloudSync] flush failed:', e);
      // Firestore offline persistence will retry automatically — just show offline/error
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
    }
  }

  return { syncStatus, lastSynced, isOnline };
}
