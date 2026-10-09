import { useEffect, useSyncExternalStore } from 'react';
import { addCustomStage, removeCustomStage, stagesSnapshot, subscribeStages } from '@/utils/jobStages';

export { PREDEFINED_STAGES } from '@/utils/jobStages';

/**
 * The custom interview stages, shared by every form in the tab and written only when one is added
 * or removed (src/utils/jobStages.js). Opening a form used to save the list back at once, which
 * dropped for good whatever of it could not be read (R6-3). `uid` is the signed-in account: its
 * stages are its own (another account on this browser never sees them) and follow it to its other
 * devices (jobStagesCloud.js); null, they are this browser's.
 */
export function useJobStages(uid = null) {
  const customStages = useSyncExternalStore(subscribeStages, () => stagesSnapshot(uid));
  useEffect(() => {
    if (!uid) return undefined;
    let live = true;
    let stop = () => {};
    // Loaded on use: the Firestore calls are no weight on the start-up path.
    import('@/utils/jobStagesBrowser').then(({ watchAccountStages }) => {
      if (live) stop = watchAccountStages(uid);
    }).catch(() => {});
    return () => { live = false; stop(); };
  }, [uid]);
  return { customStages, addCustomStage, removeCustomStage };
}
