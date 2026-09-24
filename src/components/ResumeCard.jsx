import { useId } from 'react';
import { Copy, Trash2, Edit2, Check, Pin } from 'lucide-react';
import { timeAgo } from '@/utils/resume';
import { isOriginal } from '@/utils/demoSeed';
import { useRename } from '@/hooks/useRename';

const KEEP_HINT = 'Your originals come back whenever none of them is left';
const LAST_ORIGINAL_HINT = 'Your last original always comes back. To delete it, choose "Stop keeping" first.';

/**
 * A résumé on the dashboard. `onKeep(id, keep)` — only in a demo account, whose originals come
 * back (useDemoSeed) — adds "Keep as my original" / "Stop keeping" and the "Original" badge.
 * `lastOriginal`: deleted, it would come straight back (demoSeed.comesStraightBack), so Delete is
 * disabled and the card says why (V2OWNER-DATA-4).
 */
export function ResumeCard({ resume, onOpen, onDuplicate, onDelete, onRename, onKeep, lastOriginal = false }) {
  const rename = useRename(resume, (name) => onRename(resume.id, name));
  const hintId = useId();
  const accent = resume.settings?.accentColor || '#2563eb';

  return (
    <div className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
      {/* Thumbnail */}
      <div
        className="h-36 flex items-center justify-center relative cursor-pointer"
        style={{ background: `linear-gradient(135deg, ${accent}18 0%, ${accent}08 100%)` }}
        onClick={() => onOpen(resume.id)}
      >
        <div
          className="w-20 h-28 rounded shadow-md flex flex-col overflow-hidden"
          style={{ border: `2px solid ${accent}30` }}
        >
          <div className="h-7 flex items-center px-2" style={{ backgroundColor: accent }}>
            <div className="space-y-0.5 w-full">
              <div className="h-1 bg-white/70 rounded-sm w-4/5" />
              <div className="h-0.5 bg-white/40 rounded-sm w-1/2" />
            </div>
          </div>
          <div className="flex-1 bg-white p-1.5 space-y-1">
            {[0.9, 0.7, 0.85, 0.6, 0.75].map((w, i) => (
              <div key={i} className="h-1 rounded-sm" style={{ width: `${w * 100}%`, backgroundColor: `${accent}25` }} />
            ))}
          </div>
        </div>

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="px-4 py-2 bg-white rounded-lg shadow-md text-sm font-semibold text-gray-700">
            Open
          </span>
        </div>
      </div>

      {/* Name — grows, so every card in a row has its buttons at the bottom (the last original's hint is longer) */}
      <div className="px-3 pt-3 pb-1 flex-1">
        {rename.editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              aria-label="Résumé name"
              value={rename.draft}
              onChange={e => rename.setDraft(e.target.value)}
              onBlur={rename.commit}
              onKeyDown={e => {
                if (e.key === 'Enter') rename.commit();
                if (e.key === 'Escape') rename.cancel();
              }}
              className="flex-1 text-sm font-semibold border-b border-blue-400 outline-none bg-transparent"
            />
            <button onClick={rename.commit} aria-label="Save name" className="p-0.5 text-blue-600"><Check size={13} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group/name">
            <p className="text-sm font-semibold text-gray-800 truncate flex-1">{resume.name}</p>
            <button
              onClick={rename.start}
              title="Rename"
              aria-label="Rename"
              className="opacity-0 group-hover/name:opacity-100 no-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-600 transition-opacity shrink-0"
            >
              <Edit2 size={11} />
            </button>
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-0.5 capitalize">
          {resume.template || 'classic'} · {timeAgo(resume.updatedAt)}
        </p>
        {onKeep && (isOriginal(resume) ? (
          <div className="flex items-center gap-2 mt-1">
            <span title={KEEP_HINT} className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5">
              <Pin size={10} aria-hidden="true" /> Original
            </span>
            <button onClick={() => onKeep(resume.id, false)} className="text-[11px] text-gray-500 hover:text-gray-800 hover:underline">
              Stop keeping
            </button>
          </div>
        ) : (
          <button onClick={() => onKeep(resume.id, true)} title={KEEP_HINT} className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-amber-800">
            <Pin size={10} aria-hidden="true" /> Keep as my original
          </button>
        ))}
        {lastOriginal && <p id={hintId} className="mt-1 text-[11px] leading-snug text-gray-500">{LAST_ORIGINAL_HINT}</p>}
      </div>

      {/* Action buttons */}
      <div className="flex border-t border-gray-100 mt-2">
        <button
          onClick={() => onOpen(resume.id)}
          className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
        >
          <Edit2 size={11} /> Edit
        </button>
        <div className="w-px bg-gray-100" />
        <button
          onClick={() => onDuplicate(resume.id)}
          className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Copy size={11} /> Copy
        </button>
        <div className="w-px bg-gray-100" />
        <button
          onClick={() => onDelete(resume.id)}
          disabled={lastOriginal}
          title={lastOriginal ? LAST_ORIGINAL_HINT : undefined}
          aria-describedby={lastOriginal ? hintId : undefined}
          className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-gray-500 enabled:hover:bg-red-50 enabled:hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 size={11} /> Delete
        </button>
      </div>
    </div>
  );
}
