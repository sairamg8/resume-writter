import { useEffect, useState } from 'react';

/** The check's code loads after the first paint, with the page. */
const askServer = () => import('@/utils/jobMapIo').then((m) => m.hasJobMapAccess());

/**
 * Whether the signed-in account may open the Job Map: true once the server lets it read `jobmap/meta`
 * (firestore.rules; the owner grants an address by creating `jobmap_access/<email>`). False signed out and
 * for any other account (the rules refused the read); 'failed' when the read itself failed (offline,
 * unavailable: nothing is known, so the page offers a retry instead of sending an allowed account away);
 * null until the answer comes. `attempt` asks again when it changes (the page's Retry); `ask` is the check
 * (a test's stand-in).
 */
export function useJobMapAccess(user, attempt = 0, ask = askServer) {
  const [ok, setOk] = useState(null);
  // Whose answer `ok` is. A page opened while the account was still being restored (a reload on
  // /job-map) first saw it signed out, and the effect below stored false for that. When the account
  // arrived, the render before the effect reset it still read that false, and the page sent an
  // allowed account to the Dashboard. A render for another account asks again instead.
  const [okUid, setOkUid] = useState(user?.uid);
  const uid = user?.uid;
  useEffect(() => {
    setOk(uid ? null : false);
    setOkUid(uid);
    if (!uid) return undefined;
    let live = true;
    Promise.resolve().then(ask).then((v) => { if (live) setOk(v); }, () => { if (live) setOk('failed'); });
    return () => { live = false; };
    // `ask` is a constant of the app; only a test passes another, and not between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, attempt]);
  return okUid === uid ? ok : (uid ? null : false);
}
