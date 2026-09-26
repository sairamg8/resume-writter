import { useState, useMemo } from 'react';
import { Sparkles, X, Check, ArrowRight, Building, User, Briefcase } from 'lucide-react';
import { COVER_LETTER_ARCHETYPES, generateCoverLetter, extractResumeHighlights } from '@/utils/coverLetterGenerator';
import { sanitizeRichText } from '@/utils/richText';
import { useOverlayClose } from '@/hooks/useOverlayClose';

export default function CoverLetterGeneratorModal({ isOpen, onClose, resume, coverLetter, onApply }) {
  const [archetype, setArchetype] = useState('impact');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [recipient, setRecipient] = useState('');
  const overlay = useOverlayClose(onClose);

  // Each opening starts from the letter's own recipient and company, so Apply greets the person the
  // letter is addressed to and names the company its block prints: it used to start from a blank
  // company and "Hiring Manager", and Apply wrote "[Company Name]" under a filled Company and replaced
  // a typed name (R4-CL-01). A letter with no name is greeted "Dear Hiring Team,". Set while rendering
  // the opening, so its first preview is already the letter's.
  const [wasOpen, setWasOpen] = useState(false);
  if (!!isOpen !== wasOpen) {
    setWasOpen(!!isOpen);
    if (isOpen) {
      setCompany(String(coverLetter?.company ?? '').trim());
      setRecipient(String(coverLetter?.recipientName ?? '').trim());
    }
  }

  // The Cover Letter panel mounts this closed: the letter is written only while it is open, not on
  // every render of the tab (a throw here used to blank the editor before the generator was opened).
  const generated = useMemo(() => {
    if (!isOpen) return null;
    return generateCoverLetter({
      resume,
      archetype,
      company,
      role,
      recipientName: recipient,
    });
  }, [isOpen, resume, archetype, company, role, recipient]);

  // A letter with no experience, skills or title behind it (a Blank letter, or a résumé not filled
  // in yet) has nothing to be written from: the preview is generic filler ("utilizing modern best
  // practices"), so the modal says why rather than presenting it as tailored (R4-DUX-13).
  const nothingToDrawOn = useMemo(() => {
    if (!isOpen) return false;
    const h = extractResumeHighlights(resume);
    return h.topExperiences.length === 0 && h.topSkills.length === 0 && !h.candidateTitle;
  }, [isOpen, resume]);

  if (!isOpen) return null;

  function handleApply() {
    onApply(generated);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150" {...overlay}>
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">Smart Cover Letter Generator</h2>
              <p className="text-xs text-gray-500">Auto-tailor a compelling cover letter from your resume</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* Target Position Form */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                <Building size={12} className="text-gray-400" /> Target Company
              </label>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="e.g. Google, Stripe"
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                <Briefcase size={12} className="text-gray-400" /> Target Role
              </label>
              <input
                type="text"
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder={resume?.personal?.title || "e.g. Staff Software Engineer"}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                <User size={12} className="text-gray-400" /> Recipient Name
              </label>
              <input
                type="text"
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                placeholder="e.g. Hiring Manager"
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Archetype Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Writing Archetype & Tone
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {COVER_LETTER_ARCHETYPES.map(a => {
                const active = archetype === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setArchetype(a.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      active
                        ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500 text-blue-950'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50 text-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">{a.name}</span>
                      {active && <Check size={14} className="text-blue-600" />}
                    </div>
                    <span className="inline-block text-[10px] font-medium text-blue-700 bg-blue-100/60 px-1.5 py-0.5 rounded mb-1">
                      {a.badge}
                    </span>
                    <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                      {a.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {nothingToDrawOn && (
            <p data-testid="generator-no-details" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This letter has no résumé details to draw on: add experience and skills on the Resume tab, or start the letter from a résumé.
            </p>
          )}

          {/* Generated Preview */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Live Letter Preview
              </span>
              <span className="text-[11px] text-gray-500">
                Subject: {generated.subject}
              </span>
            </div>
            {/* Paragraphs set apart by the letter's own blank lines, as the PDF and Word print them (R2-130). */}
            <div
              className="prose prose-sm max-w-none text-xs text-gray-700 leading-relaxed max-h-56 overflow-y-auto bg-white p-3.5 rounded-lg border border-gray-200"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(generated.body) }}
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <p className="text-[11px] text-gray-500">
            Replaces existing letter fields and body with the generated content.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-200/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
            >
              Apply to Cover Letter <ArrowRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
