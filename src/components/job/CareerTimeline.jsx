import { useAppStore } from '@/hooks/useResumeStore';

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
  if (yrs === 0) return `${mos} mo${mos !== 1 ? 's' : ''}`;
  if (mos === 0) return `${yrs} yr${yrs !== 1 ? 's' : ''}`;
  return `${yrs} yr${yrs !== 1 ? 's' : ''} ${mos} mo${mos !== 1 ? 's' : ''}`;
}

function totalCareerDuration(items) {
  if (!items.length) return '';
  const oldest = items.reduce((min, item) => {
    const d = parseDate(item.startDate);
    return d && (!min || d < min) ? d : min;
  }, null);
  if (!oldest) return '';
  const now = new Date();
  let months = (now.getFullYear() - oldest.getFullYear()) * 12 + (now.getMonth() - oldest.getMonth());
  const yrs = Math.floor(months / 12);
  const mos = months % 12;
  if (yrs === 0) return `${mos} months`;
  if (mos === 0) return `${yrs} years`;
  return `${yrs} yrs ${mos} mos`;
}

// Pastel palette for company avatars, cycling by index
const AVATAR_COLORS = [
  { bg: '#eef2ff', text: '#4338ca' },
  { bg: '#f0fdf4', text: '#15803d' },
  { bg: '#fff7ed', text: '#c2410c' },
  { bg: '#fdf4ff', text: '#a21caf' },
  { bg: '#eff6ff', text: '#1d4ed8' },
  { bg: '#fef9c3', text: '#92400e' },
];

export function CareerTimeline({ resumes, activeId }) {
  const activeResume = resumes?.find(r => r.id === activeId) || resumes?.[0];
  const expSection = activeResume?.sections?.find(s => s.type === 'experience');
  const items = expSection?.items || [];

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <span className="text-2xl">📋</span>
        </div>
        <p className="text-gray-500 font-medium">No experience entries found</p>
        <p className="text-xs text-gray-400 mt-1">Add experience to your resume to see your career timeline here.</p>
      </div>
    );
  }

  const totalDuration = totalCareerDuration(items);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header summary */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Career History</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {items.length} position{items.length !== 1 ? 's' : ''}
            {totalDuration ? ` · ${totalDuration} total` : ''}
          </p>
        </div>
        {activeResume?.personal?.name && (
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-700">{activeResume.personal.name}</p>
            <p className="text-xs text-gray-400">{activeResume.personal.title}</p>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="relative pl-10">
        {/* Vertical rail */}
        <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-gradient-to-b from-indigo-300 via-indigo-100 to-gray-100" />

        <div className="space-y-6">
          {items.map((item, i) => {
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const isCurrent = item.current;
            const duration = durationLabel(item.startDate, isCurrent ? null : item.endDate);
            const dateRange = [item.startDate, isCurrent ? 'Present' : item.endDate].filter(Boolean).join(' – ');

            return (
              <div key={item.id} className="relative">
                {/* Timeline dot */}
                <div
                  className={`absolute -left-10 mt-3 w-4 h-4 rounded-full border-2 border-white shadow-sm ${isCurrent ? 'ring-2 ring-indigo-300' : ''}`}
                  style={{ backgroundColor: isCurrent ? '#4f46e5' : '#94a3b8' }}
                />

                {/* Card */}
                <div className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${isCurrent ? 'border-indigo-200 shadow-indigo-50' : 'border-gray-100'}`}>
                  <div className="flex items-start gap-3">
                    {/* Company avatar */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0"
                      style={{ backgroundColor: color.bg, color: color.text }}
                    >
                      {(item.company || '?')[0].toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <div className="font-bold text-gray-900 text-sm leading-tight">{item.company || 'Unknown Company'}</div>
                          <div className="text-sm font-medium mt-0.5" style={{ color: color.text }}>{item.role || 'No role'}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-gray-500 font-medium">{dateRange}</div>
                          {duration && (
                            <div className="text-[10px] text-gray-400 mt-0.5">{duration}</div>
                          )}
                          {isCurrent && (
                            <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                              Current
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Extract project headings from description HTML */}
                      {item.description && (
                        <ProjectTags html={item.description} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProjectTags({ html }) {
  // Extract <strong> tag text (project names) from description HTML
  const matches = [...html.matchAll(/<strong>([^<]+)<\/strong>/g)].map(m => m[1]);
  if (!matches.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {matches.map((tag, i) => (
        <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
          {tag}
        </span>
      ))}
    </div>
  );
}
