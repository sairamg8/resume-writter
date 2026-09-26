import { useState, useId } from 'react';
import { Plus, X as XIcon, CheckCircle2 } from 'lucide-react';
import { PREDEFINED_STAGES } from '@/hooks/useJobStages';
import { isImeKey } from '@/components/ui/compose';

export function InterviewStageSelector({ stage, onStageChange, customStages, addCustomStage, removeCustomStage }) {
  const [newStageInput, setNewStageInput] = useState('');
  const inputId = useId();

  function handleAddStage() {
    // The stage as the lists hold it: 'hr round' is the existing 'HR Round', not a stray spelling (J-28).
    const stage = addCustomStage(newStageInput);
    if (!stage) return;
    onStageChange(stage);
    setNewStageInput('');
  }

  return (
    <section className="bg-white rounded-md border border-line p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[11px] font-bold text-ink-subtlest uppercase tracking-widest">Interview Stage</h2>
          <p className="text-xs text-ink-subtlest mt-1">Select where you are in the process. Custom stages are saved for future use.</p>
        </div>
        {stage && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand-subtle px-3 py-1.5 rounded-full border border-brand-subtle-hover shrink-0 ml-4">
            <CheckCircle2 size={12} className="text-brand" />
            {stage}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] font-bold text-ink-subtlest uppercase tracking-widest mb-2.5">Predefined</p>
          <div className="space-y-0.5">
            {PREDEFINED_STAGES.map((s, i) => {
              const active = stage === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onStageChange(active ? '' : s)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-all ${active ? 'bg-brand-subtle text-brand font-semibold' : 'text-ink-subtle hover:bg-sunken'}`}
                >
                  <span className={`text-[11px] font-bold w-5 text-right shrink-0 tabular-nums ${active ? 'text-indigo-400' : 'text-ink-subtlest'}`}>{i + 1}.</span>
                  <span className="flex-1 leading-snug">{s}</span>
                  {active && <div className="w-2 h-2 rounded-full bg-brand shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col">
          <p className="text-[10px] font-bold text-ink-subtlest uppercase tracking-widest mb-2.5">Your Stages</p>
          <div className="flex-1">
            {customStages.length === 0 ? (
              <p className="text-xs text-ink-subtlest italic py-2">No custom stages yet — add one below.</p>
            ) : (
              <div className="space-y-0.5">
                {customStages.map((s, i) => {
                  const active = stage === s;
                  return (
                    <div key={s} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all ${active ? 'bg-brand-subtle' : 'hover:bg-sunken'}`}>
                      <button type="button" onClick={() => onStageChange(active ? '' : s)} className="flex-1 flex items-center gap-2.5 text-left">
                        <span className={`text-[11px] font-bold w-5 text-right shrink-0 tabular-nums ${active ? 'text-indigo-400' : 'text-ink-subtlest'}`}>{i + 1}.</span>
                        <span className={`text-sm flex-1 leading-snug ${active ? 'text-brand font-semibold' : 'text-ink-subtle'}`}>{s}</span>
                        {active && <div className="w-2 h-2 rounded-full bg-brand shrink-0" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (stage === s) onStageChange(''); removeCustomStage(s); }}
                        className="p-1 text-ink-subtlest hover:text-red-400 rounded transition-colors shrink-0"
                        title="Remove"
                      >
                        <XIcon size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-line">
            <label htmlFor={inputId} className="block text-[10px] font-semibold text-ink-subtlest mb-2">Add Custom Stage</label>
            <div className="flex gap-2">
              <input
                id={inputId}
                value={newStageInput}
                onChange={e => setNewStageInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !isImeKey(e)) { e.preventDefault(); handleAddStage(); } }}
                placeholder="e.g. 2nd Round, Founder Chat…"
                // 16 px on touch screens: iOS Safari zooms the page into any smaller field it focuses (J-38).
                className="flex-1 px-3 py-2 text-sm pointer-coarse:text-base border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              />
              <button
                type="button"
                onClick={handleAddStage}
                disabled={!newStageInput.trim()}
                className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-white bg-brand rounded-md hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
