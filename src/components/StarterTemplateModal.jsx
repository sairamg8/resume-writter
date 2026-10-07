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
        <p className="text-[11px] font-bold text-cv-faint uppercase tracking-wider mb-1.5">Template</p>
        <div className="flex gap-2 overflow-x-auto pb-1.5">
          <button
            type="button"
            data-testid="look-own"
            onClick={() => setLook(null)}
            className={`shrink-0 w-20 p-1.5 rounded-lg border text-center text-[10px] font-medium ${look === null ? 'border-cv-brand bg-cv-brand-soft text-cv-brand-text' : 'border-cv-hairline text-cv-muted hover:border-cv-field'}`}
          >
            <span className="flex h-14 items-center justify-center text-cv-faint">★</span>
            Each starter&apos;s own
          </button>
          {looks.map((c) => (
            <button
              key={c.testid}
              type="button"
              data-testid={`look-${c.testid}`}
              onClick={() => setLook(c)}
              className={`shrink-0 w-20 p-1.5 rounded-lg border flex flex-col items-center gap-1 text-[10px] font-medium ${look?.testid === c.testid ? 'border-cv-brand bg-cv-brand-soft text-cv-brand-text' : 'border-cv-hairline text-cv-muted hover:border-cv-field'}`}
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
        className="w-full text-left p-3.5 rounded-xl border-2 border-dashed border-cv-hairline hover:border-cv-brand hover:bg-cv-brand-soft/40 transition-all flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cv-sunken group-hover:bg-cv-brand-soft flex items-center justify-center text-cv-muted group-hover:text-cv-brand-text transition-colors">
            <FileText size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-cv-ink group-hover:text-cv-brand-text transition-colors">Start from Scratch (Blank)</h3>
            <p className="text-xs text-cv-faint">Empty sections to fill with your own custom experience.</p>
          </div>
        </div>
        <ArrowRight size={15} className="text-cv-faint group-hover:text-cv-brand-text transition-colors" />
      </button>

      <div className="flex items-center gap-2 pt-2">
        <span className="text-[11px] font-bold text-cv-faint uppercase tracking-wider">Curated ATS Role Starters</span>
        <div className="flex-1 h-px bg-cv-sunken" />
      </div>

      {/* Role Starters */}
      {STARTER_TEMPLATES.map(t => (
        <button
          key={t.id}
          onClick={() => onSelectStarter(t.id, lookOf(look))}
          className="w-full text-left p-3.5 rounded-xl border border-cv-hairline hover:border-cv-brand hover:bg-cv-brand-soft/30 transition-all flex items-center justify-between group shadow-2xs"
        >
          <div className="min-w-0 pr-3">
            {/* On a phone a long name and its badge do not fit one line (R4-DPH-39): the badge moves under
                the name, whole, instead of being squeezed until its pill breaks in two. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-sm font-bold text-cv-ink group-hover:text-cv-brand-text transition-colors">{t.name}</h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cv-brand-soft text-cv-brand-text border border-cv-brand-soft-border whitespace-nowrap shrink-0">{t.badge}</span>
            </div>
            <p className="text-xs text-cv-muted mt-0.5 line-clamp-1">{t.description}</p>
            <p className="text-[11px] text-cv-faint mt-0.5">Template: {templateOf(t)}</p>
          </div>
          <ArrowRight size={15} className="text-cv-faint group-hover:text-cv-brand-text shrink-0 transition-colors" />
        </button>
      ))}
    </div>
  );

  if (inline) {
    return (
      <section data-testid="starter-chooser" className="cv-card rounded-2xl border border-cv-hairline overflow-hidden">
        <div className="px-5 py-4 border-b border-cv-hairline bg-cv-ground/70">
          <h2 className="text-sm sm:text-base font-bold text-cv-ink">Or start blank, or from a role example</h2>
          <p className="text-[11px] text-cv-muted">Empty sections, or pre-filled, ATS-optimized role templates to make your own</p>
        </div>
        {content}
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cv-ink/60 backdrop-blur-sm" {...overlay}>
      <div className="bg-cv-surface rounded-2xl shadow-2xl border border-cv-hairline max-w-xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-cv-hairline flex items-center justify-between bg-cv-ground/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cv-brand text-white flex items-center justify-center shadow-sm">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-cv-ink">Choose a Resume Starter</h2>
              <p className="text-[11px] text-cv-muted">Start from scratch or use pre-filled, ATS-optimized role templates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-cv-faint hover:text-cv-ink hover:bg-cv-sunken rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {content}
      </div>
    </div>
  );
}
