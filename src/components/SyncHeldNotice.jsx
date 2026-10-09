import { useSyncExternalStore } from 'react';
import { syncConflicts, syncHeld } from '@/utils/collectionSyncMeta';

/**
 * The items of list `name` ('jobs' or 'boards') the cloud will not take — too large for one
 * Firestore document, or refused for good (collectionSyncEngine.js): named, so the user knows
 * those stay on this device only until made smaller, while everything else keeps syncing. And the
 * items two devices changed since they last synced, whose older edits are kept as a conflict copy
 * (SyncConflictNotice). Nothing when there are none. `className` places it in the page's own column.
 */
export function SyncHeldNotice({ name, className }) {
  const held = useSyncExternalStore(syncHeld.subscribe, () => syncHeld.get()[name], () => syncHeld.get()[name]);
  const what = name === 'jobs' ? 'job' : 'project';
  return (
    <>
      {held?.length > 0 && (
        <div className={className}>
          <p role="status" className="cv-notice-warn text-xs px-3 py-2">
            {held.length === 1
              ? `This ${what} is too large to sync to your account and stays on this device only: `
              : `These ${what}s are too large to sync to your account and stay on this device only: `}
            {held.map((x) => x.name).join(', ')}. Make {held.length === 1 ? 'it' : 'them'} smaller (fewer or
            {' '}shorter items) and {held.length === 1 ? 'it syncs' : 'they sync'} again.
          </p>
        </div>
      )}
      <SyncConflictNotice name={name} what={what} className={className} />
    </>
  );
}

/**
 * Said once two devices changed the same job or project since they last synced
 * (collectionSyncConflict.js): the newer copy stayed, the older edits are kept as a copy marked
 * "(conflict copy)". One short sentence, until dismissed.
 */
function SyncConflictNotice({ name, what, className }) {
  const items = useSyncExternalStore(syncConflicts.subscribe, () => syncConflicts.get()[name], () => syncConflicts.get()[name]);
  if (!items?.length) return null;
  return (
    <div className={className}>
      <p role="status" className="cv-notice-warn text-xs px-3 py-2 flex items-start gap-2">
        <span className="flex-1">
          {items.length === 1 ? `“${items[0]}” was` : `${items.length} ${what}s were`} changed on two devices: the older edits
          {' '}are kept as {items.length === 1 ? 'a copy' : 'copies'} marked (conflict copy).
        </span>
        <button type="button" onClick={() => syncConflicts.dismiss(name)} className="font-semibold hover:underline">Dismiss</button>
      </p>
    </div>
  );
}
