import { useState } from 'react';
import { ExternalLink, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { StatusBadge } from '@/components/job/StatusBadge';

function SortIcon({ active, dir }) {
  if (!active) return null;
  return dir === 'asc' ? <ChevronUp size={11} className="inline ml-0.5" /> : <ChevronDown size={11} className="inline ml-0.5" />;
}

export function ListView({ jobs, resumes, onNavigate, onDelete }) {
  const [sort, setSort] = useState({ key: 'updatedAt', dir: 'desc' });

  function toggleSort(key) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  }

  const sorted = [...jobs].sort((a, b) => {
    const av = a[sort.key] ?? '', bv = b[sort.key] ?? '';
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  const cols = [
    { key: 'company',     label: 'Company' },
    { key: 'role',        label: 'Role' },
    { key: 'status',      label: 'Status' },
    { key: 'location',    label: 'Location' },
    { key: 'salary',      label: 'Salary' },
    { key: 'appliedDate', label: 'Applied' },
    { key: 'deadline',    label: 'Deadline' },
    { key: 'contact',     label: 'Contact' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {cols.map(col => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className="text-left px-4 py-3 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-800 select-none whitespace-nowrap"
              >
                {col.label}
                <SortIcon active={sort.key === col.key} dir={sort.dir} />
              </th>
            ))}
            <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Tasks</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right whitespace-nowrap">Resume</th>
            <th className="w-16 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(job => {
            const resume = resumes.find(r => r.id === job.resumeId);
            return (
              <tr
                key={job.id}
                onClick={() => onNavigate(job.id)}
                className="border-b border-gray-50 last:border-0 hover:bg-indigo-50/40 group cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-900">{job.company || '—'}</span>
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{job.role || '—'}</td>
                <td className="px-4 py-3"><StatusBadge statusId={job.status} /></td>
                <td className="px-4 py-3 text-gray-500 text-xs">{job.location || '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{job.salary || '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{job.appliedDate || '—'}</td>
                <td className="px-4 py-3 text-xs">
                  {job.deadline ? (() => {
                    const past = new Date(job.deadline) < new Date();
                    const soon = !past && (new Date(job.deadline) - new Date()) < 3 * 24 * 60 * 60 * 1000;
                    return (
                      <span className={past ? 'text-red-500 font-medium' : soon ? 'text-amber-500 font-medium' : 'text-gray-500'}>
                        {job.deadline}
                      </span>
                    );
                  })() : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">
                  {job.contact || <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  {(job.todos?.length > 0) && (() => {
                    const done = job.todos.filter(t => t.done).length;
                    const all = job.todos.length;
                    const pct = Math.round((done / all) * 100);
                    return (
                      <div className="flex items-center gap-1.5 min-w-[60px]">
                        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${done === all ? 'bg-indigo-500' : 'bg-indigo-300'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{done}/{all}</span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-right">
                  {resume
                    ? <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{resume.name}</span>
                    : <span className="text-xs text-gray-300">—</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); onDelete(job.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {sorted.length === 0 && (
            <tr>
              <td colSpan={11} className="px-4 py-16 text-center">
                <p className="text-sm text-gray-400 mb-1">No jobs tracked yet</p>
                <p className="text-xs text-gray-300">Click "+ Add Job" to get started</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
