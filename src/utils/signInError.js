/**
 * What the header says when a Google sign-in fails (R2-086), from Firebase's error code; null when
 * there is nothing to say — the user closed the popup, or a second click replaced the first popup.
 * Firebase's own messages ("Firebase: Error (auth/popup-blocked).") say nothing a user can act on.
 */
const NOT_AN_ERROR = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']);

export function signInErrorMessage(error) {
  const code = error?.code;
  if (NOT_AN_ERROR.has(code)) return null;
  switch (code) {
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site, then try again.';
    case 'auth/unauthorized-domain': {
      const host = typeof window !== 'undefined' ? window.location?.hostname : '';
      return `Sign-in is not set up for this address${host ? ` (${host})` : ''}. Open the app at its main address to sign in.`;
    }
    case 'auth/network-request-failed':
      return 'Could not reach Google to sign in. Check your connection, then try again.';
    case 'auth/web-storage-unsupported':
    case 'auth/operation-not-supported-in-this-environment':
      return 'This browser blocks what Google sign-in needs (site data or third-party cookies). Allow them for this site, then try again.';
    case 'auth/too-many-requests':
      return 'Too many sign-in attempts. Wait a minute, then try again.';
    default:
      // Not a Firebase error: a build without cloud sync says so in its own message.
      if (!code && error?.message) return `Sign-in failed: ${error.message}`;
      return `Sign-in failed${code ? ` (${code})` : ''}. Try again; your résumés stay saved in this browser.`;
  }
}
