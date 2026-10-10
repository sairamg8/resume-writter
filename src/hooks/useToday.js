import { useSyncExternalStore } from 'react';
import { createTodayClock } from '../utils/todayClock.js';

const clock = createTodayClock();

/**
 * Today's local date ('YYYY-MM-DD'), and the component draws again when it changes: at the next local midnight, or
 * when the tab is shown or the window focused again (todayClock.js). For what reads the clock as it draws — a due
 * pill, a follow-up list, an Overdue filter — which otherwise kept yesterday's words past midnight until
 * something else made it draw. Listeners are removed when the component goes.
 */
export const useToday = () => useSyncExternalStore(clock.subscribe, clock.today, clock.today);
