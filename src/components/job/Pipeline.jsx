import { Check, ArrowRight, Pause, XCircle, LogOut, Play } from 'lucide-react';
import { STATUS_MAP } from '@/constants/jobs';

const PIPELINE = ['saved', 'applied', 'phone_screen', 'interview', 'offer'];
const TERMINAL = new Set(['rejected', 'withdrawn']);
const ON_HOLD = 'on_hold';

export function Pipeline({ status, onChange }) {
  const isTerminal = TERMINAL.has(status);
  const isOnHold = status === ON_HOLD;
  const activeIdx = PIPELINE.indexOf(status);
  const nextId = PIPELINE[activeIdx + 1];
  const nextStatus = nextId ? STATUS_MAP[nextId] : null;

  function confirmReopen(id) {
    const s = STATUS_MAP[id];
    const ok = window.confirm(
      `Reopen this application as "${s.label}"?\n\nThis will restart the pipeline from "${s.label}".`
    );
    if (ok) onChange(id);
  }

  if (isTerminal) {
    const t = STATUS_MAP[status];
    return (
      <div className="space-y-4">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ color: t.text, background: t.color + '15', border: `1px solid ${t.color}30` }}
        >
          <XCircle size={14} style={{ color: t.color }} />
          {t.label}
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Restart Application As</p>
          <div className="flex items-center gap-2 flex-wrap">
            {PIPELINE.map(id => {
              const s = STATUS_MAP[id];
              return (
                <button
                  key={id}
                  onClick={() => confirmReopen(id)}
                  className="text-[11px] px-3 py-1.5 rounded-full border font-semibold transition-all hover:scale-105"
                  style={{ color: s.text, backgroundColor: s.bg, borderColor: s.color + '60' }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (isOnHold) {
    const holdStatus = STATUS_MAP[ON_HOLD];
    return (
      <div className="space-y-4">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ color: holdStatus.text, background: holdStatus.color + '15', border: `1px solid ${holdStatus.color}30` }}
        >
          <Pause size={14} style={{ color: holdStatus.color }} />
          On Hold
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Resume Application</p>
          <div className="flex items-center gap-2 flex-wrap">
            {PIPELINE.map(id => {
              const s = STATUS_MAP[id];
              return (
                <button
                  key={id}
                  onClick={() => onChange(id)}
                  className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border font-semibold transition-all hover:scale-105"
                  style={{ color: s.text, backgroundColor: s.bg, borderColor: s.color + '60' }}
                >
                  <Play size={10} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">Close as:</span>
          {[
            { id: 'rejected',  icon: XCircle, label: 'Rejected' },
            { id: 'withdrawn', icon: LogOut,  label: 'Withdrawn' },
          ].map(({ id, icon: Icon, label }) => {
            const s = STATUS_MAP[id];
            return (
              <button
                key={id}
                onClick={() => onChange(id)}
                className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border font-semibold transition-all hover:scale-105"
                style={{ color: s.text, backgroundColor: s.bg, borderColor: s.color + '40' }}
              >
                <Icon size={11} />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Active pipeline
  return (
    <div className="space-y-5">
      {/* Stage stepper */}
      <div className="flex items-center">
        {PIPELINE.map((id, i) => {
          const s = STATUS_MAP[id];
          const done = i < activeIdx;
          const active = i === activeIdx;
          const isLast = i === PIPELINE.length - 1;
          return (
            <div key={id} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => onChange(id)}
                title={s.label}
                className="flex flex-col items-center gap-2 group shrink-0"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                    active ? 'scale-110 shadow-lg' : 'hover:scale-105'
                  }`}
                  style={
                    active
                      ? { borderColor: s.color, backgroundColor: s.bg, boxShadow: `0 0 0 4px ${s.color}20` }
                      : done
                      ? { borderColor: s.color, backgroundColor: s.color }
                      : { borderColor: '#e5e7eb', backgroundColor: '#fff' }
                  }
                >
                  {done
                    ? <Check size={14} className="text-white" />
                    : <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: active ? s.color : '#d1d5db' }} />
                  }
                </div>
                <span className={`text-[10px] font-semibold whitespace-nowrap ${active ? 'text-gray-800' : done ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-600'}`}>
                  {s.label}
                </span>
              </button>
              {!isLast && (
                <div className={`h-0.5 flex-1 mx-1.5 mb-5 rounded-full transition-colors ${done ? 'bg-gray-300' : 'bg-gray-100'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100">
        {nextStatus && (
          <button
            onClick={() => onChange(nextId)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white shadow-sm transition-all hover:scale-[1.02]"
            style={{ backgroundColor: nextStatus.color }}
          >
            <ArrowRight size={13} />
            Move to {nextStatus.label}
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">Mark as:</span>
          <button
            onClick={() => onChange(ON_HOLD)}
            className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border font-semibold transition-all hover:scale-105"
            style={{ color: STATUS_MAP[ON_HOLD].text, backgroundColor: STATUS_MAP[ON_HOLD].bg, borderColor: STATUS_MAP[ON_HOLD].color + '50' }}
          >
            <Pause size={10} />
            On Hold
          </button>
          <button
            onClick={() => onChange('rejected')}
            className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border font-semibold transition-all hover:scale-105"
            style={{ color: STATUS_MAP.rejected.text, backgroundColor: STATUS_MAP.rejected.bg, borderColor: STATUS_MAP.rejected.color + '40' }}
          >
            <XCircle size={11} />
            Rejected
          </button>
          <button
            onClick={() => onChange('withdrawn')}
            className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border font-semibold transition-all hover:scale-105"
            style={{ color: STATUS_MAP.withdrawn.text, backgroundColor: STATUS_MAP.withdrawn.bg, borderColor: STATUS_MAP.withdrawn.color + '40' }}
          >
            <LogOut size={11} />
            Withdrawn
          </button>
        </div>
      </div>
    </div>
  );
}
