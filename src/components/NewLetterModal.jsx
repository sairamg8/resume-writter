import { useId } from 'react';
import { ArrowRight, FileText, Mail, X } from 'lucide-react';
import { timeAgo } from '@/utils/resume';

/**
 * Dashboard → New Cover Letter when there are several résumés (R2-135): which résumé's name, job
 * title, contacts and photo the new letter takes — `sources`, the most recently edited first (that
 * one has the focus) — or a blank letter. `onPick(id)`, `onPick(null)` for the blank one; Escape, the
 * close button or a click beside the box is `onClose()`, and makes nothing.
 */
export default function NewLetterModal({ isOpen, sources, onPick, onClose }) {
  const titleId = useId();
  const descriptionId = useId();
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full flex flex-col overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Mail size={16} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm sm:text-base font-bold text-gray-900">New Cover Letter</h2>
              <p id={descriptionId} className="text-[11px] text-gray-500">Start from a résumé: its name, job title, contacts and photo head the letter.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-2 max-h-[70vh] overflow-y-auto">
          {sources.map((r, i) => {
            const who = [r.personal?.name, r.personal?.title].filter(Boolean).join(' · ');
            const when = Number.isFinite(r.updatedAt) ? timeAgo(r.updatedAt).toLowerCase() : '';
            return (
              <button
                key={r.id}
                autoFocus={i === 0}
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
      </div>
    </div>
  );
}
