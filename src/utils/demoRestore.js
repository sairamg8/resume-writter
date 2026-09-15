// A demo account's restore of its originals (the rules: demoSeed.js) as a plain object, with
// everything outside passed in: the signed-in user, the account the cloud sync reports once its
// list is known (useCloudSync's `account`), the résumé store's state and restoreResumes, the
// sync's readCloudCopies. No React, so the tests drive this very code over the sync engine and a
// fake Firestore (tests/pdf/18-cloud-sync-restore.test.mjs); useDemoSeed only wires it to React.
import { buildRestore, isDemoAccount, needsRestore, originalsIn, privateOriginal, rememberCopies } from '@/utils/demoSeed';

/**
 * createDemoRestore({ accounts, ownerResume, now }):
 *   accounts     the demo accounts' e-mails, lower-case (DEMO_ACCOUNTS)
 *   ownerResume  the owner's résumé from the private file — the dev server only — else null
 *   now          () → ms
 * Returns { update({ user, account, appState, sync, store }) }: run after every render that
 * changed the user, the account or the résumés (useDemoSeed's effect).
 */
export function createDemoRestore({ accounts, ownerResume = null, now = () => Date.now() }) {
  // For the signed-in account: the latest copy of each résumé seen, deleted ones included (the
  // restore takes the originals among them), the ids on its deletion list (`gone`: deleted for
  // good, never brought back), the account object last taken in, `restoring` while the cloud is
  // asked for its copies, `imported` once the private file was looked at (once).
  let seed = null;
  // The account a restore may still be applied to: null once it signs out.
  let live = null;

  function seedFor(uid) {
    if (seed?.uid !== uid) seed = { uid, account: null, copies: new Map(), gone: new Set(), restoring: false, imported: false };
    return seed;
  }

  function update({ user, account, appState, sync, store }) {
    const demo = isDemoAccount(user, accounts);
    // Waiting for the account's list matters: restoring before it could overwrite newer cloud copies.
    const ready = demo && account?.uid === user.uid;
    live = ready ? user.uid : null;
    if (!demo) return;
    const s = seedFor(user.uid);
    if (ready && s.account !== account) {
      s.account = account;
      rememberCopies(s.copies, account.cloudOriginals);
      (account.cloudDeleted || []).forEach((id) => s.gone.add(id));
    }
    rememberCopies(s.copies, appState.resumes);
    if (!ready || s.restoring) return;

    if (ownerResume && !s.imported) {
      s.imported = true;
      const deleted = [...(account.cloudDeleted || []), ...(appState.deletedIds || [])];
      const own = privateOriginal(ownerResume, user, { resumes: appState.resumes, seen: s.copies, deleted, gone: [...s.gone], now: now() });
      if (own) { store.restoreResumes([own]); return; }
    }
    if (!needsRestore(appState.resumes)) return;
    const originals = originalsIn(s.copies, s.gone);
    if (!originals.length) return;
    // The cloud's copies first: another device may have edited an original since this one's first
    // sync (R4-4), or deleted one for good (V2OWNER-DATA-0). Without an answer, the copies this
    // browser knows come back here, and the sync sends nothing until a first sync gets through
    // again — which brings back the cloud's own copies instead of writing these over them (VM4-6).
    s.restoring = true;
    Promise.resolve(sync.readCloudCopies?.(originals.map((r) => r.id)))
      .catch(() => null)
      .then((cloud) => {
        s.restoring = false;
        if (seed !== s || live !== s.uid) return; // signed out meanwhile
        rememberCopies(s.copies, cloud?.docs);
        (cloud?.deleted || []).forEach((id) => s.gone.add(id));
        // None, if another device stopped keeping them or deleted them for good.
        const back = buildRestore(s.copies, now(), s.gone);
        if (back.length) store.restoreResumes(back);
      });
  }

  return { update };
}
