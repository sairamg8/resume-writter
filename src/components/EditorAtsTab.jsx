import AtsCheckerPanel from '@/components/AtsCheckerPanel';

/**
 * The ATS Check tab. `view` / `onViewChange` are the open one of its views (kept by the Editor across
 * tabs); the rest goes to AtsCheckerPanel.
 */
export function EditorAtsTab({ view, onViewChange, ...panel }) {
  return (
    <div className="px-4 py-4">
      <AtsCheckerPanel {...panel} />
    </div>
  );
}
