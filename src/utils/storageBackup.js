// Reading the lists the app keeps in localStorage — the résumé store and the job list — without
// ever destroying what cannot be read. No imports, so Node's test runner loads this file as it
// is (tests/unit/storage-backup.unit.mjs).

/**
 * Copy a stored value we are about to replace into its own key (`<key>_backup_<ms>`), so a bad
 * load never destroys data. Best effort: returns the backup's key, or null when storage refused
 * the write (usually because it is full).
 */
export function backupRaw(key, raw) {
  const backupKey = `${key}_backup_${Date.now()}`;
  try {
    localStorage.setItem(backupKey, raw);
    return backupKey;
  } catch {
    return null;
  }
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
