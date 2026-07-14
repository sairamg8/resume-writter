import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';

const AVATAR_COLORS = [
  { bg: '#eef2ff', text: '#4338ca' },
  { bg: '#f0fdf4', text: '#15803d' },
  { bg: '#fff7ed', text: '#c2410c' },
  { bg: '#fdf4ff', text: '#a21caf' },
  { bg: '#eff6ff', text: '#1d4ed8' },
  { bg: '#fef9c3', text: '#92400e' },
];

function parseDate(str) {
  if (!str) return null;
  const [m, y] = str.split('/');
  if (!m || !y) return null;
  return new Date(parseInt(y), parseInt(m) - 1);
}

function durationLabel(start, end) {
  const s = parseDate(start);
  const e = end ? parseDate(end) : new Date();
  if (!s || !e) return '';
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (months <= 0) return '';
  const yrs = Math.floor(months / 12);
  const mos = months % 12;
  if (yrs === 0) return `${mos}mo`;
  if (mos === 0) return `${yrs}yr`;
  return `${yrs}yr ${mos}mo`;
}

function totalCareer(items) {
  if (!items.length) return '';
  const oldest = items.reduce((min, item) => {
    const d = parseDate(item.startDate);
    return d && (!min || d < min) ? d : min;
  }, null);
  if (!oldest) return '';
  const now = new Date();
  const months = (now.getFullYear() - oldest.getFullYear()) * 12 + (now.getMonth() - oldest.getMonth());
  const yrs = Math.floor(months / 12);
  const mos = months % 12;
  if (yrs === 0) return `${mos} months`;
  if (mos === 0) return `${yrs} years`;
  return `${yrs} yrs ${mos} mos`;
}

export function CareerHistoryPanel({ resumes, activeId, showJobTrackerLink = true }) {
  const navigate = useNavigate();
  const active = resumes?.find(r => r.id === activeId) || resumes?.[0];
  const expSection = active?.sections?.find(s => s.type === 'experience');
  const items = expSection?.items || [];
  const personal = active?.personal || {};
  const total = totalCareer(items);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Profile header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {(personal.name || 'S')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{personal.name || 'Your Name'}</p>
            <p className="text-[11px] text-gray-400 truncate">{personal.title || ''}</p>
          </div>
        </div>
        {total && (
          <div className="mt-2 flex items-center gap-1.5">
            <Building2 size={11} className="text-gray-400" />
            <span className="text-[11px] text-gray-400">{total} total · {items.length} companies</span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="px-4 py-4">
        {items.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No experience entries yet</p>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-indigo-300 via-indigo-100 to-gray-100" />
            <div className="space-y-4">
              {items.map((item, i) => {
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const dur = durationLabel(item.startDate, item.current ? null : item.endDate);
                const endLabel = item.current ? 'Present' : item.endDate;

                return (
                  <div key={item.id} className="relative">
                    <div
                      className={`absolute -left-6 mt-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${item.current ? 'ring-2 ring-indigo-300' : ''}`}
                      style={{ backgroundColor: item.current ? '#4f46e5' : '#94a3b8' }}
                    />
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-gray-900 leading-tight truncate">{item.company}</p>
                          <p className="text-[11px] font-medium truncate" style={{ color: color.text }}>{item.role}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {dur && <p className="text-[10px] text-gray-400 font-medium">{dur}</p>}
                          {item.current && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">NOW</span>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {item.startDate}{endLabel ? ` – ${endLabel}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer link — only shown on Dashboard */}
      {showJobTrackerLink && (
        <div className="px-4 pb-4">
          <button
            onClick={() => navigate('/jobs')}
            className="block w-full text-center text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 py-2 rounded-xl hover:bg-indigo-50 transition-colors"
          >
            Open Job Tracker →
          </button>
        </div>
      )}
    </div>
  );
}
