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

/**
 * The panel's two looks (R4-DVIS-32): `dashboard`, as the Dashboard's own cards (a 16 px radius, a
 * shadow, gray text); `workspace`, as the kit's panels beside it on the Job Tracker's Summary
 * (JobSummary's cards: a 6 px radius, the line border, flat, the ink tokens).
 */
const LOOKS = {
  dashboard: {
    card: 'rounded-2xl border border-gray-100 shadow-sm', rule: 'border-gray-100', avatar: 'rounded-xl',
    name: 'font-bold text-gray-900', ink: 'text-gray-900', muted: 'text-gray-400',
  },
  workspace: {
    card: 'rounded-md border border-line', rule: 'border-line', avatar: 'rounded-md',
    name: 'font-semibold text-ink', ink: 'text-ink', muted: 'text-ink-subtlest',
  },
};

export function CareerHistoryPanel({ resumes, activeId, showJobTrackerLink = true, variant = 'dashboard' }) {
  const look = LOOKS[variant] ?? LOOKS.dashboard;
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

  // A column whose timeline alone scrolls when the panel is held to a height — the Dashboard's sidebar is
  // never taller than the window (R4-DVIS-29) — so the header and the footer's link stay in view.
  return (
    <div className={`bg-white ${look.card} overflow-hidden flex flex-col min-h-0`}>
      {/* Profile header */}
      <div className={`px-5 pt-5 pb-4 border-b ${look.rule} shrink-0`}>
        <div className="flex items-center gap-3 mb-1">
          <div className={`w-9 h-9 ${look.avatar} bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0`}>
            {(personal.name || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className={`text-sm ${look.name} truncate`}>{personal.name || 'Your Name'}</p>
            <p className={`text-[11px] ${look.muted} truncate`}>{personal.title || ''}</p>
          </div>
        </div>
        {header && (
          <div className="mt-2 flex items-center gap-1.5">
            <Building2 size={11} className={look.muted} />
            <span className={`text-[11px] ${look.muted}`}>{header}</span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="px-4 py-4 min-h-0 overflow-y-auto">
        {items.length === 0 ? (
          <p className={`text-xs ${look.muted} text-center py-4`}>No experience entries yet</p>
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
                          <p className={`text-[12px] font-bold ${look.ink} leading-tight truncate`}>{item.company}</p>
                          <p className="text-[11px] font-medium truncate" style={{ color: color.text }}>{item.role}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {dur && <p className={`text-[10px] ${look.muted} font-medium`}>{dur}</p>}
                          {item.current && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">NOW</span>
                          )}
                        </div>
                      </div>
                      <p className={`text-[10px] ${look.muted} mt-0.5`}>{dates}</p>
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
        <div className="px-4 pb-4 shrink-0">
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
