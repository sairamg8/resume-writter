import { useEffect, useRef, useState } from 'react';
import { Mail, Phone, MapPin, Globe, Link2, Code, Eye, EyeOff, Camera, Palette, Sparkles } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import { Chip, Field, SectionBlock } from '@/components/CoverLetterPanelShared';
import { letterContactFormat, letterFieldsPosition, letterHiddenFields, letterResumePhoto, todayLetterDate } from '@/utils/coverLetter';
import { letterheadCentered, templateLabel } from '@/constants/templates';
import { readImageFile } from '@/utils/imageUpload';
import { CONTACT_FIELDS } from '@/utils/contacts';
import { useLetterPhoto } from '@/hooks/usePrintableImage';
import CoverLetterGeneratorModal from '@/components/CoverLetterGeneratorModal';
import { PHOTO_OPTIONS, photoOption } from '@/constants/photoOptions';
import { GapStepper } from '@/components/HeaderSpacingControls';
import { letterSideGapRow } from '@/utils/headerSpacingRows';
import { useToast } from '@/components/ui/Toast';

/** This panel's lucide icon per field — the names and their order come from CONTACT_FIELDS. */
const ICONS = { email: Mail, phone: Phone, location: MapPin, website: Globe, linkedin: Link2, github: Code };

export default function CoverLetterPanel({ resume, coverLetter, personal, settings, template, updateCoverLetter, updateSetting, clearSettings }) {
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const { toast, dismiss } = useToast(); // the Editor's notices; outside a ToastProvider, none
  // The résumé open now, for an Apply's Undo clicked later: updateCoverLetter writes to whichever
  // résumé is active, so Undo writes only while it is still the one Apply wrote to.
  const openId = useRef(resume?.id);
  openId.current = resume?.id;
  // Another résumé opened (or imported), or the panel left, takes Apply's Undo away with it.
  useEffect(() => () => dismiss('letter-generated'), [resume?.id, dismiss]);
  const cl = coverLetter || {};
  const contacts = letterContactFormat(cl, settings); // what the letter prints until a chip sets its own
  const photoInputRef = useRef(null);
  // The letterhead takes the résumé template's look; under a centred résumé header it is centred
  // too, and Fields Position / Text Position have nothing to place (FIDB-51).
  const centered = letterheadCentered(settings, template);
  // The Fields Position the letterhead prints: a stored value it does not offer marks Right of Name.
  const fieldsPosition = letterFieldsPosition(cl);

  function f(key) {
    return { value: cl[key], onChange: v => updateCoverLetter(key, v) };
  }

  // The letter's own hidden fields, independent of the résumé's — the same list its PDF and
  // Word export print from (a letter with no list yet starts from the résumé's).
  const hiddenFields = letterHiddenFields(cl, personal);
  const hiddenSet = new Set(hiddenFields);

  function toggleField(key) {
    const next = hiddenSet.has(key)
      ? hiddenFields.filter(k => k !== key)
      : [...hiddenFields, key];
    updateCoverLetter('hiddenFields', next);
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // The whole résumé, sections and all: an upload may take only what its cloud document has left (R2-097).
    const whole = { ...resume, personal, settings, template, coverLetter: cl };
    // Written to this letter's résumé by its id: a large photo takes a while to decode and shrink, and
    // by then another résumé may be open, which updateCoverLetter alone would give it to (R5-HUNT2).
    readImageFile(file, { kind: 'photo', resume: whole, replacing: cl.clPhoto }).then(dataUrl => updateCoverLetter('clPhoto', dataUrl, resume?.id), err => alert(err.message));
  }

  // Whether the letter prints a photo, and the line saying which one, or why none (R7-7).
  const { hasPhoto, note: photoNote } = useLetterPhoto(cl, personal);
  const photoShown = cl.showPhoto !== false;
  // The résumé photo the letter falls back on: none once hidden on the résumé (R2-092).
  const resumePhoto = letterResumePhoto(personal);

  function handleApplyGenerated(gen) {
    if (!gen) return;
    // The recipient block is written whole, so it names whom the body greets (AUD-31): a blank
    // name clears the last letter's (the body says "Dear Hiring Team,"), and a new name drops the
    // last person's title. A title typed for this same person stays; the generator asks for none.
    const next = {};
    const name = gen.recipientName ?? '';
    const samePerson = name !== '' && name === String(cl.recipientName ?? '').trim();
    next.recipientName = name;
    if (gen.recipientTitle || !samePerson) next.recipientTitle = gen.recipientTitle ?? '';
    // The company too: a blank generator Company clears the last one, so the block and the body
    // (which then says "[Company Name]") agree (R4-CL-01).
    next.company = gen.company ?? '';
    if (gen.subject) next.subject = gen.subject;
    if (gen.body) next.body = gen.body;
    if (gen.closing) next.closing = gen.closing;
    // The generator writes no signature, so a Signature Name or Designation the user typed stays
    // (R4-DUX-04); an empty one signs with the résumé's name and title as they are when it prints.
    // Only the placeholders an old generator stored ('Candidate', beside 'Professional') go (R2-043).
    if (cl.signatureName === 'Candidate') {
      next.signatureName = '';
      if (cl.signatureDesignation === 'Professional') next.signatureDesignation = '';
    }
    const before = Object.fromEntries(Object.keys(next).map(key => [key, cl[key]]));
    const appliedTo = resume?.id;
    for (const [key, value] of Object.entries(next)) updateCoverLetter(key, value);
    // Apply writes over what the user wrote (the body above all), so its notice has an Undo that
    // puts back every field Apply touched, as it was (R4-DUX-04).
    toast({
      id: 'letter-generated',
      title: 'Generated letter applied',
      description: 'Its body, subject and recipient replaced the letter\'s.',
      duration: 10000,
      action: {
        label: 'Undo',
        onClick: () => {
          if (openId.current !== appliedTo) return;
          for (const [key, value] of Object.entries(before)) updateCoverLetter(key, value);
        },
      },
    });
  }

  const effectiveResume = resume || { personal, settings, template, coverLetter: cl };

  return (
    <div className="space-y-4 py-2">

      <CoverLetterGeneratorModal
        isOpen={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        resume={effectiveResume}
        coverLetter={cl}
        onApply={handleApplyGenerated}
      />

      <p className="flex items-start gap-1.5 text-[11px] text-cv-muted leading-snug">
        <Palette size={12} className="mt-0.5 shrink-0 text-cv-faint" aria-hidden="true" />
        <span>Header style follows your résumé template (<strong>{templateLabel(template)}</strong>). Change the template in Design.</span>
      </p>

      {/* ── Photo ─────────────────────────────────────────────────────────── */}
      <SectionBlock title="Photo" defaultOpen={true}>
        <div className="flex items-center gap-3">
          {/* Preview / upload target */}
          <div
            onClick={() => photoInputRef.current?.click()}
            className="w-14 h-14 rounded-full border-2 border-dashed border-cv-field flex items-center justify-center cursor-pointer hover:border-cv-brand hover:bg-cv-brand-soft transition-colors overflow-hidden shrink-0"
          >
            {cl.clPhoto ? (
              <img src={cl.clPhoto} alt="" className="w-full h-full object-cover" />
            ) : resumePhoto ? (
              <img src={resumePhoto} alt="" className="w-full h-full object-cover opacity-50" />
            ) : (
              <div className="flex flex-col items-center gap-0.5 text-cv-faint">
                <Camera size={16} />
                <span className="text-[9px]">Photo</span>
              </div>
            )}
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-cv-ink">Cover Letter Photo</p>
            <p className={`text-[11px] mt-0.5 ${photoNote.warn ? 'text-cv-warn' : 'text-cv-faint'}`} data-testid="letter-photo-note">
              {photoNote.text}
            </p>
            <div className="flex gap-2 mt-1.5">
              {cl.clPhoto && (
                <button
                  onClick={() => updateCoverLetter('clPhoto', null)}
                  className="text-[11px] text-cv-bad hover:text-cv-bad"
                >
                  Remove own
                </button>
              )}
            </div>
          </div>

          {/* Show/hide toggle */}
          {hasPhoto && (
            <button
              onClick={() => updateCoverLetter('showPhoto', photoShown ? false : true)}
              className={`p-1.5 rounded transition-colors ${photoShown ? 'text-cv-brand-text hover:text-cv-brand-text' : 'text-cv-faint hover:text-cv-faint'}`}
              title={photoShown ? 'Hide photo from cover letter' : 'Show photo on cover letter'}
            >
              {photoShown ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          )}
        </div>

        {/* Photo text position — only when photo is shown, beside the name */}
        {photoShown && hasPhoto && centered && (
          <p className="text-[11px] text-cv-faint">Centred header: the photo sits above the name.</p>
        )}
        {photoShown && hasPhoto && !centered && (
          <div>
            <p className="text-xs font-semibold text-cv-ink mb-1.5">Text Position (relative to photo)</p>
            {/* The same list the résumé's panel offers and the PDF draws (AUD-25). */}
            <div className="flex gap-2">
              {PHOTO_OPTIONS.photoTextAlign.map(({ val, label }) => (
                <Chip key={val} active={photoOption('photoTextAlign', cl.photoTextAlign) === val} onClick={() => updateCoverLetter('photoTextAlign', val)}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </SectionBlock>

      {/* ── Header Layout ─────────────────────────────────────────────────── */}
      <SectionBlock title="Header Layout" defaultOpen={true}>
        {/* Fields position — 3 clear layout options; a centred letterhead stacks them instead */}
        {centered ? (
          <p className="text-[11px] text-cv-muted leading-snug">
            Centred like your résumé&apos;s header: photo, name and contacts on the centre line
            (Personal Info → Header Customization → Text Alignment).
          </p>
        ) : (
          <div>
            <p className="text-xs font-semibold text-cv-ink mb-2">Fields Position</p>
            <div className="space-y-1.5">
              {[
                { val: 'right',      label: 'Right of Name',   desc: '[Photo · Name/Title] ··· [Fields →]' },
                { val: 'below-name', label: 'Below Name',       desc: '[Photo] [Name/Title above · Fields below]' },
                { val: 'below-all',  label: 'Below Everything', desc: '[Photo · Name/Title] then [Fields ↓]' },
              ].map(({ val, label, desc }) => (
                <button
                  key={val}
                  onClick={() => updateCoverLetter('fieldsPosition', val)}
                  className={`w-full text-left px-3 py-2 rounded border text-xs transition-all ${
                    fieldsPosition === val
                      ? 'bg-cv-brand border-cv-brand text-white'
                      : 'border-cv-hairline text-cv-muted hover:border-cv-brand-soft-border hover:text-cv-brand-text'
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className={`text-[10px] mt-0.5 font-mono ${fieldsPosition === val ? 'text-cv-brand-soft' : 'text-cv-faint'}`}>{desc}</div>
                </button>
              ))}
            </div>
            {/* Right of Name: the space between the name side and the contacts (R2-137), a résumé
                header-spacing key no résumé header prints. */}
            {fieldsPosition === 'right' && (
              <div className="mt-2">
                <GapStepper row={letterSideGapRow(settings)} onChange={(v) => updateSetting?.('contactsSideGap', v)} onReset={() => clearSettings?.(['contactsSideGap'])} />
              </div>
            )}
          </div>
        )}

        {/* Contact Style */}
        <div>
          <p className="text-xs font-semibold text-cv-ink mb-2">Contact Style</p>
          <div className="flex gap-2">
            {[
              { val: 'icon',   label: '⊕ Icon' },
              { val: 'bullet', label: '• Bullet' },
              { val: 'bar',    label: '| Bar' },
            ].map(({ val, label }) => (
              <Chip key={val} active={contacts.style === val} onClick={() => updateCoverLetter('headerStyle', val)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Contact Layout */}
        <div>
          <p className="text-xs font-semibold text-cv-ink mb-2">Contact Layout</p>
          <div className="flex gap-2">
            {[
              { val: 'single',  label: 'Single' },
              { val: 'justify', label: 'Justify' },
              { val: '2grid',   label: '2 Grid' },
            ].map(({ val, label }) => (
              <Chip key={val} active={contacts.layout === val} onClick={() => updateCoverLetter('headerLayout', val)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Field Visibility */}
        <div>
          <p className="text-xs font-semibold text-cv-ink mb-2">Visible Contact Fields</p>
          <div className="space-y-1.5">
            {CONTACT_FIELDS.map(({ key, label }) => {
              const Icon = ICONS[key];
              const val = personal?.[key];
              const isHidden = hiddenSet.has(key);
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className={`text-xs flex items-center gap-1.5 ${isHidden ? 'text-cv-faint' : 'text-cv-ink'}`}>
                    <Icon size={12} className="text-cv-faint" />
                    {label}
                    {val && <span className="text-cv-faint font-normal truncate max-w-[100px]">— {val}</span>}
                  </span>
                  <button
                    onClick={() => toggleField(key)}
                    title={isHidden ? `Show ${label} on the cover letter` : `Hide ${label} from the cover letter`}
                    className={`p-0.5 rounded transition-colors ${isHidden ? 'text-cv-faint hover:text-cv-faint' : 'text-cv-brand-text hover:text-cv-brand-text'}`}
                  >
                    {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </SectionBlock>

      {/* ── Date, Recipient & Subject — printed above the body, each only when filled ── */}
      <SectionBlock title="Date, Recipient & Subject" defaultOpen={true}>
        <div className="space-y-2.5">
          <Field label="Date" placeholder="15 January 2026" {...f('date')}>
            <button
              type="button"
              onClick={() => updateCoverLetter('date', todayLetterDate())}
              className="absolute right-1.5 bottom-1.5 px-1.5 py-0.5 text-[11px] font-medium text-cv-brand-text hover:bg-cv-brand-soft rounded"
            >
              Today
            </button>
          </Field>
          <Field label="Recipient Name" placeholder="Jane Smith" {...f('recipientName')} />
          <Field label="Recipient Title" placeholder="Hiring Manager" {...f('recipientTitle')} />
          <Field label="Company" placeholder="Company name" {...f('company')} />
          <Field label="Subject" placeholder="Application for the Senior Engineer role" {...f('subject')} />
        </div>
      </SectionBlock>

      {/* ── Letter Body ───────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-cv-faint uppercase tracking-wide">Letter Body</p>
          <button
            type="button"
            onClick={() => setGeneratorOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-cv-brand-pressed bg-cv-brand-soft hover:bg-cv-brand-soft border border-cv-brand-soft-border rounded-cv-control transition-colors shadow-xs"
          >
            <Sparkles size={13} className="text-cv-brand-text" />
            <span>Auto-Generate from Resume</span>
          </button>
        </div>
        <RichTextEditor
          label="Body"
          value={cl.body || ''}
          onChange={v => updateCoverLetter('body', v)}
          placeholder="Dear Hiring Manager, I am writing to express my interest in..."
          rows={12}
        />
      </div>

      {/* ── Closing & Signature ───────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold text-cv-faint uppercase tracking-wide mb-3">Closing & Signature</p>
        <div className="space-y-2.5">
          <Field label="Closing Phrase" placeholder="Sincerely" {...f('closing')} />
          <div>
            <p className="block text-xs font-medium text-cv-muted mb-1">Signature Space</p>
            <div className="flex gap-2">
              {[
                { val: 'tight', label: 'Tight' },
                { val: 'wide',  label: 'Wide (hand-sign space)' },
              ].map(({ val, label }) => (
                <Chip key={val} active={(cl.signatureSpace || 'tight') === val} onClick={() => updateCoverLetter('signatureSpace', val)}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>
          <Field label="Signature Name" placeholder={personal?.name || 'Your Name'} {...f('signatureName')} />
          <Field label="Signature Designation" placeholder={personal?.title || 'Your Title'} {...f('signatureDesignation')} />
        </div>
      </div>
    </div>
  );
}
