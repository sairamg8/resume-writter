import { useEffect, useRef } from 'react';
import { buildRestore, isDemoAccount, needsRestore, originalsIn, privateOriginal, rememberCopies } from '@/utils/demoSeed';
import { DEMO_ACCOUNTS } from '@/utils/demoAccounts';
// The owner's résumé from the git-ignored private/ file on the dev server; null in every build
// (vite-plugin-owner-resume.js), so it never reaches the public site.
import ownerResume from 'virtual:owner-resume';

/**
 * Demo accounts (DEMO_ACCOUNTS) always have their originals — the résumés marked "Keep as my
 * original". Once the account's list is known (useCloudSync's `account`), a list without any of
 * them — every résumé deleted, or only others left — gets them all back, each as its latest
 * edited copy from this browser or the cloud. Waiting for the sync matters: restoring before it
 * could overwrite newer cloud copies. An account with no original has nothing to bring back —
 * except on the dev server, where the owner's own résumé from the private file becomes it
 * (privateOriginal) and syncs to their account from there.
 */
export function useDemoSeed({ user, appState, store, sync }) {
  const demo = isDemoAccount(user, DEMO_ACCOUNTS);
  const ready = demo && sync.account?.uid === user.uid;
  // Latest copy of each résumé seen for the signed-in account, deleted ones included (the restore
  // takes the originals among them); `restoring` while the cloud is asked for its copies.
  // `imported`: the private file was looked at for this account (once).
  const seedRef = useRef({ uid: null, copies: new Map(), restoring: false, imported: false });
  // The account a restore may still be applied to: null once it signs out.
  const liveRef = useRef(null);

  function seedFor(uid) {
    if (seedRef.current.uid !== uid) seedRef.current = { uid, copies: new Map(), restoring: false, imported: false };
    return seedRef.current;
  }

  useEffect(() => {
    liveRef.current = ready ? user.uid : null;
    if (ready) rememberCopies(seedFor(user.uid).copies, sync.account.cloudOriginals);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sync.account]);

  useEffect(() => {
    if (!demo) return;
    const seed = seedFor(user.uid);
    rememberCopies(seed.copies, appState.resumes);
    if (!ready || seed.restoring) return;
    if (import.meta.env.DEV && !seed.imported) {
      seed.imported = true;
      const deleted = [...(sync.account.cloudDeleted || []), ...(appState.deletedIds || [])];
      const own = privateOriginal(ownerResume, user, { resumes: appState.resumes, seen: seed.copies, deleted, now: Date.now() });
      if (own) { store.restoreResumes([own]); return; }
    }
    if (!needsRestore(appState.resumes)) return;
    const originals = originalsIn(seed.copies);
    if (!originals.length) return;
    // The cloud's copies first: another device may have edited an original since this one's first
    // sync (R4-4). Without an answer, the copies this browser knows come back here, and the sync
    // sends nothing until a first sync gets through again — which brings back the cloud's own
    // copies instead of writing these over them (VM4-6).
    seed.restoring = true;
    Promise.resolve(sync.readCloudCopies?.(originals.map(r => r.id)))
      .catch(() => null)
      .then((cloud) => {
        seed.restoring = false;
        if (seedRef.current !== seed || liveRef.current !== seed.uid) return; // signed out meanwhile
        rememberCopies(seed.copies, cloud);
        const back = buildRestore(seed.copies, Date.now()); // none, if another device stopped keeping them
        if (back.length) store.restoreResumes(back);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, ready, user?.uid, appState.resumes]);
}
