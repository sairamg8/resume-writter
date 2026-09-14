import { useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/utils/firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
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
  }

  return { user, authLoading, cloudAvailable: Boolean(auth), signInWithGoogle, signOut };
}
