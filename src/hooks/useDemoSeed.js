import { useEffect, useRef } from 'react';
import { buildDemoRestore, isDemoAccount, needsDemoRestore, rememberDemo } from '@/utils/demoSeed';
import { DEMO_ACCOUNTS, DEMO_RESUMES } from '@/utils/demoResumes';

/**
 * Demo accounts (DEMO_ACCOUNTS) always have the sample résumés. Once the account's list is known
 * (useCloudSync's `account`), a list without any of them — a first sign-in, or the user deleted
 * them — gets the whole set back, each résumé as its latest edited copy from this browser or the
 * cloud. Waiting for the sync matters: restoring before it could overwrite newer cloud copies.
 */
export function useDemoSeed({ user, appState, store, sync }) {
  const demo = isDemoAccount(user, DEMO_ACCOUNTS);
  const ready = demo && sync.account?.uid === user.uid;
  // Latest copy of each sample seen for the signed-in account, deleted ones included; `restoring`
  // while the cloud is asked for its copies.
  const seedRef = useRef({ uid: null, copies: new Map(), restoring: false });
  // The account a restore may still be applied to: null once it signs out.
  const liveRef = useRef(null);

  function seedFor(uid) {
    if (seedRef.current.uid !== uid) seedRef.current = { uid, copies: new Map(), restoring: false };
    return seedRef.current;
  }

  useEffect(() => {
    liveRef.current = ready ? user.uid : null;
    if (ready) rememberDemo(seedFor(user.uid).copies, sync.account.cloudDemo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sync.account]);

  useEffect(() => {
    if (!demo) return;
    const seed = seedFor(user.uid);
    rememberDemo(seed.copies, appState.resumes);
    if (!ready || seed.restoring || !needsDemoRestore(appState.resumes)) return;
    // The cloud's copies first: another device may have edited a sample since this one's first
    // sync (R4-4). Without an answer, the copies this browser knows come back here, and the sync
    // sends nothing until a first sync gets through again — which brings back the cloud's own
    // copies instead of writing these over them (VM4-6).
    seed.restoring = true;
    Promise.resolve(sync.readCloudDemo?.(DEMO_RESUMES.map(r => r.id)))
      .catch(() => null)
      .then((cloud) => {
        seed.restoring = false;
        if (seedRef.current !== seed || liveRef.current !== seed.uid) return; // signed out meanwhile
        rememberDemo(seed.copies, cloud);
        store.restoreResumes(buildDemoRestore(DEMO_RESUMES, seed.copies, Date.now()));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, ready, user?.uid, appState.resumes]);
}
