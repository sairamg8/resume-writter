// A demo account's restore of its originals (the rules: demoSeed.js) as a plain object, with
// everything outside passed in: the signed-in user, the account the cloud sync reports once its
// list is known (useCloudSync's `account`), the résumé store's state and restoreResumes, the
// sync's readCloudCopies. No React, so the tests drive this very code over the sync engine and a
// fake Firestore (tests/pdf/18-cloud-sync-restore.test.mjs); useDemoSeed only wires it to React.
import { buildRestore, isDemoAccount, needsRestore, originalsIn, privateOriginal, rememberCopies, PRIVATE_ORIGINAL_ID } from '@/utils/demoSeed';
import { normalizeResume } from '@/utils/normalizeResume';

/**
 * createDemoRestore({ accounts, ownerResume, now, onWaiting }):
 *   accounts     the demo accounts' e-mails, lower-case (DEMO_ACCOUNTS)
 *   ownerResume  the owner's résumé from the private file — the dev server only — else null
 *   now          () → ms
 *   onWaiting    (bool) → the originals are due back but the account's cloud has not answered:
 *                they come back once it does (the dashboard says so)
 * Returns { update({ user, account, appState, sync, store }) }: run after every render that
 * changed the user, the account or the résumés (useDemoSeed's effect).
 */
export function createDemoRestore({ accounts, ownerResume = null, now = () => Date.now(), onWaiting = () => {} }) {
  // For the signed-in account: the latest copy of each résumé seen, deleted ones included (the
  // restore takes the originals among them), the ids on its deletion list (`gone`: deleted for
  // good, never brought back), the account object last taken in, `restoring` while the cloud is
  // asked for its copies, `imported` once the private file was looked at (once).
  let seed = null;
  // The account a restore may still be applied to: null once it signs out.
  let live = null;
  let waiting = false;
  const setWaiting = (v) => { if (v !== waiting) { waiting = v; onWaiting(v); } };

  function seedFor(uid) {
    if (seed?.uid !== uid) seed = { uid, account: null, copies: new Map(), gone: new Set(), restoring: false, imported: false };
    return seed;
  }

  function update({ user, account, appState, sync, store }) {
    const demo = isDemoAccount(user, accounts);
    // Waiting for the account's list matters: restoring before it could overwrite newer cloud copies.
    const ready = demo && account?.uid === user.uid;
    live = ready ? user.uid : null;
    if (!ready) setWaiting(false);
    if (!demo) return;
    const s = seedFor(user.uid);
    if (ready && s.account !== account) {
      s.account = account;
      rememberCopies(s.copies, account.cloudOriginals);
      (account.cloudDeleted || []).forEach((id) => s.gone.add(id));
    }
    rememberCopies(s.copies, appState.resumes);
    if (!ready || s.restoring) return;

    const isReset = appState.resumes.length === 0;
    if (ownerResume && (!s.imported || isReset)) {
      s.imported = true;
      const deleted = isReset ? [] : [...(account.cloudDeleted || []), ...(appState.deletedIds || [])];
      const gone = isReset ? [] : [...s.gone];
      const own = privateOriginal(ownerResume, user, {
        resumes: appState.resumes,
        seen: isReset ? new Map() : s.copies,
        deleted,
        gone,
        now: now(),
        normalize: normalizeResume,
      });
      if (own) {
        if (isReset) s.gone.delete(PRIVATE_ORIGINAL_ID);
        store.restoreResumes([own]);
        return;
      }
    }
    const originals = needsRestore(appState.resumes) ? originalsIn(s.copies, s.gone) : [];
    if (!originals.length) { setWaiting(false); return; }
    // The cloud's copies first: another device may have edited an original since this one's first
    // sync (R4-4), or deleted one for good (V2OWNER-DATA-0). An account with no cloud has this
    // browser's list as its whole list, and nothing to ask.
    s.restoring = true;
    Promise.resolve(account.cloud ? sync.readCloudCopies?.(originals.map((r) => r.id)) : { docs: [], deleted: [] })
      .catch(() => null)
      .then((cloud) => {
        s.restoring = false;
        if (seed !== s || live !== s.uid) return; // signed out meanwhile
        // No answer: nothing comes back from this browser's copies until the next first sync gets
        // through (its account runs this again). Put back here, the stale copy could be edited, and
        // that newer edit then beat the other device's newer copy at the retry (V2W1a-0).
        setWaiting(!cloud);
        if (!cloud) return;
        rememberCopies(s.copies, cloud.docs);
        (cloud.deleted || []).forEach((id) => s.gone.add(id));
        // None, if another device stopped keeping them or deleted them for good.
        const back = buildRestore(s.copies, now(), s.gone, normalizeResume);
        if (back.length) store.restoreResumes(back);
      });
  }

  return { update };
}
