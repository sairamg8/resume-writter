// The cloud sync (cloudSyncEngine.js) in a browser page: whether the page is online and whether
// its tab is hidden are read from the page each time the sync asks, and the page's online,
// offline and visibilitychange events reach the sync. No React, so the tests drive this very code
// over a fake page and a fake Firestore (tests/pdf/18-cloud-sync-browser-events.test.mjs);
// useCloudSync only keeps what it returns across renders.
import { createCloudSync } from '@/utils/cloudSyncEngine';

/**
 * browserCloudSync(win, options):
 *   win       the page — `window`: its navigator.onLine is the sync's `online`, its
 *             document.hidden the sync's `hidden`
 *   options   the rest of createCloudSync's: io, store, report, isDemo, log (timers …)
 *   create    the sync to make: createCloudSync (the résumés), or createCollectionSync (the jobs
 *             and the boards, collectionSyncEngine.js) — the same start/cancel/shown
 * Returns { sync, online(), watch(setOnline) → unwatch }: `watch` passes the page going online or
 * offline to setOnline (useCloudSync restarts the sync on it) and runs a retry that came due while
 * the tab was hidden as soon as the tab is shown (V2W1a-1) — without it that retry waited for an
 * online/offline change or a reload, under "Sync error — will retry".
 */
export function browserCloudSync(win, options, create = createCloudSync) {
  const online = () => win.navigator.onLine;
  const sync = create({ ...options, online, hidden: () => win.document.hidden });

  function watch(setOnline) {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const visible = () => { if (!win.document.hidden) sync.shown(); };
    win.addEventListener('online', on);
    win.addEventListener('offline', off);
    win.document.addEventListener('visibilitychange', visible);
    return () => {
      win.removeEventListener('online', on);
      win.removeEventListener('offline', off);
      win.document.removeEventListener('visibilitychange', visible);
    };
  }

  return { sync, online, watch };
}
