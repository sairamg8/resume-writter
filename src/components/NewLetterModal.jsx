import { ArrowRight, FileText } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { timeAgo } from '@/utils/resume';

/**
 * Dashboard → New Cover Letter when there are several résumés (R2-135): which résumé's name, job
 * title, contacts and photo the new letter takes — `sources`, the most recently edited first (that
 * one has the focus) — or a blank letter. `onPick(id)`, `onPick(null)` for the blank one; Escape, the
 * close button or a click beside the box is `onClose()`, and makes nothing.
 *
 * The kit's Dialog (R4-DVIS-07), drawn as the dashboard's other dialogs are: in a portal at the end of
 * <body>, with the page behind held still while it is open (R5-DLG-04), capped at the screen that shows
 * with its list scrolling (R4-DPH-37); a click beside the box closes it only when the press both starts
 * and ends there, not when a drag crosses its edge (R5-DLG-03).
 */
export default function NewLetterModal({ isOpen, sources, onPick, onClose }) {
  return (
    <Dialog
      open={Boolean(isOpen)}
      onClose={onClose}
      size="md"
      title="New Cover Letter"
      description="Start from a résumé: its name, job title, contacts and photo head the letter."
    >
      <div className="space-y-2">
        {sources.map((r, i) => {
          const who = [r.personal?.name, r.personal?.title].filter(Boolean).join(' · ');
          const when = Number.isFinite(r.updatedAt) ? timeAgo(r.updatedAt).toLowerCase() : '';
          return (
            <button
              key={r.id}
              type="button"
              data-autofocus={i === 0 ? '' : undefined}
              onClick={() => onPick(r.id)}
              className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50/40 focus-visible:border-purple-500 transition-all flex items-center justify-between gap-3 group"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{r.name}</p>
                <p className="text-xs text-gray-500 truncate">{who || 'No name yet'}</p>
                {when && <p className="text-[11px] text-gray-400">{i === 0 ? 'Last edited' : 'Edited'} {when}</p>}
              </div>
              <ArrowRight size={15} className="text-gray-300 group-hover:text-purple-600 shrink-0 transition-colors" aria-hidden="true" />
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPick(null)}
          className="w-full text-left p-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-400 hover:bg-purple-50/40 transition-all flex items-center gap-3"
        >
          <FileText size={16} className="text-gray-400 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-gray-800">Blank letter</p>
            <p className="text-xs text-gray-400">No name or contacts yet: fill them in under Personal Info.</p>
          </div>
        </button>
      </div>
    </Dialog>
  );
}
