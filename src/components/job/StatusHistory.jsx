import { STATUS_MAP } from '@/constants/jobs';

const TERMINAL = new Set(['rejected', 'withdrawn', 'on_hold']);

function fmt(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function StatusHistory({ history }) {
  if (!history?.length) return null;

  const rejections  = history.filter(h => h.status === 'rejected').length;
  const withdrawals = history.filter(h => h.status === 'withdrawn').length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Application History</p>
        <div className="flex gap-2">
          {rejections > 0 && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">
              Rejected {rejections}×
            </span>
          )}
          {withdrawals > 0 && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
              Withdrawn {withdrawals}×
            </span>
          )}
        </div>
      </div>

      <div className="relative pl-5">
        {/* Vertical rail */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-100" />

        <div className="space-y-4">
          {history.map((entry, i) => {
            const s = STATUS_MAP[entry.status];
            const isTerminalEntry = TERMINAL.has(entry.status);
            const isLast = i === history.length - 1;

            return (
              <div key={i} className="relative flex items-start gap-3">
                {/* Dot */}
                <div
                  className={`absolute -left-5 mt-[5px] w-2.5 h-2.5 rounded-full border-2 border-white shrink-0 ${isLast ? 'ring-2' : ''}`}
                  style={{
                    backgroundColor: s?.color || '#d1d5db',
                    boxShadow: isLast ? `0 0 0 3px ${s?.color || '#d1d5db'}30` : undefined,
                  }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: isTerminalEntry ? s?.text : '#374151' }}
                    >
                      {s?.label || entry.status}
                    </span>
                    {isTerminalEntry && isLast && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: s?.bg, color: s?.text }}
                      >
                        Current
                      </span>
                    )}
                    {isTerminalEntry && !isLast && (
                      <span className="text-[10px] text-gray-400">→ reopened</span>
                    )}
                  </div>
                  {entry.changedAt && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{fmt(entry.changedAt)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
