// Sample résumés for demo accounts — the rules, as pure functions over plain data.
// No imports, so Node's test runner loads this file as it is (tests/unit/demo-seed.unit.mjs).
//
// A demo account always has the sample set: when none of it is left (a first sign-in, or after
// the user deleted it) the whole set comes back, each résumé as its latest edited copy. The
// samples keep fixed ids ("demo_classic", …) so two devices restoring at once cannot duplicate
// them — the sync merges by id.

export const DEMO_ID_PREFIX = 'demo_';

export function isDemoId(id) {
  return typeof id === 'string' && id.startsWith(DEMO_ID_PREFIX);
}

/** "a@x.com, B@y.com" → ['a@x.com', 'b@y.com'] */
export function parseAccountList(value) {
  return String(value ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

/** True when the signed-in user's email is one of `accounts` (lower-case). */
export function isDemoAccount(user, accounts) {
  const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
  return Boolean(email) && accounts.includes(email);
}

/** True when `resumes` holds none of the sample résumés, i.e. the set must be put back. */
export function needsDemoRestore(resumes) {
  return !resumes.some(r => isDemoId(r?.id));
}

/**
 * Record in `seed` (Map id → résumé) the newest copy of each sample résumé in `resumes`.
 * A copy deleted later stays in the map, so a restore brings back the edited version.
 */
export function rememberDemo(seed, resumes) {
  for (const r of resumes || []) {
    // Skip anything that is not a whole résumé (e.g. a cloud stub holding only a deleted flag).
    if (!r || !isDemoId(r.id) || !Array.isArray(r.sections)) continue;
    const known = seed.get(r.id);
    if (!known || (r.updatedAt || 0) >= (known.updatedAt || 0)) seed.set(r.id, r);
  }
  return seed;
}

/**
 * The sample set to put back: each résumé's latest copy from `seed`, else its built-in version
 * from `pristine`. Stamped `now` so it wins the sync merge over an older copy on another device.
 */
export function buildDemoRestore(pristine, seed, now) {
  return pristine.map(p => ({
    ...JSON.parse(JSON.stringify(seed.get(p.id) || p)),
    id: p.id,
    updatedAt: now,
  }));
}

/**
 * The cloud deletion list after a flush: the ids just deleted are added, and a sample résumé
 * written again (restored) is taken off — otherwise every later sync would hide it.
 */
export function nextTombstones(existing, deletedIds, writtenIds) {
  const revived = new Set(writtenIds.filter(isDemoId));
  return [...new Set([...existing, ...deletedIds])].filter(id => !revived.has(id));
}
