import { Cloud, CloudOff, Loader, CloudAlert, LogOut } from 'lucide-react';

function GoogleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
import { useEffect, useRef, useState } from 'react';

const clip = (name) => (name.length > 32 ? `${name.slice(0, 31)}…` : name);

/**
 * While the cloud will not take a résumé — most often one over 1 MB, a large photo — it alone is
 * held back and the rest syncs (cloudSyncHeld.js): the tip names it. Stopped with none held: a
 * refused batch no résumé could be blamed for (cloudSyncRetry.js).
 */
function stoppedLabel(held = []) {
  if (held.length === 1) return `“${clip(held[0].name || 'Untitled')}” not synced (a large photo?) — saved in this browser`;
  if (held.length > 1) return `${held.length} résumés not synced (large photos?) — saved in this browser`;
  return 'Sync stopped (a large photo?) — saved in this browser';
}

/** A focus this soon after a pointer press came from that press (a tap or a click), not a keyboard. */
const PRESS_FOCUS_MS = 1000;

/**
 * The header's cloud icon — the only place that says what the sync is doing, and that a résumé is
 * not reaching the cloud (R2-019). A button named by its status (screen readers read it; keyboards
 * reach it). Its words open on mouse hover, on keyboard focus, and on a tap, Enter or Space; a
 * second tap, Escape, leaving it, or a tap anywhere else closes them. A tap's emulated hover and
 * focus are not counted, so one tap opens the words and the next closes them.
 */
function SyncDot({ syncStatus, lastSynced, isOnline, heldResumes }) {
  const [hover, setHover] = useState(false);     // a mouse is over it
  const [focused, setFocused] = useState(false); // keyboard focus
  const [pinned, setPinned] = useState(false);   // opened by a tap, or Enter / Space
  const pointer = useRef(null);                  // the pointer type last over or pressing it
  const pressedAt = useRef(-Infinity);
  const rootRef = useRef(null);
  const open = hover || focused || pinned;

  // A tap anywhere else closes words a tap opened (iOS Safari never focuses a tapped button, so
  // no blur comes to close them).
  useEffect(() => {
    if (!pinned) return undefined;
    const away = (e) => { if (!rootRef.current?.contains(e.target)) setPinned(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [pinned]);

  let Icon, color, label;
  if (!isOnline) {
    Icon = CloudOff; color = '#9ca3af'; label = 'Offline — changes saved locally';
  } else if (syncStatus === 'syncing') {
    Icon = Loader;    color = '#f59e0b'; label = 'Syncing…';
  } else if (syncStatus === 'synced') {
    Icon = Cloud;     color = '#22c55e';
    label = lastSynced ? `Synced ${lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Synced';
  } else if (syncStatus === 'error') {
    Icon = CloudAlert; color = '#ef4444'; label = 'Sync error — will retry';
  } else if (syncStatus === 'stopped') {
    Icon = CloudAlert; color = '#ef4444'; label = stoppedLabel(heldResumes);
  } else if (syncStatus === 'off') {
    // No access to the cloud (its rules, or no database): nothing is retried until a reload.
    Icon = CloudOff; color = '#9ca3af'; label = 'Sync is off — changes are saved in this browser';
  } else {
    return null;
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        data-testid="sync-status"
        aria-label={label}
        onPointerEnter={(e) => { pointer.current = e.pointerType; }}
        onPointerDown={(e) => { pointer.current = e.pointerType; pressedAt.current = Date.now(); }}
        // A touch fires an emulated mouseenter before its click: only a mouse hovers.
        onMouseEnter={() => { if (pointer.current == null || pointer.current === 'mouse') setHover(true); }}
        onMouseLeave={() => setHover(false)}
        onFocus={() => { if (Date.now() - pressedAt.current > PRESS_FOCUS_MS) setFocused(true); }}
        onBlur={() => { setFocused(false); setPinned(false); }}
        // A mouse click keeps what its hover shows; a tap, Enter or Space (detail 0) toggles.
        onClick={(e) => { if (!(e.detail > 0 && pointer.current === 'mouse')) setPinned((p) => !p); }}
        onKeyDown={(e) => { if (e.key === 'Escape') { setHover(false); setFocused(false); setPinned(false); } }}
        className="flex p-1 -m-1 rounded-md hover:bg-gray-100 transition-colors"
      >
        <Icon
          size={15}
          style={{ color }}
          aria-hidden="true"
          className={syncStatus === 'syncing' ? 'animate-spin' : ''}
        />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute right-0 top-6 w-max max-w-[min(18rem,calc(100vw_-_6rem))] bg-gray-800 text-white text-[11px] leading-snug rounded-lg px-2.5 py-1.5 z-50 shadow-lg"
        >
          {label}
        </div>
      )}
    </div>
  );
}

/** `compact` renders the signed-out state as an icon-only button, for narrow headers. */
export default function AuthBar({
  user, authLoading, cloudAvailable = true, signInWithGoogle, signOut, syncStatus, lastSynced, isOnline, heldResumes, compact = false,
}) {
  const [signingIn, setSigningIn] = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);

  async function handleSignIn() {
    setSigningIn(true);
    try { await signInWithGoogle(); } catch (e) { console.error(e); }
    setSigningIn(false);
  }

  // A build without Firebase config has no accounts: everything stays in this browser.
  if (!cloudAvailable) return null;

  if (authLoading) {
    return <div className="w-6 h-6 rounded-full bg-gray-100 animate-pulse" />;
  }

  if (!user) {
    return (
      <button
        onClick={handleSignIn}
        disabled={signingIn}
        title={compact ? 'Sign in with Google' : undefined}
        aria-label={compact ? 'Sign in with Google' : undefined}
        className={`flex items-center gap-2 ${compact ? 'p-1.5' : 'px-3 py-1.5'} bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-60 shrink-0`}
      >
        <GoogleIcon />
        {!compact && (signingIn ? 'Signing in…' : 'Sign in with Google')}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <SyncDot syncStatus={syncStatus} lastSynced={lastSynced} isOnline={isOnline} heldResumes={heldResumes} />

      <div className="relative">
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
              {user.displayName?.[0] || 'U'}
            </div>
          )}
          <span className="text-xs font-medium text-gray-700 max-w-[100px] truncate hidden sm:block">
            {user.displayName?.split(' ')[0]}
          </span>
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-9 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px]">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-800 truncate">{user.displayName}</p>
                <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); signOut(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <LogOut size={13} /> Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
