/** The notice's look per kind: an error is an alert, the counts of an import a status (J-04). */
const LOOK = {
  error:   'text-red-600 bg-red-50 border-red-200',
  warning: 'text-amber-800 bg-amber-50 border-amber-200',
  success: 'text-emerald-800 bg-emerald-50 border-emerald-200',
};

/**
 * What the tracker says after an import (`notice`: importMessage's `{ kind, text }`, or null): a
 * read error or an empty file as an alert, the counts as a polite status — a successful import
 * used to say nothing at all (J-04, J-23). `className` places it in the page's column.
 */
export function ImportNotice({ notice, onDismiss, className }) {
  if (!notice) return null;
  return (
    <div className={className}>
      <p role={notice.kind === 'error' ? 'alert' : 'status'} className={`text-xs border rounded-lg px-3 py-2 flex items-start gap-2 ${LOOK[notice.kind] || LOOK.error}`}>
        <span className="flex-1">{notice.text}</span>
        <button type="button" onClick={onDismiss} className="font-semibold hover:underline">Dismiss</button>
      </p>
    </div>
  );
}
