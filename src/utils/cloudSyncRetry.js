// What a failed read or write of the cloud sync means, and when it is tried again — plain
// functions, no Firebase, so the tests run them through the engine (cloudSyncEngine.js,
// tests/pdf/18-cloud-sync-retry.test.mjs).
//
// Firestore rejects with a FirestoreError whose `code` says why. A temporary failure — the
// network, the server, a quota — clears by itself: it is tried again, later each time (30 s,
// 1 min, … up to 10 min), and not while the tab is hidden. permission-denied or a missing
// database need the project fixed: the sync turns itself off (local-only). Any other code fails
// the same way every time — invalid-argument above all: a résumé over Firestore's 1 MiB document
// limit, a large photo stored whole — so the sync stops until something changes instead of
// reading the account and re-sending the same batch every 30 s for as long as the page is open
// (V2W1a-1).

/**
 * Errors that mean cloud sync cannot work until the Firebase project or its rules are fixed.
 * Not the same as temporary offline — the sync switches to local-only and stops retrying.
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

/** Codes that can clear by themselves (Firestore's own retry advice, plus a token being refreshed). */
const TEMPORARY = new Set(['unavailable', 'deadline-exceeded', 'aborted', 'cancelled', 'internal', 'unknown', 'resource-exhausted', 'unauthenticated']);

/**
 * What error `e` means, with `online` the browser's online flag: 'config' (the sync turns
 * off), 'offline' (going online again re-runs the sync), 'retry' (tried again after a pause) or
 * 'stop' (the same batch would fail again: nothing more until something changes). An error with
 * no code is not the server's answer — a network failure — and is tried again.
 */
export function failureKind(e, online) {
  if (isCloudConfigError(e)) return 'config';
  if (!online || isOfflineError(e)) return 'offline';
  const code = typeof e?.code === 'string' ? e.code : '';
  return !code || TEMPORARY.has(code) ? 'retry' : 'stop';
}

/** The pause (ms) before retry number `attempt` (0 for the first): `base` doubled each time, at most `max`. */
export function backoff(attempt, base, max) {
  return Math.min(max, base * 2 ** Math.max(0, attempt));
}
