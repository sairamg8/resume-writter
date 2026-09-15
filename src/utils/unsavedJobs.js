// The job list of a tab whose changes storage refused, when another tab saves its own (the job
// store's storage event, R6-2). No imports, so Node's test runner loads this file as it is
// (tests/unit/unsaved-jobs.unit.mjs).

/**
 * The list to show once another tab has saved `incoming`: `stored` is the list this tab last knew
 * storage to hold, `current` what it shows. Every job added or changed here since — which storage
 * refused — is kept as it is here (one another tab changed as well: this tab's version; one it
 * deleted: back, at the end), and every job deleted here stays deleted; the rest is `incoming`'s,
 * so the other tab's adds, edits and deletes are taken too. The same `incoming` when this tab has
 * nothing unsaved. The store makes a new object for every job it changes, so a job is changed
 * here when it is no longer the very object `stored` holds.
 */
export function keepUnsaved(incoming, current, stored) {
  const storedById = new Map(stored.map((j) => [j.id, j]));
  const currentIds = new Set(current.map((j) => j.id));
  const mine = new Map(current.filter((j) => storedById.get(j.id) !== j).map((j) => [j.id, j]));
  const deleted = new Set(stored.filter((j) => !currentIds.has(j.id)).map((j) => j.id));
  if (!mine.size && !deleted.size) return incoming;
  const kept = incoming.filter((j) => !deleted.has(j.id)).map((j) => mine.get(j.id) || j);
  const keptIds = new Set(kept.map((j) => j.id));
  return [...kept, ...[...mine.values()].filter((j) => !keptIds.has(j.id))];
}
