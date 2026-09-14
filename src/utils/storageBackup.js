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
