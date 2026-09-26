import { useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { SyncDot } from '../AuthBar.jsx';
import { collectionSyncStatus, syncHeld, worstSyncStatus } from '../../utils/collectionSyncMeta.js';

// The browser's online flag, as the résumés' icon reads it (useCloudSync, cloudSyncBrowser.js).
const subscribeOnline = (changed) => {
  window.addEventListener('online', changed);
  window.addEventListener('offline', changed);
  return () => {
    window.removeEventListener('online', changed);
    window.removeEventListener('offline', changed);
  };
};
const browserOnline = () => window.navigator.onLine !== false;
const alwaysOnline = () => true;

const clip = (name) => (name.length > 32 ? `${name.slice(0, 31)}…` : name);

/**
 * The lists a workspace page shows: the Job Tracker's pages show the jobs, and every page shows the
 * projects (the sidebar lists them, the top bar searches them).
 */
export const listsShown = (pathname) => (pathname === '/jobs' || pathname.startsWith('/jobs/') ? ['jobs', 'boards'] : ['boards']);

/** The 'stopped' words: what the cloud will not take is named, as the résumés' icon names a résumé. */
function heldLabel(held = []) {
  if (held.length === 1) return `“${clip(held[0].name || 'Untitled')}” not synced (too large?) — saved in this browser`;
  if (held.length > 1) {
    const what = held.every((x) => x.list === 'jobs') ? 'jobs' : held.every((x) => x.list === 'boards') ? 'projects' : 'items';
    return `${held.length} ${what} not synced (too large?) — saved in this browser`;
  }
  return 'Sync stopped — saved in this browser';
}

/**
 * The jobs' and the boards' cloud icon in the workspace's top bar: the résumés' own icon (SyncDot,
 * its look and its words) over the lists the page shows, the worst of their statuses winning
 * (worstSyncStatus). Until R2-140-c these pages said nothing of their sync: an error, or a sync
 * the account's rules refuse, went to the console only. Nothing while signed out (idle).
 * "Offline" is the browser's own flag, as on the résumés' icon: an 'offline' status with the
 * browser online (Firestore cannot reach its server — a captive portal, a blocked host) reads
 * "Cannot reach your account", not "Offline" (R4-LO-23).
 */
export function CollectionSyncDot() {
  const { pathname } = useLocation();
  const statuses = useSyncExternalStore(collectionSyncStatus.subscribe, collectionSyncStatus.get, collectionSyncStatus.get);
  const held = useSyncExternalStore(syncHeld.subscribe, syncHeld.get, syncHeld.get);
  const isOnline = useSyncExternalStore(subscribeOnline, browserOnline, alwaysOnline);
  const names = listsShown(pathname);
  const { status, at } = worstSyncStatus(statuses, names);
  if (status === 'idle') return null;
  const heldShown = names.flatMap((n) => (held[n] ?? []).map((x) => ({ ...x, list: n })));
  return (
    <div className="flex shrink-0 px-1.5">
      <SyncDot syncStatus={status} lastSynced={at} isOnline={isOnline} heldResumes={heldShown} heldLabel={heldLabel} />
    </div>
  );
}
