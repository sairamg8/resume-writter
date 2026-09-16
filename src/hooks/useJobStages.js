import { useSyncExternalStore } from 'react';
import { addCustomStage, removeCustomStage, stagesSnapshot, subscribeStages } from '@/utils/jobStages';

export { PREDEFINED_STAGES } from '@/utils/jobStages';

/**
 * The custom interview stages, shared by every form in the tab and written only when one is added
 * or removed (src/utils/jobStages.js). Opening a form used to save the list back at once, which
 * dropped for good whatever of it could not be read (R6-3).
 */
export function useJobStages() {
  const customStages = useSyncExternalStore(subscribeStages, stagesSnapshot);
  return { customStages, addCustomStage, removeCustomStage };
}
