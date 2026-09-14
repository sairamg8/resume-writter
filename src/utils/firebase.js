import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * e2e builds only (`vite build --mode e2e`): Cypress signs in a fake account by putting it in
 * localStorage (`cpwtcv_e2e_user`), and that page runs without Firebase so it never reaches a
 * real project. Null in any other build, and in e2e pages nobody signed in to.
 */
export const e2eUser = (() => {
  if (import.meta.env.MODE !== 'e2e') return null;
  try { return JSON.parse(localStorage.getItem('cpwtcv_e2e_user')); } catch { return null; }
})();

/**
 * Cloud sync is optional. A clone without VITE_FIREBASE_* values (the open-source default)
 * gets `auth` and `db` as null and runs on localStorage alone; initializing Firebase with an
 * empty config throws auth/invalid-api-key at import time and blanks the whole app.
 */
export const firebaseEnabled = !e2eUser
  && Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

const app = firebaseEnabled ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;

// Persistent IndexedDB cache — writes queue offline and flush on reconnect automatically
export const db = app
  ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  : null;
