import { notSavedMessage } from '@/utils/storageBackup';

/**
 * Said on every job page while the job list cannot be saved (useJobStore's persistError): the
 * tracker used to be the only page that said so, so a job added through the form — which lands
 * on the job's own page — looked saved until the tab closed (R6-2). `className` places it in
 * the page's own column.
 */
export function JobsNotSavedAlert({ error, className }) {
  if (!error) return null;
  return (
    <div className={className}>
      <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {notSavedMessage('jobs', error)}
      </p>
    </div>
  );
}
