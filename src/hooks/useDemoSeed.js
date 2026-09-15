import { useEffect, useState } from 'react';
import { createDemoRestore } from '@/utils/demoRestore';
import { DEMO_ACCOUNTS } from '@/utils/demoAccounts';
// The owner's résumé from the git-ignored private/ file on the dev server; null in every build
// (vite-plugin-owner-resume.js), so it never reaches the public site.
import ownerResume from 'virtual:owner-resume';

/**
 * Demo accounts (DEMO_ACCOUNTS) always have their originals — the résumés marked "Keep as my
 * original". Once the account's list is known (useCloudSync's `account`), a list without any of
 * them — every résumé deleted, or only others left — gets them all back, each as its latest
 * edited copy: the cloud's, when the account has one — without its answer they wait for it
 * (`waiting`). An account with no original has nothing to bring back — except on the dev server,
 * where the owner's own résumé from the private file becomes it (privateOriginal) and syncs to
 * their account from there. The rules and their order live in utils/demoRestore.js, which the
 * sync tests run; this hook only calls it after each render.
 */
export function useDemoSeed({ user, appState, store, sync }) {
  // The originals are due back, but the account's cloud has not answered yet (the dashboard says so).
  const [waiting, setWaiting] = useState(false);
  const [restore] = useState(() => createDemoRestore({
    accounts: DEMO_ACCOUNTS,
    ownerResume: import.meta.env.DEV ? ownerResume : null,
    onWaiting: setWaiting,
  }));

  useEffect(() => {
    restore.update({ user, account: sync.account, appState, sync, store });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.email, sync.account, appState.resumes]);

  return { waiting };
}
