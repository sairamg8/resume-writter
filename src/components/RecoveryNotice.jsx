/**
 * The notice for a saved list that could not be read in full (utils/storageBackup.js
 * loadSavedList): the résumés on the dashboard, the job list in the tracker. `what` names the
 * list; `recovery.backupKey` is where the original was copied, null when storage was too full.
 */
export function RecoveryNotice({ what, recovery, onDismiss }) {
  return (
    <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
      <span className="flex-1">
        Your saved {what} could not be read in full, so what could not be read was left out.{' '}
        {recovery.backupKey
          ? <>A copy of the original is kept in this browser's local storage under “{recovery.backupKey}”.</>
          : 'Browser storage is full, so no copy of the original could be kept.'}
      </span>
      <button onClick={onDismiss} className="font-semibold hover:text-red-800">Dismiss</button>
    </p>
  );
}
