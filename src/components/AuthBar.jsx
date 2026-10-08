import { Cloud, CloudOff, Loader, CloudAlert, LogOut, X } from 'lucide-react';
import { signInErrorMessage } from '@/utils/signInError';
import { useOutsideClose } from '@/hooks/useOutsideClose';

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
import { Suspense, lazy, useCallback, useRef, useState } from 'react';

// A failed load shows no item: the menu works without it.
const JobMapMenuItem = lazy(() => import('@/pages/JobMap').then((m) => ({ default: m.JobMapMenuItem }), () => ({ default: () => null })));

/** `name` cut to 32 characters, by whole characters: an emoji at the cut is not split into a broken half. */
export const clip = (name) => { const c = Array.from(name); return c.length > 32 ? `${c.slice(0, 31).join('')}…` : name; };

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

/** Chip colours by state (canvas States board): Saved good, Saving brand, Offline and off neutral, paused warn, errors bad. */
const TONE = {
  good: 'bg-cv-good-soft text-cv-good', brand: 'bg-cv-brand-soft text-cv-brand-text', neutral: 'bg-cv-sunken text-cv-muted',
  warn: 'bg-cv-warn-soft text-cv-warn', bad: 'bg-cv-bad-soft text-cv-bad',
};

/** The sync's icon, chip colours and words: the sync dot and the avatar menu's sync line say the same. Null when there is nothing to say. */
function syncView(syncStatus, lastSynced, isOnline, heldResumes, heldLabel = stoppedLabel) {
  if (!isOnline) return [CloudOff, TONE.neutral, 'Offline — changes saved locally'];
  // The browser says online, but Firestore cannot reach its server (a captive portal, a blocked
  // host): the sync keeps trying (cloudSyncEngine), and the icon must not vanish meanwhile.
  if (syncStatus === 'offline') return [CloudOff, TONE.warn, 'Cannot reach your account — changes saved locally, will retry'];
  if (syncStatus === 'syncing') return [Loader, TONE.brand, 'Syncing…'];
  if (syncStatus === 'synced') {
    return [Cloud, TONE.good, lastSynced ? `Synced ${lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Synced'];
  }
  if (syncStatus === 'error') return [CloudAlert, TONE.bad, 'Sync error — will retry'];
  if (syncStatus === 'stopped') return [CloudAlert, TONE.bad, heldLabel(heldResumes)];
  // No access to the cloud (its rules, or no database): nothing is retried until a reload.
  if (syncStatus === 'off') return [CloudOff, TONE.neutral, 'Sync is off — changes are saved in this browser'];
  return null;
}

/** A focus this soon after a pointer press came from that press (a tap or a click), not a keyboard. */
const PRESS_FOCUS_MS = 1000;

/**
 * The header's cloud icon — the only place that says what the sync is doing, and that a résumé is
 * not reaching the cloud (R2-019). A button named by its status (screen readers read it; keyboards
 * reach it). Its words open on mouse hover, on keyboard focus, and on a tap, Enter or Space; a
 * second tap, Escape, leaving it, or a tap anywhere else closes them. A tap's emulated hover and
 * focus are not counted, so one tap opens the words and the next closes them.
 *
 * The workspace's top bar shows the same icon for the jobs and the boards (shell/CollectionSyncDot,
 * R2-140-c): `heldLabel(held)` gives the 'stopped' words for what it holds back (the résumés'
 * by default).
 */
export function SyncDot({ syncStatus, lastSynced, isOnline, heldResumes, heldLabel }) {
  const [hover, setHover] = useState(false);     // a mouse is over it
  const [focused, setFocused] = useState(false); // keyboard focus
  const [pinned, setPinned] = useState(false);   // opened by a tap, or Enter / Space
  const pointer = useRef(null);                  // the pointer type last over or pressing it
  const pressedAt = useRef(-Infinity);
  const rootRef = useRef(null);
  const open = hover || focused || pinned;

  // A tap anywhere else closes words a tap opened (iOS Safari never focuses a tapped button, so
  // no blur comes to close them).
  const unpin = useCallback(() => setPinned(false), []);
  useOutsideClose(rootRef, pinned, unpin);

  const view = syncView(syncStatus, lastSynced, isOnline, heldResumes, heldLabel);
  if (!view) return null;
  const [Icon, tone, label] = view;

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
        className={`flex h-7 w-7 items-center justify-center rounded-full ${tone}`}
      >
        <Icon
          size={15}
          aria-hidden="true"
          className={syncStatus === 'syncing' ? 'animate-spin' : ''}
        />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute right-0 top-8 w-max max-w-[min(18rem,calc(100vw_-_6rem))] bg-cv-ink text-white text-[11px] leading-snug rounded-cv-control px-2.5 py-1.5 z-50 shadow-pop"
        >
          {label}
        </div>
      )}
    </div>
  );
}

/**
 * The account's photo (no-referrer) or its initial: the name's first character as written (a whole emoji, not half of one; spaces first are skipped), "U" for a nameless account.
 * A photo that does not load (offline with it out of the cache, a blocked host) falls back to the initial, as the kit's Avatar does; the address that failed is kept, so another account's photo is tried.
 */
function Avatar({ user, size }) {
  const [broken, setBroken] = useState(null);
  return user.photoURL && broken !== user.photoURL ? (
    <img src={user.photoURL} alt="" className={`${size} rounded-full`} referrerPolicy="no-referrer" onError={() => setBroken(user.photoURL)} />
  ) : (
    <div className={`${size} shrink-0 rounded-full bg-cv-brand-soft text-cv-brand-text flex items-center justify-center font-bold`}>
      {Array.from(user.displayName?.trim() ?? '')[0] || 'U'}
    </div>
  );
}

/**
 * `compact` renders the signed-out state as an icon-only button, for narrow headers. `hideName`
 * leaves the first name beside the avatar off the screen: the editor's header, in a 360 px split
 * panel, was left ~60 px for the résumé's name (R4-DVIS-31); it passes it in the split panel only.
 * `onShortcuts` (optional) adds a "Keyboard shortcuts ?" entry to the avatar menu: only the workspace,
 * where `?` works, passes it.
 */
export default function AuthBar({
  user, authLoading, cloudAvailable = true, signInWithGoogle, signOut, syncStatus, lastSynced, isOnline, heldResumes, compact = false,
  hideName = false, onShortcuts,
}) {
  const [signingIn, setSigningIn] = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const menuRef = useRef(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useOutsideClose(menuRef, menuOpen, closeMenu, undefined, { swallowClick: true }); // the first press outside only closes, as the backdrop it replaced
  // What the last sign-in failure was, in words (signInErrorMessage): it used to go to the
  // console only, so a blocked popup or an unauthorized domain looked like nothing (R2-086).
  const [signInError, setSignInError] = useState(null);
  // A sign-in that did not come through this button (another tab, another header) worked too: the
  // old failure is over, and would otherwise come back under the button at the next sign-out.
  if (user && signInError) setSignInError(null);

  async function handleSignIn() {
    setSigningIn(true);
    setSignInError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
      setSignInError(signInErrorMessage(e));
    }
    setSigningIn(false);
  }

  // A build without Firebase config has no accounts: everything stays in this browser.
  if (!cloudAvailable) return null;

  if (authLoading) {
    return <div data-testid="account-loading" className="w-9 h-9 rounded-full bg-cv-sunken animate-pulse" />;
  }

  if (!user) {
    return (
      <div className="relative shrink-0">
        <button
          data-testid="sign-in-button"
          onClick={handleSignIn}
          disabled={signingIn}
          title={compact ? 'Sign in with Google' : undefined}
          aria-label={compact ? 'Sign in with Google' : undefined}
          className={`cv-field flex items-center justify-center gap-2 h-9 ${compact ? 'w-9' : 'px-3 whitespace-nowrap'} text-[13px] font-semibold hover:bg-cv-sunken transition-colors disabled:opacity-60 shrink-0`}
        >
          {signingIn ? <Loader size={13} className="animate-spin" aria-hidden="true" /> : <GoogleIcon />}
          {!compact && (signingIn ? 'Signing in…' : 'Sign in with Google')}
        </button>
        {signInError && (
          <div
            role="alert"
            className="cv-notice-bad absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw_-_2rem)] flex items-start gap-2 text-xs leading-snug shadow-pop px-3 py-2"
          >
            <span className="flex-1">{signInError}</span>
            <button type="button" onClick={() => setSignInError(null)} aria-label="Dismiss" className="p-0.5 -m-0.5 shrink-0">
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    );
  }

  const [SyncIcon, syncTone, syncText] = syncView(syncStatus, lastSynced, isOnline, heldResumes) ?? [];
  const item = 'w-full flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm font-semibold text-cv-ink hover:bg-cv-sunken transition-colors';

  return (
    <div className="flex items-center gap-2">
      <SyncDot syncStatus={syncStatus} lastSynced={lastSynced} isOnline={isOnline} heldResumes={heldResumes} />

      <div className="relative" ref={menuRef}>
        <button
          data-testid="account-button"
          onClick={() => setMenuOpen(o => !o)}
          className={`flex items-center gap-1.5 p-0.5 ${hideName ? '' : 'sm:pr-2'} rounded-full hover:bg-cv-sunken transition-colors`}
        >
          <Avatar user={user} size="w-9 h-9 text-[13px]" />
          {/* hideName: sm:sr-only, not dropped, so from sm up the button still reads out the name as before. */}
          <span className={`text-[13px] font-semibold text-cv-body max-w-[100px] truncate hidden sm:block${hideName ? ' sm:sr-only' : ''}`}>
            {user.displayName?.split(' ')[0]}
          </span>
        </button>

        {menuOpen && (
          <div data-testid="account-menu" className={`cv-card absolute right-0 top-full mt-2 z-50 ${hideName ? 'w-56' : 'w-72'} max-w-[calc(100vw_-_2rem)] p-1.5 shadow-pop`}>
            <div className="flex items-center gap-3 p-3">
              <Avatar user={user} size="w-10 h-10 text-sm" />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-cv-ink truncate">{user.displayName}</p>
                <p className="text-[13px] text-cv-muted truncate">{user.email}</p>
              </div>
            </div>
            {SyncIcon && (
              <p data-testid="account-sync-line" className={`mx-1.5 flex items-center gap-2 rounded-cv-control px-3 py-2.5 text-[13px] font-semibold ${syncTone}`}>
                <SyncIcon size={16} aria-hidden="true" className="shrink-0" />
                {syncText}
              </p>
            )}
            <div className="h-px bg-cv-hairline mx-1.5 my-2" />
            {/* The Job Map's item, for the accounts the owner allowed: its code and its access check load only when this menu opens. */}
            <Suspense fallback={null}><JobMapMenuItem user={user} onPick={() => setMenuOpen(false)} className={item} /></Suspense>
            {onShortcuts && (
              <button data-testid="account-shortcuts" onClick={() => { setMenuOpen(false); onShortcuts(); }} className={item}>
                Keyboard shortcuts <span className="ml-auto text-xs font-medium text-cv-muted">?</span>
              </button>
            )}
            <button data-testid="account-sign-out" onClick={() => { setMenuOpen(false); signOut(); }} className={item}>
              <LogOut size={16} aria-hidden="true" /> Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
