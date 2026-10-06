import { memo } from 'react';
import { PenLine, Eye, Palette } from 'lucide-react';

const SEGMENT = 'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all';

/**
 * The phone's floating Edit | Preview | Design pill. `view` is the one lit ('editor', 'preview', 'design', or
 * null while the ATS dock is open); `onPick(view)` is the Editor's stable picker: Edit and Preview close a dock,
 * Design opens the Design dock as a full-height sheet (a second press closes it). A memo leaf of a string and a
 * callback: a keystroke renders none of it (PERF-4); no router hook, no link.
 */
export const EditorMobilePill = memo(function EditorMobilePill({ view, onPick }) {
  const seg = (id, label, Icon) => (
    <button
      onClick={() => onPick(id)}
      data-testid={`pill-${id}`}
      className={`${SEGMENT} ${view === id ? 'bg-cv-brand text-white shadow' : 'text-white/70 hover:text-white'}`}
    >
      <Icon size={13} />
      <span>{label}</span>
    </button>
  );
  return (
    <div data-testid="editor-pill" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center bg-cv-ink/90 backdrop-blur-md text-white p-1 rounded-full shadow-pop border border-white/10 text-xs font-semibold">
      {seg('editor', 'Edit', PenLine)}
      {seg('preview', 'Preview', Eye)}
      {seg('design', 'Design', Palette)}
    </div>
  );
});
