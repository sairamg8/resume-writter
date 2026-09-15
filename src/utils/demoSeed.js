// The restore rules of demo accounts, as pure functions over plain data.
// No imports, so Node's test runner loads this file as it is (tests/unit/demo-seed.unit.mjs).
//
// A demo account (DEMO_ACCOUNTS: the owner's login) always has its ORIGINAL résumés — the ones
// marked "Keep as my original" (`keep: true`). When its list holds none of them (every résumé
// deleted, or only others left) they all come back, each as its latest edited copy. Deleting an
// original there flags its cloud copy instead of removing it (cloudSyncPlan.js), so a restore on
// any device brings back the edited version. Until 2026-09-15 what came back was five fictional
// samples (demo_classic …); the owner asked for their own résumé instead. Samples already in an
// account are ordinary résumés now: deleted, they are gone for good, and nothing deletes one by
// itself (project_demo-account.md).

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

/** The originals among the copies `seen` (rememberCopies), deleted ones included. */
export function originalsIn(seen) {
  return [...seen.values()].filter(isOriginal);
}

/**
 * The originals to put back: each one's latest copy in `seen`, deep-copied. A copy keeps its own
 * `updatedAt` (R4-4): the sync still writes every résumé that comes back, but a newer edit of it
 * on another device wins the next merge and repairs the cloud. Stamped `now`, a stale device's
 * copies used to beat that edit. A flagged cloud copy comes back without its deleted flag.
 */
export function buildRestore(seen, now) {
  return originalsIn(seen).map((copy) => {
    const { deleted: _deleted, ...r } = JSON.parse(JSON.stringify(copy));
    return { ...r, updatedAt: copy.updatedAt || now };
  });
}
