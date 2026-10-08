import { useEffect, useState } from 'react';

/**
 * Whether the signed-in account may open the Job Map: true once the server lets it read `jobmap/meta`
 * (firestore.rules; the owner grants an address by creating `jobmap_access/<email>`). False signed out and
 * for any other account; null until the answer comes. The check's code loads after the first paint.
 */
export function useJobMapAccess(user) {
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
    import('@/utils/jobMapIo').then((m) => m.hasJobMapAccess()).then((v) => { if (live) setOk(v); }, () => { if (live) setOk(false); });
    return () => { live = false; };
  }, [uid]);
  return okUid === uid ? ok : (uid ? null : false);
}
