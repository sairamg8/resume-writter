import { useSyncExternalStore } from 'react';
import { syncHeld } from '@/utils/collectionSyncMeta';

/**
 * The items of list `name` ('jobs' or 'boards') the cloud will not take — too large for one
 * Firestore document, or refused for good (collectionSyncEngine.js): named, so the user knows
 * those stay on this device only until made smaller, while everything else keeps syncing.
 * Nothing when there are none. `className` places it in the page's own column.
 */
export function SyncHeldNotice({ name, className }) {
  const held = useSyncExternalStore(syncHeld.subscribe, () => syncHeld.get()[name], () => syncHeld.get()[name]);
  if (!held?.length) return null;
  const what = name === 'jobs' ? 'job' : 'project';
  return (
    <div className={className}>
      <p role="status" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        {held.length === 1
          ? `This ${what} is too large to sync to your account and stays on this device only: `
          : `These ${what}s are too large to sync to your account and stay on this device only: `}
        {held.map((x) => x.name).join(', ')}. Make {held.length === 1 ? 'it' : 'them'} smaller (fewer or
        {' '}shorter items) and {held.length === 1 ? 'it syncs' : 'they sync'} again.
      </p>
    </div>
  );
}
