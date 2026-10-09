// Import of a whole saved store as the Dashboard's Import meets it: the file "Download the copy" saves
// from the recovery notice (RecoveryNotice.jsx) is the raw store, `{ resumes: [...], activeId, ... }`,
// not one résumé. Every résumé in it that reads as one is imported as a NEW résumé, through the same
// store call, and so the same normalization, a single résumé's file gets. Loaded when such a file is
// picked (Dashboard.jsx), not at start-up. No React and no path aliases.

/** The most résumés one saved store brings in: far past any list a person keeps, short of a file made to flood it. */
export const MAX_BACKUP_RESUMES = 100;

/** Whether `r` is a résumé as the single-file import reads one (Dashboard.jsx): details and a list of sections. */
const readsAsResume = (r) => Boolean(r?.personal && Array.isArray(r.sections));

/**
 * Which of `list` (the readable résumés of saved store `store`) "Import as my original" marks, a Set:
 * the ones the saved copy itself marks as originals (`keep: true`, a demo account's pool that comes back
 * when none is left), else the one that was open in it (`activeId`), else the first. Marking every résumé
 * of a copy would turn a whole list into originals that come back after each deletion; a copy that marks
 * none still honours the choice, with the one résumé it was about.
 */
function originalsOf(store, list) {
  const marked = list.filter((r) => r.keep === true);
  if (marked.length) return new Set(marked);
  return new Set([list.find((r) => r.id === store.activeId) ?? list[0]]);
}

/**
 * Import the résumés of saved store `store` with `importResume(data, { keep })`: `{ added, unreadable,
 * over }` — how many were imported, how many entries were not a résumé (or were refused), and how many
 * readable ones were left out for the cap. `ids` are the new résumés'. `keep`: the import was chosen as
 * the account's original; it marks the résumés originalsOf names, not every one.
 */
export function importSavedStore(store, importResume, { keep = false } = {}) {
  const entries = store.resumes;
  const readable = entries.filter(readsAsResume);
  const taken = readable.slice(0, MAX_BACKUP_RESUMES);
  const originals = keep && taken.length ? originalsOf(store, taken) : new Set();
  const ids = [];
  let refused = 0;
  for (const r of taken) {
    try {
      ids.push(importResume(r, { keep: originals.has(r) }));
    } catch (e) {
      console.error('Import of one résumé failed:', e);
      refused += 1;
    }
  }
  return { added: ids.length, unreadable: entries.length - readable.length + refused, over: Math.max(0, readable.length - MAX_BACKUP_RESUMES), ids };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What the Dashboard says after `importSavedStore`: how many came in, and what was left out and why. */
export function savedStoreMessage({ added, unreadable, over }) {
  if (!added) return 'That file holds no résumé that could be read, so nothing was imported.';
  const parts = [`Imported ${plural(added, 'résumé')} from the saved copy as ${added === 1 ? 'a new résumé' : 'new résumés'}.`];
  if (unreadable) parts.push(unreadable === 1 ? '1 entry could not be read and was left out.' : `${unreadable} entries could not be read and were left out.`);
  if (over) parts.push(`Only the first ${MAX_BACKUP_RESUMES} were imported; ${over} more were left out.`);
  return parts.join(' ');
}
