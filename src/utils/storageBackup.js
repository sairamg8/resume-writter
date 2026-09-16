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
 * something that could not be read; the user's current work comes first — but only a write that
 * then fits is worth one. When the value does not fit even without them (or storage refused it
 * for another reason), every backup removed for it is written back, then storage's error is
 * thrown: they used to be gone for good, both lists' copies, for a save that still failed (VM4-0).
 * `spare(backup)` — `{ key, of, at }`, as listBackups lists one — true keeps it from making room.
 */
export function setItemWithRoom(key, value, spare = () => false) {
  let backups = null; // listed only once a write has not fitted: this runs on every save
  const removed = []; // [key, value] of each backup removed for this write
  for (;;) {
    try {
      localStorage.setItem(key, value);
      return;
    } catch (e) {
      backups ??= listBackups().filter((b) => b.key !== key && !spare(b));
      if (!isQuotaError(e) || !backups.length) {
        putBack(removed);
        throw e;
      }
      const gone = backups.shift().key;
      removed.push([gone, readBackup(gone)]);
      remove(gone);
    }
  }
}

/** Write back the backups a write removed and still did not fit: they all fitted before it. */
function putBack(removed) {
  for (const [key, value] of removed) {
    if (value === null) continue;
    try { localStorage.setItem(key, value); } catch { /* best effort */ }
  }
}

/**
 * Copy a stored value we are about to replace into its own key (`<key>_backup_<ms>`), so a bad
 * load never destroys data, and keep only the newest BACKUPS_KEPT of that key: they used to pile
 * up for good in the ~5 MB quota. A value backed up already keeps that copy: React's StrictMode
 * loads the store twice in development, and the second copy was named an earlier repair
 * (V2W1a-9). Storage full: older backups make room for the copy, except another list's that its
 * notice still offers — the only copy of what that list lost. It went for this one, and that
 * notice then said it "was later removed to make room for your changes" (ONB-4). Best effort:
 * returns the backup's key, or null when storage refused the write even with every backup it may
 * take gone (they are all kept then: setItemWithRoom).
 */
export function backupRaw(key, raw) {
  const mine = listBackups().filter((b) => b.of === key);
  const same = mine.find((b) => readBackup(b.key) === raw);
  if (same) return same.key;
  // Never the key of an earlier backup: two in one millisecond would be one.
  const at = Math.max(Date.now(), ...mine.map((b) => b.at + 1));
  const backupKey = `${key}_backup_${at}`;
  try {
    setItemWithRoom(backupKey, raw, (b) => b.of !== key && offered(b));
  } catch {
    return null;
  }
  listBackups().filter((b) => b.of === key).slice(0, -BACKUPS_KEPT).forEach((b) => remove(b.key));
  return backupKey;
}

/** Whether a notice not yet dismissed offers this backup, as its copy or an earlier one (pendingRecovery). */
function offered({ key, of }) {
  const notice = pendingRecovery(of);
  return notice !== null && (notice.backupKey === key || notice.earlier.includes(key));
}

/** A backup's value, or null when it is gone (removed to make room, or storage cannot be read). */
export function readBackup(backupKey) {
  try { return localStorage.getItem(backupKey); } catch { return null; }
}

/**
 * Read the list `field` of the object saved under `key`, writing nothing, as
 * `{ saved, list, unreadable }`:
 *   saved       the parsed object; null when nothing is saved or the value cannot be read
 *   list        the entries kept — `readEntry(entry)` returns `{ kept, lost }`: kept the entry, a
 *               repaired copy, or null to leave it out; lost whether that lost anything the entry
 *               held (when not said: whenever kept is not the entry itself). null when nothing is
 *               saved (or storage cannot be read at all)
 *   unreadable  the raw value, when it could not be read or something in it was lost: it is to be
 *               copied (backupRaw) before the next save replaces it. Else null: a repair that
 *               loses nothing (the job list's numbers turned into their digits) needs no copy and
 *               no notice — it used to get both, the notice saying something was left out (VM4-5).
 * The résumé store reads through here in a render (useAppStore's useState initializer, which
 * React's StrictMode runs twice in development), and backs up from an effect (VM4-9).
 */
export function readSavedList(key, field, readEntry) {
  const none = { saved: null, list: null, unreadable: null };
  let raw = null;
  try { raw = localStorage.getItem(key); } catch { return none; }
  if (!raw) return none;
  let saved = null;
  try { saved = JSON.parse(raw); } catch { /* unreadable: handled below */ }
  if (!Array.isArray(saved?.[field])) return { saved: null, list: [], unreadable: raw };

  const list = [];
  let anyLost = false;
  for (const entry of saved[field]) {
    const { kept, lost = kept !== entry } = readEntry(entry);
    if (lost) anyLost = true;
    if (kept) list.push(kept);
  }
  return { saved, list, unreadable: anyLost ? raw : null };
}

/**
 * readSavedList, and what could not be read backed up at once, as `{ saved, list, recovery }`:
 * recovery `{ backupKey }` when there was something — the key of the raw value's copy
 * (backupRaw), null when storage refused it — else null. The job list loads through here, once
 * per visit (useJobStore's snapshot); the résumé store reads the same way (R4-6), so a list that
 * cannot be read in full is backed up and reported alike for both.
 */
export function loadSavedList(key, field, readEntry) {
  const { saved, list, unreadable } = readSavedList(key, field, readEntry);
  return { saved, list, recovery: unreadable === null ? null : { backupKey: backupRaw(key, unreadable) } };
}

/**
 * The notice for a list that could not be read in full is kept in storage (`<key>_recovery`)
 * until the user dismisses it: the list is repaired and saved over at once, and the page that
 * shows the notice may not be the one that read it — a reload used to lose it for good (R4-0).
 * As `{ backupKey, earlier }`: `earlier` the backups of repairs made before this one while the
 * notice was up (a notice saved by an older build has none).
 */
export function pendingRecovery(key) {
  try {
    const v = JSON.parse(localStorage.getItem(`${key}_recovery`));
    if (!v || typeof v !== 'object') return null;
    const earlier = Array.isArray(v.earlier) ? v.earlier.filter((k) => typeof k === 'string') : [];
    return { backupKey: typeof v.backupKey === 'string' ? v.backupKey : null, earlier };
  } catch {
    return null;
  }
}

/**
 * Keep `recovery` for pendingRecovery, or forget it (null) once dismissed; returns the notice
 * kept. A notice not yet dismissed stays in it: its copies become `earlier`. Another repair used
 * to replace it, and the first backup — the only copy of what that repair left out — was no
 * longer named anywhere (R8-10).
 */
export function rememberRecovery(key, recovery) {
  const pending = recovery ? pendingRecovery(key) : null;
  const notice = recovery && {
    ...recovery,
    earlier: [...new Set([...(pending?.earlier || []), pending?.backupKey])].filter((k) => k && k !== recovery.backupKey),
  };
  try {
    if (notice) localStorage.setItem(`${key}_recovery`, JSON.stringify(notice));
    else localStorage.removeItem(`${key}_recovery`);
  } catch { /* best effort: the notice still shows for this visit */ }
  return notice || null;
}
