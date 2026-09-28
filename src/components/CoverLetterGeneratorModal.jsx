import { useState, useMemo } from 'react';
import { Check, ArrowRight, Building, User, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { COVER_LETTER_ARCHETYPES, generateCoverLetter, extractResumeHighlights } from '@/utils/coverLetterGenerator';
import { sanitizeRichText } from '@/utils/richText';

export default function CoverLetterGeneratorModal({ isOpen, onClose, resume, coverLetter, onApply }) {
  const [archetype, setArchetype] = useState('impact');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [recipient, setRecipient] = useState('');
  // What the three fields held as this opening began: a click beside the box closes it only while
  // they still do (R4-DVIS-25, as R4-DUX-09 for the optimizer).
  const [opened, setOpened] = useState({ company: '', role: '', recipient: '' });

  // Each opening starts from the letter's own recipient and company, so Apply greets the person the
  // letter is addressed to and names the company its block prints: it used to start from a blank
  // company and "Hiring Manager", and Apply wrote "[Company Name]" under a filled Company and replaced
  // a typed name (R4-CL-01). A letter with no name is greeted "Dear Hiring Team,". Set while rendering
  // the opening, so its first preview is already the letter's.
  const [wasOpen, setWasOpen] = useState(false);
  if (!!isOpen !== wasOpen) {
    setWasOpen(!!isOpen);
    if (isOpen) {
      const start = { company: String(coverLetter?.company ?? '').trim(), role, recipient: String(coverLetter?.recipientName ?? '').trim() };
      setCompany(start.company);
      setRecipient(start.recipient);
      setOpened(start);
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

  const untouched = company === opened.company && role === opened.role && recipient === opened.recipient;

  // The kit's Dialog, as the Bullet Optimizer and the template gallery opened from the same editor are
  // (R4-DVIS-25): in a portal over the page, with the kit's title, close button and buttons, closing on
  // Escape. On a phone it fills the screen, its body scrolling between the title and the action row
  // (R4-DPH-37); the action row wraps rather than squeezing its buttons, the note above them (R4-DPH-38).
  // A click beside the box closes it only while nothing has been typed over what it opened with, so a
  // stray click does not throw the typing away; Cancel, × and Escape always close it.
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Smart Cover Letter Generator"
      description="Auto-tailor a compelling cover letter from your resume"
      closeOnOverlay={untouched}
      footer={(
        <>
          <p className="mr-auto text-[11px] text-gray-500">
            Replaces existing letter fields and body with the generated content.
          </p>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" rightIcon={ArrowRight} onClick={handleApply}>Apply to Cover Letter</Button>
        </>
      )}
    >
      <div className="space-y-5">
        {/* Target Position Form. Its fields are 16 px on a touch screen: iOS zooms the page into any
            smaller field it focuses (R4-DPH-36). A mouse keeps 12 px. */}
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
              className="w-full text-xs pointer-coarse:text-base px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full text-xs pointer-coarse:text-base px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full text-xs pointer-coarse:text-base px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          {/* Paragraphs set apart by the letter's own blank lines, as the PDF and Word print them (R2-130).
              From sm it scrolls in its own box, as before; on a phone, where the dialog fills the
              screen, it grows in the body's one scroll area rather than nesting a second (R4-DPH-37). */}
          <div
            className="prose prose-sm max-w-none text-xs text-gray-700 leading-relaxed sm:max-h-56 sm:overflow-y-auto bg-white p-3.5 rounded-lg border border-gray-200"
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(generated.body) }}
          />
        </div>
      </div>
    </Dialog>
  );
}
