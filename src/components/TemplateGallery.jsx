import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { TemplateThumb } from '@/components/TemplateThumb';
import { usePickCard } from '@/hooks/usePickCard';
import { categoriesOf, filterCards, pickerCards, PICKER_FILTERS } from '@/utils/templatePicker';

/**
 * Design → Browse templates (A2): every card of the picker (utils/templatePicker.js) as a picture of
 * its page 1 (A1) with its letterhead beside it (F1), filtered by category (B3) and by what the page
 * prints (A3). A pick applies at once, as in the panel, with Undo (usePickCard); Done closes. On a phone
 * it is a full-screen sheet, two cards to a row, with Done always in view (E1).
 */
export function TemplateGallery({ open, onClose, resume, designs = [], setTemplate, updateSetting, applyDesign, restoreDesign }) {
  const [category, setCategory] = useState('');
  const [filters, setFilters] = useState([]);
  const cards = pickerCards(resume.settings || {}, designs);
  const shown = filterCards(cards, { category, filters });
  const { pick, selected } = usePickCard(resume, { setTemplate, updateSetting, applyDesign, restoreDesign });
  const toggle = (id) => setFilters((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      sheet
      title={`Templates (${cards.length})`}
      description="Each shows page 1 of a sample résumé in its look, with its cover letter's header. Picking one applies it now; Undo puts your look back."
      footer={<Button variant="primary" onClick={onClose} className="min-h-11 min-w-24" data-testid="gallery-done">Done</Button>}
    >
      <div data-testid="template-gallery" className="space-y-3">
        <div className="flex flex-wrap gap-1.5" data-testid="gallery-categories">
          <Chip size="sm" onClick={() => setCategory('')} pressed={category === ''}>All</Chip>
          {categoriesOf(cards).map((c) => (
            <Chip key={c.id} size="sm" onClick={() => setCategory(category === c.id ? '' : c.id)} pressed={category === c.id} data-category={c.id}>{c.label}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" data-testid="gallery-filters">
          {PICKER_FILTERS.map((f) => (
            <Chip key={f.id} size="sm" tone="info" onClick={() => toggle(f.id)} pressed={filters.includes(f.id)} data-filter={f.id}>{f.label}</Chip>
          ))}
        </div>
        {!shown.length && <p className="py-8 text-center text-sm text-gray-500">No template has all of these. Turn a filter off to see more.</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {shown.map((c) => {
            const on = selected(c);
            return (
              <button
                key={c.testid}
                type="button"
                data-testid={`gallery-${c.testid}`}
                onClick={() => pick(c)}
                className={`flex flex-col gap-2 p-2 rounded-xl border text-left transition-all ${on ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
              >
                <div className="relative rounded-md ring-1 ring-gray-200 bg-gray-50">
                  <TemplateThumb card={c} size="lg" picture />
                  {/* Its letterhead (F1), in the corner. */}
                  <span className="absolute bottom-1 right-1 rounded shadow ring-1 ring-gray-200 bg-white"><TemplateThumb card={c} letter /></span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-sm font-medium truncate ${on ? 'text-blue-700' : 'text-gray-800'}`}>{c.label}</p>
                    {c.ats && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-100 text-emerald-700">ATS</span>}
                  </div>
                  <p className="text-[11px] leading-snug text-gray-500 line-clamp-2">{c.desc}</p>
                  {on && <p className="text-[11px] font-semibold text-blue-600 mt-0.5">Selected</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
