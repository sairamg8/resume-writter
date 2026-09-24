import { notSavedMessage } from '@/utils/storageBackup';
import { RecoveryNotice } from '@/components/RecoveryNotice';

/**
 * Said on both board pages (useBoardStore's persistError and recovery): that changes are not
 * being saved, and that the saved list could not be read in full. Only the grid used to say
 * either, so edits made on a board while storage was full looked saved until the reload lost
 * them (R2-037). `className` places each notice in the page's own column.
 */
export function BoardStorageNotice({ persistError, recovery, onDismissRecovery, className }) {
  return (
    <>
      {persistError && (
        <div className={className}>
          <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {notSavedMessage('boards', persistError)}
          </p>
        </div>
      )}
      {recovery && (
        <div className={className}>
          <RecoveryNotice what="board list" recovery={recovery} onDismiss={onDismissRecovery} />
        </div>
      )}
    </>
  );
}
