// Reading the lists the app keeps in localStorage — the résumé store and the job list — without
// ever destroying what cannot be read. No imports, so Node's test runner loads this file as it
// is (tests/unit/storage-backup.unit.mjs).

/** How many backups of one key are kept: older ones are removed as a new one is made (R4-8). */
export const BACKUPS_KEPT = 3;
const BACKUP_KEY = /^(.+)_backup_(\d+)$/;

/** Every backup in storage, oldest first, as { key, of, at }: `of` the key it copies. */
function listBackups() {
  const found = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const m = BACKUP_KEY.exec(localStorage.key(i) || '');
      if (m) found.push({ key: m[0], of: m[1], at: Number(m[2]) });
    }
  } catch { /* storage cannot be read: nothing to list */ }
  return found.sort((a, b) => a.at - b.at);
}

function remove(key) {
  try { localStorage.removeItem(key); } catch { /* best effort */ }
}

const isQuotaError = (e) => e?.name === 'QuotaExceededError' || e?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
  || e?.code === 22 || e?.code === 1014;

/**
 * localStorage.setItem, except that when storage is full the backups make room: they are
 * removed oldest first, one at a time, until the value fits (R4-8). A backup is a copy of
 * something that could not be read; the user's current work comes first. Throws the storage's
 * error when the value does not fit even without them (or storage refused it for another reason).
 */
export function setItemWithRoom(key, value) {
  let backups = null; // listed only once a write has not fitted: this runs on every save
  for (;;) {
    try {
      localStorage.setItem(key, value);
      return;
    } catch (e) {
      backups ??= listBackups().filter((b) => b.key !== key);
      if (!isQuotaError(e) || !backups.length) throw e;
      remove(backups.shift().key);
    }
  }
}

/**
 * Copy a stored value we are about to replace into its own key (`<key>_backup_<ms>`), so a bad
 * load never destroys data, and keep only the newest BACKUPS_KEPT of that key: they used to pile
 * up for good in the ~5 MB quota. Best effort: returns the backup's key, or null when storage
 * refused the write even after older backups made room.
 */
export function backupRaw(key, raw) {
  const mine = listBackups().filter((b) => b.of === key);
  // Never the key of an earlier backup: two in one millisecond would be one.
  const at = Math.max(Date.now(), ...mine.map((b) => b.at + 1));
  const backupKey = `${key}_backup_${at}`;
  try {
    setItemWithRoom(backupKey, raw);
  } catch {
    return null;
  }
  listBackups().filter((b) => b.of === key).slice(0, -BACKUPS_KEPT).forEach((b) => remove(b.key));
  return backupKey;
}

/** A backup's value, or null when it is gone (removed to make room, or storage cannot be read). */
export function readBackup(backupKey) {
  try { return localStorage.getItem(backupKey); } catch { return null; }
}

/**
 * Read the list `field` of the object saved under `key`, as `{ saved, list, recovery }`:
 *   saved     the parsed object; null when nothing is saved or the value cannot be read
 *   list      the entries kept — `readEntry(entry)` returns the entry, a repaired copy, or null
 *             to leave it out; null when nothing is saved (or storage cannot be read at all)
 *   recovery  when the value could not be read, or an entry was left out or repaired:
 *             `{ backupKey }` — the raw value was first copied to that key (backupRaw), because
 *             the next save replaces it; backupKey null when storage refused the copy. Else null.
 * The résumé store and the job list both load through here (R4-6), so a list that cannot be
 * read in full is backed up and reported the same way for both.
 */
export function loadSavedList(key, field, readEntry) {
  const none = { saved: null, list: null, recovery: null };
  let raw = null;
  try { raw = localStorage.getItem(key); } catch { return none; }
  if (!raw) return none;
  let saved = null;
  try { saved = JSON.parse(raw); } catch { /* unreadable: handled below */ }
  if (!Array.isArray(saved?.[field])) return { saved: null, list: [], recovery: { backupKey: backupRaw(key, raw) } };

  const list = [];
  let changed = false;
  for (const entry of saved[field]) {
    const kept = readEntry(entry);
    if (kept !== entry) changed = true;
    if (kept) list.push(kept);
  }
  return { saved, list, recovery: changed ? { backupKey: backupRaw(key, raw) } : null };
}

/**
 * The notice for a list that could not be read in full is kept in storage (`<key>_recovery`)
 * until the user dismisses it: the list is repaired and saved over at once, and the page that
 * shows the notice may not be the one that read it — a reload used to lose it for good (R4-0).
 */
export function pendingRecovery(key) {
  try {
    const v = JSON.parse(localStorage.getItem(`${key}_recovery`));
    return v && typeof v === 'object' ? { backupKey: typeof v.backupKey === 'string' ? v.backupKey : null } : null;
  } catch {
    return null;
  }
}

/** Keep `recovery` for pendingRecovery, or forget it (null) once dismissed. */
export function rememberRecovery(key, recovery) {
  try {
    if (recovery) localStorage.setItem(`${key}_recovery`, JSON.stringify(recovery));
    else localStorage.removeItem(`${key}_recovery`);
  } catch { /* best effort: the notice still shows for this visit */ }
}
