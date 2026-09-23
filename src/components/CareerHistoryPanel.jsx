import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { dateRange, presentLabel } from '@/utils/dates';
import { careerItems, careerMonths, companiesLabel, companyCount, entryLabel, entrySpan, totalLabel } from '@/utils/careerHistory';

const AVATAR_COLORS = [
  { bg: '#eef2ff', text: '#4338ca' },
  { bg: '#f0fdf4', text: '#15803d' },
  { bg: '#fff7ed', text: '#c2410c' },
  { bg: '#fdf4ff', text: '#a21caf' },
  { bg: '#eff6ff', text: '#1d4ed8' },
  { bg: '#fef9c3', text: '#92400e' },
];

export function CareerHistoryPanel({ resumes, activeId, showJobTrackerLink = true }) {
  const navigate = useNavigate();
  const active = resumes?.find(r => r.id === activeId) || resumes?.[0];
  // What the résumé prints: every visible experience section's visible entries (AUD-29).
  const items = careerItems(active);
  const personal = active?.personal || {};
  const settings = active?.settings || {}; // its Date format: the timeline prints dates as the PDF does
  // Months worked (overlaps once, gaps not at all) and distinct companies, from those entries.
  const total = totalLabel(careerMonths(items));
  const companies = companiesLabel(companyCount(items));
  const header = [total && `${total} total`, companies].filter(Boolean).join(' · ');

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Profile header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {(personal.name || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{personal.name || 'Your Name'}</p>
            <p className="text-[11px] text-gray-400 truncate">{personal.title || ''}</p>
          </div>
        </div>
        {header && (
          <div className="mt-2 flex items-center gap-1.5">
            <Building2 size={11} className="text-gray-400" />
            <span className="text-[11px] text-gray-400">{header}</span>
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
                // A past job with no end date has no length: the PDF prints its start alone.
                const span = entrySpan(item);
                const dur = span ? entryLabel(span[1] - span[0]) : '';
                const dates = dateRange(item.startDate, item.current ? presentLabel(settings) : item.endDate, settings);

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
                      <p className="text-[10px] text-gray-400 mt-0.5">{dates}</p>
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
