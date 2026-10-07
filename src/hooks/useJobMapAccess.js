import { useEffect, useState } from 'react';

/**
 * Whether the signed-in account may open the Job Map: true once the server lets it read `jobmap/meta`
 * (firestore.rules; the owner grants an address by creating `jobmap_access/<email>`). False signed out and
 * for any other account; null until the answer comes. The check's code loads after the first paint.
 */
export function useJobMapAccess(user) {
  const [ok, setOk] = useState(null);
  const uid = user?.uid;
  useEffect(() => {
    setOk(uid ? null : false);
    if (!uid) return undefined;
    let live = true;
    import('@/utils/jobMapIo').then((m) => m.hasJobMapAccess()).then((v) => { if (live) setOk(v); }, () => { if (live) setOk(false); });
    return () => { live = false; };
  }, [uid]);
  return ok;
}
