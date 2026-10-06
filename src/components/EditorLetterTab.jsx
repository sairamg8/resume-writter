import CoverLetterPanel from '@/components/CoverLetterPanel';

/**
 * The Cover Letter tab. `view` / `onViewChange` are the open one of its views (kept by the Editor
 * across tabs); the rest goes to CoverLetterPanel.
 */
export function EditorLetterTab({ view, onViewChange, ...panel }) {
  return (
    <div className="px-4 py-4">
      <CoverLetterPanel {...panel} />
    </div>
  );
}
