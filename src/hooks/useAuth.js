import { useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth, e2eUser } from '@/utils/firebase';

export function useAuth() {
  // e2eUser: Cypress's fake account in e2e builds (see firebase.js); null everywhere else.
  const [user, setUser] = useState(e2eUser);
  // Without Firebase there is nothing to wait for.
  const [authLoading, setAuthLoading] = useState(Boolean(auth));

  useEffect(() => {
    if (!auth) return undefined;
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  async function signInWithGoogle() {
    if (!auth) throw new Error('Cloud sync is not configured for this build.');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }

  async function signOut() {
    if (auth) await fbSignOut(auth);
    else setUser(null); // e2e's fake account (the only user a build without Firebase can have)
  }

  // Accounts exist with Firebase, or in an e2e page signed in to the fake account — whose header
  // then shows it as after a Google sign-in, so a test can see the sign-in happened (R4-9).
  return { user, authLoading, cloudAvailable: Boolean(auth || e2eUser), signInWithGoogle, signOut };
}
