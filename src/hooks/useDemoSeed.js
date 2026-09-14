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
  // Latest copy of each sample seen for the signed-in account, deleted ones included.
  const seedRef = useRef({ uid: null, copies: new Map() });

  function copiesFor(uid) {
    if (seedRef.current.uid !== uid) seedRef.current = { uid, copies: new Map() };
    return seedRef.current.copies;
  }

  useEffect(() => {
    if (ready) rememberDemo(copiesFor(user.uid), sync.account.cloudDemo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sync.account]);

  useEffect(() => {
    if (!demo) return;
    const copies = rememberDemo(copiesFor(user.uid), appState.resumes);
    if (ready && needsDemoRestore(appState.resumes)) {
      store.restoreResumes(buildDemoRestore(DEMO_RESUMES, copies, Date.now()));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, ready, user?.uid, appState.resumes]);
}
