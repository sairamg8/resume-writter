import { useState } from 'react';
import { FileText, Sparkles, X, ArrowRight } from 'lucide-react';
import { getStarterSettings, STARTER_TEMPLATES } from '@/utils/starterTemplates';
import { templateLabel } from '@/constants/templates';
import { pickerCards } from '@/utils/templatePicker';
import { TemplateThumb } from '@/components/TemplateThumb';
import { useOverlayClose } from '@/hooks/useOverlayClose';

/**
 * Dashboard → New Resume: the content (blank, or a role starter) and the look in one step (D1). Each
 * starter says the template it comes on; the row of looks above them — every card of the Design panel's
 * picker, from the data — puts the new résumé on another. A pick of content creates it at once, on the
 * look chosen: `onSelectStarter(id, look)` / `onSelectBlank(look)`, `look` null for the starter's own.
 * `inline`: the same choices as a part of the /new page (R3-012), below the looks drawn with the user's
 * own résumé — no backdrop and no ×, since the page is where New Resume goes.
 */
export default function StarterTemplateModal({ isOpen, onClose, onSelectStarter, onSelectBlank, inline = false }) {
  const [look, setLook] = useState(null); // a card of pickerCards, or null: each starter's own
  const overlay = useOverlayClose(onClose);
  if (!isOpen) return null;
  // Over the settings a starter or a blank résumé starts with, so each look is drawn in the colours the
  // new résumé gets (R4-DSN-03).
  const looks = pickerCards(getStarterSettings('classic'));
  const lookOf = (c) => (c ? { engine: c.engine, preset: c.preset, variant: c.variant } : null);
  const templateOf = (starter) => (look ? look.label : templateLabel(starter.template));

  const content = (
    <div className={`p-5 space-y-3 ${inline ? '' : 'max-h-[75vh] overflow-y-auto'}`}>
      {/* The look (D1): each starter's own, or any template or design of the picker's. */}
      <div data-testid="starter-looks">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Template</p>
        <div className="flex gap-2 overflow-x-auto pb-1.5">
          <button
            type="button"
            data-testid="look-own"
            onClick={() => setLook(null)}
            className={`shrink-0 w-20 p-1.5 rounded-lg border text-center text-[10px] font-medium ${look === null ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
          >
            <span className="flex h-14 items-center justify-center text-gray-400">★</span>
            Each starter&apos;s own
          </button>
          {looks.map((c) => (
            <button
              key={c.testid}
              type="button"
              data-testid={`look-${c.testid}`}
              onClick={() => setLook(c)}
              className={`shrink-0 w-20 p-1.5 rounded-lg border flex flex-col items-center gap-1 text-[10px] font-medium ${look?.testid === c.testid ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              <TemplateThumb card={c} />
              <span className="w-full truncate">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Blank Option */}
      <button
        onClick={() => onSelectBlank(lookOf(look))}
        className="w-full text-left p-3.5 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center text-gray-500 group-hover:text-blue-600 transition-colors">
            <FileText size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800 group-hover:text-blue-700 transition-colors">Start from Scratch (Blank)</h3>
            <p className="text-xs text-gray-400">Empty sections to fill with your own custom experience.</p>
          </div>
        </div>
        <ArrowRight size={15} className="text-gray-300 group-hover:text-blue-600 transition-colors" />
      </button>

      <div className="flex items-center gap-2 pt-2">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Curated ATS Role Starters</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      {/* Role Starters */}
      {STARTER_TEMPLATES.map(t => (
        <button
          key={t.id}
          onClick={() => onSelectStarter(t.id, lookOf(look))}
          className="w-full text-left p-3.5 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all flex items-center justify-between group shadow-2xs"
        >
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{t.name}</h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{t.badge}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.description}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Template: {templateOf(t)}</p>
          </div>
          <ArrowRight size={15} className="text-gray-300 group-hover:text-blue-600 shrink-0 transition-colors" />
        </button>
      ))}
    </div>
  );

  if (inline) {
    return (
      <section data-testid="starter-chooser" className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/70">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">Or start blank, or from a role example</h2>
          <p className="text-[11px] text-gray-500">Empty sections, or pre-filled, ATS-optimized role templates to make your own</p>
        </div>
        {content}
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" {...overlay}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Choose a Resume Starter</h2>
              <p className="text-[11px] text-gray-500">Start from scratch or use pre-filled, ATS-optimized role templates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {content}
      </div>
    </div>
  );
}
