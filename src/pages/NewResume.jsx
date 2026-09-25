import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import StarterTemplateModal from '@/components/StarterTemplateModal';
import { TemplateThumb, cardLook } from '@/components/TemplateThumb';
import { useBackOrHome } from '@/hooks/useBackOrHome';
import { savedDesigns } from '@/constants/templatePresets';
import { categoriesOf, filterCards, pickerCards } from '@/utils/templatePicker';
import { NEW_RESUME_NAME, resumeSources } from '@/utils/newResume';

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
  const cards = pickerCards(source?.settings || {}, savedDesigns(store.appState.resumes));
  const shown = filterCards(cards, { category });

  // The new résumé replaces /new in the history: Back from the editor goes to the dashboard.
  const open = (id) => navigate(`/resume/${id}`, { replace: true });
  const start = (card) => open(source
    ? store.createResume(NEW_RESUME_NAME, null, cardLook(card), source.id)
    : store.createResume(NEW_RESUME_NAME, null, cardLook(card)));

  return (
    <div className="min-h-screen bg-[#f5f3ef]" data-testid="new-resume-page">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button onClick={goBack} aria-label="Back" title="Back" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">New Resume</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Pick a look to start</h1>
              <p className="text-sm text-gray-500" data-testid="new-resume-from">
                {source
                  ? `Each page is your résumé "${source.name}" in that look. Pick one: a new résumé with your details opens on it, to make your own.`
                  : 'Pick one: a blank résumé opens on it. Each page shows a sample résumé in that look.'}
              </p>
            </div>
            {sources.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-gray-600">
                Your details from
                <select
                  data-testid="new-resume-source"
                  value={source.id}
                  onChange={(e) => setFromId(e.target.value)}
                  className="max-w-56 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800"
                >
                  {sources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
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
                className="flex flex-col gap-2 p-2 rounded-xl border border-gray-200 bg-white text-left transition-all hover:border-blue-400 hover:shadow-sm"
              >
                <div className="rounded-md ring-1 ring-gray-200 bg-gray-50 overflow-hidden">
                  <TemplateThumb card={c} size="lg" picture source={source} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate text-gray-800">{c.label}</p>
                    {c.ats && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-100 text-emerald-700">ATS</span>}
                  </div>
                  <p className="text-[11px] leading-snug text-gray-500 line-clamp-2">{c.desc}</p>
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
            onSelectStarter={(starterId, look) => open(look ? store.createResume(NEW_RESUME_NAME, starterId, look) : store.createResume(NEW_RESUME_NAME, starterId))}
            onSelectBlank={(look) => open(look ? store.createResume(NEW_RESUME_NAME, null, look) : store.createResume())}
          />
        </div>
      </div>
    </div>
  );
}
