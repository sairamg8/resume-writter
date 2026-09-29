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

  // Restarting a closed job is a status change like any other — the history records it, no
  // window.confirm: the Edit form and a board drag never asked, so only this path did (J-24).

  if (isTerminal) {
    const t = STATUS_MAP[status];
    return (
      <div className="space-y-4">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold"
          style={{ color: t.text, background: t.color + '15', border: `1px solid ${t.color}30` }}
        >
          <XCircle size={14} style={{ color: t.color }} />
          {t.label}
        </div>
        <div>
          {/* Drawn as the kit's Field draws a label, as are "Close as:" and "Mark as:" below: 10 px
              bold capitals were no other label's look (R4-DVIS-09). */}
          <p className="text-[12px] font-semibold leading-5 text-ink-subtle mb-2">Restart Application As</p>
          <div className="flex items-center gap-2 flex-wrap">
            {PIPELINE.map(id => {
              const s = STATUS_MAP[id];
              return (
                <button
                  key={id}
                  onClick={() => onChange(id)}
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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold"
          style={{ color: holdStatus.text, background: holdStatus.color + '15', border: `1px solid ${holdStatus.color}30` }}
        >
          <Pause size={14} style={{ color: holdStatus.color }} />
          On Hold
        </div>
        <div>
          <p className="text-[12px] font-semibold leading-5 text-ink-subtle mb-2">Resume Application</p>
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
        {/* As "Mark as:" (R4-DPH-13): on a phone narrower than the row it wraps between its pills,
            never inside one nor inside "Close as:" (R5-JOB-05). */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-line">
          <span className="text-[12px] font-semibold leading-5 text-ink-subtle whitespace-nowrap">Close as:</span>
          {[
            { id: 'rejected',  icon: XCircle, label: 'Rejected' },
            { id: 'withdrawn', icon: LogOut,  label: 'Withdrawn' },
          ].map(({ id, icon: Icon, label }) => {
            const s = STATUS_MAP[id];
            return (
              <button
                key={id}
                onClick={() => onChange(id)}
                className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border font-semibold whitespace-nowrap transition-all hover:scale-105"
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
      {/* Stage stepper. A step can be narrower than its label on one line ("Phone Screen" in a
          ~60 px step on a phone): the label then wraps under its circle, and each connector keeps
          8 px, so the labels do not run into one another and the line between the steps stays
          (R4-DPH-12). Where the labels fit, they stay on one line as before. Top-aligned, with the
          connector on the circles' centre line, so a two-line label moves no circle or connector. */}
      <div className="flex items-start">
        {PIPELINE.map((id, i) => {
          const s = STATUS_MAP[id];
          const done = i < activeIdx;
          const active = i === activeIdx;
          const isLast = i === PIPELINE.length - 1;
          return (
            <div key={id} className="flex items-start flex-1 min-w-0">
              <button
                onClick={() => onChange(id)}
                title={s.label}
                className="flex flex-col items-center gap-2 group"
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
                <span className={`text-[10px] font-semibold text-center ${active ? 'text-ink' : done ? 'text-ink-subtle' : 'text-ink-subtlest group-hover:text-ink-subtle'}`}>
                  {s.label}
                </span>
              </button>
              {!isLast && (
                <div className={`h-0.5 flex-1 min-w-2 mt-[17px] mx-0.5 sm:mx-1.5 rounded-full transition-colors ${done ? 'bg-gray-300' : 'bg-neutral-fill'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-line">
        {nextStatus && (
          <button
            onClick={() => onChange(nextId)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md text-white shadow-sm transition-all hover:scale-[1.02]"
            style={{ backgroundColor: nextStatus.color }}
          >
            <ArrowRight size={13} />
            Move to {nextStatus.label}
          </button>
        )}

        {/* Wider than a phone's card on one line: it wraps between its pills — never inside one, nor
            inside "Mark as:" — so each stays whole (R4-DPH-13). */}
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <span className="text-[12px] font-semibold leading-5 text-ink-subtle whitespace-nowrap">Mark as:</span>
          <button
            onClick={() => onChange(ON_HOLD)}
            className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border font-semibold whitespace-nowrap transition-all hover:scale-105"
            style={{ color: STATUS_MAP[ON_HOLD].text, backgroundColor: STATUS_MAP[ON_HOLD].bg, borderColor: STATUS_MAP[ON_HOLD].color + '50' }}
          >
            <Pause size={10} />
            On Hold
          </button>
          <button
            onClick={() => onChange('rejected')}
            className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border font-semibold whitespace-nowrap transition-all hover:scale-105"
            style={{ color: STATUS_MAP.rejected.text, backgroundColor: STATUS_MAP.rejected.bg, borderColor: STATUS_MAP.rejected.color + '40' }}
          >
            <XCircle size={11} />
            Rejected
          </button>
          <button
            onClick={() => onChange('withdrawn')}
            className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border font-semibold whitespace-nowrap transition-all hover:scale-105"
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
