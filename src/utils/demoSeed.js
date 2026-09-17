// The restore rules of demo accounts, as pure functions over plain data.
// No imports, so Node's test runner loads this file as it is (tests/unit/demo-seed.unit.mjs).
//
// A demo account (DEMO_ACCOUNTS: the owner's login) always has its ORIGINAL résumés — the ones
// marked "Keep as my original" (`keep: true`). When its list holds none of them (every résumé
// deleted, or only others left) they all come back, each as its latest edited copy. Deleting an
// original there flags its cloud copy instead of removing it (cloudSyncPlan.js), so a restore on
// any device brings back the edited version; every other deletion puts the id on the account's
// deletion list, so a listed id was deleted for good ("Stop keeping", then Delete) and never
// comes back, whatever copy of it a device still holds. Until 2026-09-15 what came back was five
// fictional samples (demo_classic …); the owner asked for their own résumé instead. Samples
// already in an account are ordinary résumés now: deleted, they are gone for good. One an older
// build flagged when it was deleted is settled by the first sync: removed for good if nobody
// edited it, back in the list if someone did (oldSamples.js, project_demo-account.md).

/** "a@x.com, B@y.com" → ['a@x.com', 'b@y.com'] */
export function parseAccountList(value) {
  return String(value ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

const emailOf = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

/** True when the signed-in user's email is one of `accounts` (lower-case). */
export function isDemoAccount(user, accounts) {
  const email = emailOf(user?.email);
  return Boolean(email) && accounts.includes(email);
}

/** True for a résumé marked "Keep as my original". */
export function isOriginal(resume) {
  return resume?.keep === true;
}

/** `resume` marked as an original, or no longer, at `now` — an edit, so the sync sends it. */
export function withKeep(resume, keep, now) {
  const { keep: _keep, ...rest } = resume;
  return { ...rest, ...(keep ? { keep: true } : {}), updatedAt: now };
}

/** True when `resumes` holds no original, i.e. the account's originals must come back. */
export function needsRestore(resumes) {
  return !resumes.some(isOriginal);
}

/**
 * True when deleting `resume` from `resumes` would bring it straight back: it is their last
 * original, so the list left needs the restore, which puts back the copy just deleted. The
 * dashboard disables its Delete, which did nothing but move the card last (V2OWNER-DATA-4):
 * "Stop keeping" comes first.
 */
export function comesStraightBack(resume, resumes) {
  return isOriginal(resume) && needsRestore(resumes.filter((r) => r?.id !== resume.id));
}

/**
 * Record in `seen` (Map id → résumé) the newest copy of each résumé in `resumes`. A copy deleted
 * later stays in the map, so a restore brings back the edited version; a newer copy that is not
 * kept ("Stop keeping") takes the place of a kept one, so an older kept copy — from the cloud, or
 * another device — can never bring it back.
 */
export function rememberCopies(seen, resumes) {
  for (const r of resumes || []) {
    // Skip anything that is not a whole résumé (e.g. a cloud stub holding only a deleted flag).
    if (!r || typeof r.id !== 'string' || !Array.isArray(r.sections)) continue;
    const known = seen.get(r.id);
    if (!known || (r.updatedAt || 0) >= (known.updatedAt || 0)) seen.set(r.id, r);
  }
  return seen;
}

/**
 * The originals among the copies `seen` (rememberCopies), deleted ones included — but none whose
 * id is in `gone`: the account's deletion list, what was deleted for good.
 */
export function originalsIn(seen, gone = []) {
  const forGood = new Set(gone);
  return [...seen.values()].filter((r) => isOriginal(r) && !forGood.has(r.id));
}

/**
 * The originals to put back: each one's latest copy in `seen`, deep-copied — none in `gone` (the
 * account's deletion list: a device that last saw a kept copy of one deleted for good elsewhere
 * wrote it back, V2OWNER-DATA-0). A copy keeps its own `updatedAt` (R4-4): the sync still writes
 * every résumé that comes back, but a newer edit of it on another device wins the next merge and
 * repairs the cloud. Stamped `now`, a stale device's copies used to beat that edit. So the version
 * cannot tell a restored copy from the one deleted: `restoredAt: now` does — a deletion made
 * before it on a device that has not sent it yet must not undo the restore (cloudSyncPlan,
 * V2W1a-4). A flagged cloud copy comes back without its deleted flag.
 */
export function buildRestore(seen, now, gone = [], normalize = r => r) {
  return originalsIn(seen, gone).map((copy) => {
    const { deleted: _deleted, ...r } = normalize(JSON.parse(JSON.stringify(copy)));
    return { ...r, updatedAt: copy.updatedAt || now, restoredAt: now };
  });
}

/** The id of the owner's résumé imported from the private file: one copy, however many tabs import it. */
export const PRIVATE_ORIGINAL_ID = 'original_private';

/**
 * The owner's résumé from the git-ignored private file (`data`; the dev server only, useDemoSeed)
 * as the account's original, or null. Only for the account whose e-mail the file carries, only
 * while the account has no original — `seen`, deleted ones included, none deleted for good (`gone`:
 * the cloud's deletion list) — and only once: not when the list holds its id, nor when it was
 * deleted (`deleted`: the cloud's deletion list and this browser's).
 */
export function privateOriginal(data, user, { resumes = [], seen = new Map(), deleted = [], gone = [], now, normalize = r => r }) {
  if (!data || typeof data !== 'object' || !data.personal || !Array.isArray(data.sections)) return null;
  const email = emailOf(user?.email);
  if (!email || email !== emailOf(data.personal.email)) return null;
  if (originalsIn(seen, gone).length || seen.has(PRIVATE_ORIGINAL_ID) || deleted.includes(PRIVATE_ORIGINAL_ID)) return null;
  if (resumes.some((r) => r?.id === PRIVATE_ORIGINAL_ID)) return null;
  const { deleted: _deleted, ...r } = normalize(JSON.parse(JSON.stringify(data)));
  return { ...r, id: PRIVATE_ORIGINAL_ID, keep: true, updatedAt: now };
}
