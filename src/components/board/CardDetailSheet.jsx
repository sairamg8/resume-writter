import { X, Trash2, Calendar } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import { TasksTab } from '@/components/job/TasksTab';
import { LabelPicker } from '@/components/board/LabelPicker';
import { useIsMobile } from '@/hooks/useMediaQuery';

/**
 * The card editor — a bottom sheet on a phone (slides up, tall), a centred modal from md up. Every
 * field writes straight through `onChange` to the store (no local draft, no Save button): the board
 * behind updates live and the change syncs. The checklist reuses the Job Tracker's TasksTab, since
 * a card's checklist and a job's to-dos are the same `{ id, text, done }` shape.
 */
export function CardDetailSheet({ card, listTitle, onClose, onChange, onDelete }) {
  const mobile = useIsMobile();
  if (!card) return null;

  const panel = mobile ? 'w-full rounded-t-2xl max-h-[92vh]' : 'w-full max-w-lg rounded-2xl max-h-[88vh] my-8';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={onClose}>
      <div className={`bg-white ${panel} overflow-y-auto shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-start gap-2 z-10">
          <div className="flex-1 min-w-0">
            <textarea
              value={card.title}
              onChange={(e) => onChange({ title: e.target.value })}
              rows={1}
              placeholder="Card title"
              aria-label="Card title"
              className="w-full text-base font-semibold text-gray-900 resize-none focus:outline-none placeholder-gray-300"
            />
            {listTitle && <p className="text-[11px] text-gray-400">in {listTitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg shrink-0" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Labels</p>
            <LabelPicker labels={card.labels} onChange={(labels) => onChange({ labels })} />
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Due date</p>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <input
                type="date"
                value={card.due || ''}
                onChange={(e) => onChange({ due: e.target.value })}
                aria-label="Due date"
                className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {card.due && (
                <button onClick={() => onChange({ due: '' })} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Description</p>
            <RichTextEditor
              ariaLabel="Card description"
              value={card.description}
              onChange={(v) => onChange({ description: v })}
              placeholder="Add a more detailed description…"
              rows={4}
            />
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Checklist</p>
            <TasksTab todos={card.checklist || []} onChange={(checklist) => onChange({ checklist })} />
          </div>

          <div className="pt-2 border-t border-gray-100">
            <button onClick={onDelete} className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg">
              <Trash2 size={13} /> Delete card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
