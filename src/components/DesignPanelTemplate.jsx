import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { TemplateThumb } from '@/components/TemplateThumb';
import { isImeKey } from '@/components/ui/compose';
import { templateLabel } from '@/constants/templates';

// Design → Template's pieces. The cards are made by a plain function, not a component, so the panel's
// own element tree holds them (tests/pdf/93-template-presets walks it); the rest are components.

/**
 * One card (utils/templatePicker.js): its picture, name, ATS badge (atsRating's verdict on the page it
 * prints) and one line. `on`: the résumé is on it (border-cv-brand, as the specs read it).
 */
export function templateCard(c, { on, onPick }) {
  return (
    <button
      key={c.testid}
      type="button"
      data-testid={c.testid}
      onClick={() => onPick(c)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-cv-control border text-left transition-all ${
        on ? 'border-cv-brand bg-cv-brand-soft' : 'border-cv-hairline hover:border-cv-field hover:bg-cv-ground'
      }`}
    >
      <span className={`rounded ring-1 ring-cv-hairline ${on ? 'opacity-100' : 'opacity-80'}`}><TemplateThumb card={c} /></span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-sm font-medium ${on ? 'text-cv-brand-text' : 'text-cv-ink'}`}>{c.label}</p>
          {c.ats && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-cv-good-soft text-cv-good">ATS</span>}
        </div>
        <p className="text-[10px] text-cv-faint">{c.desc}</p>
      </div>
    </button>
  );
}

/**
 * The designs the user saved (B4) — each card with its Delete, asked twice — and "Save my design": the
 * résumé's look now, under a name, listed with the designs and picked like one. A name one of them has
 * already (any case, spaces trimmed) replaces that design on every résumé using it, and the field says so
 * (R4-DUX-30): two cards of the same name could not be told apart. Only one on `engine`, the template the
 * résumé prints: one on another template would take the résumés on it off it, so that name is refused.
 */
export function SavedDesigns({ cards, isOn, onPick, saveDesign, deleteDesign, engine }) {
  const [name, setName] = useState(null); // the name being typed, or null: the field closed
  const [deleting, setDeleting] = useState('');
  const typed = name?.trim() || '';
  const same = typed ? cards.find((c) => c.label.trim().toLowerCase() === typed.toLowerCase()) : null;
  const clash = Boolean(same && same.engine !== engine); // the name is taken on another template
  const save = () => {
    if (!typed || clash) return;
    saveDesign(typed, same?.preset || null);
    setName(null);
  };
  return (
    <div className="pt-2 space-y-1.5">
      <p className="text-[11px] font-semibold text-cv-muted">Your designs</p>
      {cards.map((c) => (
        <div key={c.testid} className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0">{templateCard(c, { on: isOn(c), onPick })}</div>
          {deleteDesign && (deleting === c.preset ? (
            <span className="flex shrink-0 gap-1">
              <button type="button" onClick={() => { deleteDesign(c.preset); setDeleting(''); }} className="px-2 py-1 text-[11px] font-semibold text-white bg-cv-bad hover:bg-cv-bad rounded">Delete</button>
              <button type="button" onClick={() => setDeleting('')} className="px-2 py-1 text-[11px] font-semibold text-cv-muted bg-cv-sunken hover:bg-cv-stage rounded">Keep</button>
            </span>
          ) : (
            <button type="button" onClick={() => setDeleting(c.preset)} title={`Delete ${c.label}`} aria-label={`Delete design ${c.label}`} className="p-2 shrink-0 text-cv-faint hover:text-cv-bad">
              <Trash2 size={13} />
            </button>
          ))}
        </div>
      ))}
      {!cards.length && <p className="text-[10px] text-cv-faint">None yet. Save the look you have made — font, colours, headings, spacing — to use it on any résumé.</p>}
      {saveDesign && (name === null ? (
        <button type="button" onClick={() => setName('')} className="w-full px-3 py-2 text-xs font-medium rounded-cv-control border border-dashed border-cv-field text-cv-muted hover:border-cv-brand hover:text-cv-brand-text">
          Save my design
        </button>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              aria-label="Design name"
              placeholder="Name this design"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (isImeKey(e)) return; if (e.key === 'Enter') save(); if (e.key === 'Escape') setName(null); }}
              className="flex-1 min-w-0 px-2 py-1.5 text-xs pointer-coarse:text-base border border-cv-field rounded-cv-control focus:outline-none focus:border-cv-brand-soft-border"
            />
            <button type="button" onClick={save} disabled={!typed || clash} className="px-3 py-1.5 text-xs font-semibold text-white bg-cv-brand hover:bg-cv-brand-pressed rounded-cv-control disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setName(null)} className="px-2 py-1.5 text-xs font-semibold text-cv-muted bg-cv-sunken hover:bg-cv-stage rounded-cv-control">Cancel</button>
          </div>
          {same && (
            <p data-testid="design-name-taken" className="text-[10px] text-cv-warn">
              {clash
                ? `You already have a design named ${same.label} on ${templateLabel(same.engine)} — choose another name.`
                : `You already have a design named ${same.label} — saving replaces it on every résumé that uses it.`}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/** The cover letter takes the template's look (F1): its letterhead beside the line that says so. */
export function LetterheadNote({ card }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      {card && <span className="rounded ring-1 ring-cv-hairline"><TemplateThumb card={card} letter /></span>}
      <p className="text-[10px] text-cv-faint">The cover letter&apos;s header takes the template&apos;s look too.</p>
    </div>
  );
}
