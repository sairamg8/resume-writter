import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import StarterTemplateModal from '@/components/StarterTemplateModal';
import { TemplateThumb, cardLook } from '@/components/TemplateThumb';
import { useBackOrHome } from '@/hooks/useBackOrHome';
import { savedDesigns } from '@/constants/templatePresets';
import { categoriesOf, filterCards, pickerCards } from '@/utils/templatePicker';
import { NEW_RESUME_NAME, resumeSources } from '@/utils/newResume';
import { defaultSettings } from '@/utils/defaultData';

/**
 * Dashboard → New Resume (the owner's asks of 2026-09-24, R3-011 and R3-012): a page of the picker's looks
 * — every template, design and saved design — each a picture of the user's own résumé on it, as picking it
 * will make it. A click makes that résumé (a copy of theirs on the look, useResumeStore.createResume's
 * `fromId`) and opens it: one step, no list of choices first. With several résumés, "Your details from"
 * says which one it starts from, the most recently edited unless another is picked. With none yet there is
 * nothing of theirs to draw: the looks show the sample, and a click starts a blank résumé on that look.
 * Blank and the role starters stay below the looks (StarterTemplateModal, inline).
 */
export function NewResume({ store }) {
  const navigate = useNavigate();
  const goBack = useBackOrHome();
  const [fromId, setFromId] = useState(null);
  const [category, setCategory] = useState('');
  const sources = resumeSources(store.appState.resumes);
  const source = sources.find((r) => r.id === fromId) ?? sources[0] ?? null;
  // With none, the looks are drawn over the settings a blank résumé starts with (its accent and text
  // colour), so a card shows the page a click makes (R4-DSN-03), not each template's own default blue.
  const cards = pickerCards(source?.settings || defaultSettings('classic'), savedDesigns(store.appState.resumes));
  const shown = filterCards(cards, { category });

  // The new résumé replaces /new in the history: Back from the editor goes to the dashboard.
  const open = (id) => navigate(`/resume/${id}`, { replace: true });
  // One résumé per visit: the editor opens as a transition, so this page stays clickable while its code
  // loads — a second click (or a double-click) made a second résumé.
  const made = useRef(false);
  const once = (make) => {
    if (made.current) return;
    made.current = true;
    open(make());
  };
  const start = (card) => once(() => (source
    ? store.createResume(NEW_RESUME_NAME, null, cardLook(card), source.id)
    : store.createResume(NEW_RESUME_NAME, null, cardLook(card))));

  return (
    <div className="min-h-screen bg-cv-ground" data-testid="new-resume-page">
      {/* The Documents page's width (1160 px), so the content edge stays put between the two pages. */}
      <div className="max-w-[1160px] mx-auto px-4 sm:px-8 pt-6 sm:pt-7 pb-12 space-y-6">
        <button onClick={goBack} aria-label="Back" title="Back" className="inline-flex items-center gap-1.5 text-sm font-medium text-cv-muted hover:text-cv-ink transition-colors">
          <ArrowLeft size={16} /> Documents
        </button>
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-cv-ink">Pick a look to start</h1>
              <p className="text-sm text-cv-muted" data-testid="new-resume-from">
                {source
                  ? `Each page is your résumé "${source.name}" in that look. Pick one: a new résumé with your details opens on it, to make your own.`
                  : 'Pick one: a blank résumé opens on it. Each page shows a sample résumé in that look.'}
              </p>
            </div>
            {sources.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-cv-muted">
                Your details from
                {/* The kit's select, as the Chips below are the kit's: 16 px on a touch screen, where a
                    smaller field makes iOS zoom the page when it is tapped. */}
                <Select
                  size="sm"
                  data-testid="new-resume-source"
                  value={source.id}
                  onChange={(e) => setFromId(e.target.value)}
                  className="max-w-56"
                  options={sources.map((r) => ({ value: r.id, label: r.name }))}
                />
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5" data-testid="new-resume-categories">
            <Chip size="sm" onClick={() => setCategory('')} pressed={category === ''}>All</Chip>
            {categoriesOf(cards).map((c) => (
              <Chip key={c.id} size="sm" onClick={() => setCategory(category === c.id ? '' : c.id)} pressed={category === c.id} data-category={c.id}>{c.label}</Chip>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {shown.map((c) => (
              <button
                key={c.testid}
                type="button"
                data-testid={`new-${c.testid}`}
                onClick={() => start(c)}
                className="flex flex-col gap-2 p-2 rounded-xl border border-cv-hairline bg-white text-left transition-all hover:border-cv-brand hover:shadow-sm"
              >
                <div className="rounded-md ring-1 ring-cv-hairline bg-cv-sunken overflow-hidden">
                  <TemplateThumb card={c} size="lg" picture source={source} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate text-cv-ink">{c.label}</p>
                    {c.ats && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-cv-good-soft text-cv-good">ATS</span>}
                  </div>
                  <p className="text-[11px] leading-snug text-cv-muted line-clamp-2">{c.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className="max-w-xl">
          <StarterTemplateModal
            inline
            isOpen
            onClose={goBack}
            onSelectStarter={(starterId, look) => once(() => store.createResume(NEW_RESUME_NAME, starterId, look, source?.id ?? null))}
            onSelectBlank={(look) => once(() => (look ? store.createResume(NEW_RESUME_NAME, null, look) : store.createResume()))}
          />
        </div>
      </div>
    </div>
  );
}
