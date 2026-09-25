import { useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth, e2eUser } from '@/utils/firebase';
import { SITE_OWNER } from '@/utils/siteOwner';

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
    if (!auth) {
      if (import.meta.env.DEV) {
        setUser(SITE_OWNER.devUser);
        return;
      }
      throw new Error('Cloud sync is not configured for this build.');
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('Google popup sign-in failed in dev; signing in as the dev user:', e);
        setUser(SITE_OWNER.devUser);
        return;
      }
      throw e;
    }
  }

  async function signOut() {
    if (auth) {
      try { await fbSignOut(auth); } catch {}
    }
    setUser(null);
  }

  // Accounts exist with Firebase, or in an e2e page signed in to the fake account — whose header
  // then shows it as after a Google sign-in, so a test can see the sign-in happened (R4-9).
  return { user, authLoading, cloudAvailable: Boolean(auth || e2eUser || import.meta.env.DEV), signInWithGoogle, signOut };
}
