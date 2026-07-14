import { useState } from 'react';
import { Copy, Trash2, Edit2, Check } from 'lucide-react';
import { timeAgo } from '@/utils/resume';

export function ResumeCard({ resume, onOpen, onDuplicate, onDelete, onRename }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(resume.name);
  const accent = resume.settings?.accentColor || '#2563eb';

  function commitRename() {
    setEditing(false);
    if (name.trim()) onRename(resume.id, name.trim());
    else setName(resume.name);
  }

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

      {/* Name */}
      <div className="px-3 pt-3 pb-1">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') { setEditing(false); setName(resume.name); }
              }}
              className="flex-1 text-sm font-semibold border-b border-blue-400 outline-none bg-transparent"
            />
            <button onClick={commitRename} className="p-0.5 text-blue-600"><Check size={13} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group/name">
            <p className="text-sm font-semibold text-gray-800 truncate flex-1">{resume.name}</p>
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover/name:opacity-100 p-0.5 text-gray-400 hover:text-gray-600 transition-opacity shrink-0"
            >
              <Edit2 size={11} />
            </button>
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-0.5 capitalize">
          {resume.template || 'classic'} · {timeAgo(resume.updatedAt)}
        </p>
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
          className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <Trash2 size={11} /> Delete
        </button>
      </div>
    </div>
  );
}
