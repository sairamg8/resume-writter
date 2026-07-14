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
import { useState } from 'react';

function SyncDot({ syncStatus, lastSynced, isOnline }) {
  const [tip, setTip] = useState(false);

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
  } else {
    return null;
  }

  return (
    <div className="relative" onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
      <Icon
        size={15}
        style={{ color }}
        className={syncStatus === 'syncing' ? 'animate-spin' : ''}
      />
      {tip && (
        <div className="absolute right-0 top-6 bg-gray-800 text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap z-50 shadow-lg">
          {label}
        </div>
      )}
    </div>
  );
}

export default function AuthBar({ user, authLoading, signInWithGoogle, signOut, syncStatus, lastSynced, isOnline }) {
  const [signingIn, setSigningIn] = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);

  async function handleSignIn() {
    setSigningIn(true);
    try { await signInWithGoogle(); } catch (e) { console.error(e); }
    setSigningIn(false);
  }

  if (authLoading) {
    return <div className="w-6 h-6 rounded-full bg-gray-100 animate-pulse" />;
  }

  if (!user) {
    return (
      <button
        onClick={handleSignIn}
        disabled={signingIn}
        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-60"
      >
        <GoogleIcon />
        {signingIn ? 'Signing in…' : 'Sign in with Google'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <SyncDot syncStatus={syncStatus} lastSynced={lastSynced} isOnline={isOnline} />

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
