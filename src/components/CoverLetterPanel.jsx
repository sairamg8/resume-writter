import { useRef, useState } from 'react';
import { Mail, Phone, MapPin, Globe, Link2, Code, Eye, EyeOff, Camera, Palette, Sparkles } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import { Chip, Field, SectionBlock } from '@/components/CoverLetterPanelShared';
import { letterContactFormat, letterFieldsPosition, letterHiddenFields, todayLetterDate } from '@/utils/coverLetter';
import { letterheadCentered, templateLabel } from '@/constants/templates';
import { readImageFile } from '@/utils/imageUpload';
import { CONTACT_FIELDS } from '@/utils/contacts';
import { useLetterPhoto } from '@/hooks/usePrintableImage';
import CoverLetterGeneratorModal from '@/components/CoverLetterGeneratorModal';
import { PHOTO_OPTIONS, photoOption } from '@/constants/photoOptions';

/** This panel's lucide icon per field — the names and their order come from CONTACT_FIELDS. */
const ICONS = { email: Mail, phone: Phone, location: MapPin, website: Globe, linkedin: Link2, github: Code };

export default function CoverLetterPanel({ resume, coverLetter, personal, settings, template, updateCoverLetter }) {
  const [generatorOpen, setGeneratorOpen] = useState(false);
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
    const resume = { personal, settings, template, coverLetter: cl };
    readImageFile(file, { kind: 'photo', resume, replacing: cl.clPhoto }).then(dataUrl => updateCoverLetter('clPhoto', dataUrl), err => alert(err.message));
  }

  // Whether the letter prints a photo, and the line saying which one, or why none (R7-7).
  const { hasPhoto, note: photoNote } = useLetterPhoto(cl, personal);
  const photoShown = cl.showPhoto !== false;

  function handleApplyGenerated(gen) {
    if (!gen) return;
    if (gen.recipientName) updateCoverLetter('recipientName', gen.recipientName);
    if (gen.recipientTitle) updateCoverLetter('recipientTitle', gen.recipientTitle);
    if (gen.company) updateCoverLetter('company', gen.company);
    if (gen.subject) updateCoverLetter('subject', gen.subject);
    if (gen.body) updateCoverLetter('body', gen.body);
    if (gen.closing) updateCoverLetter('closing', gen.closing);
    if (gen.signatureName) updateCoverLetter('signatureName', gen.signatureName);
    if (gen.signatureDesignation) updateCoverLetter('signatureDesignation', gen.signatureDesignation);
  }

  const effectiveResume = resume || { personal, settings, template, coverLetter: cl };

  return (
    <div className="space-y-4 py-2">

      <CoverLetterGeneratorModal
        isOpen={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        resume={effectiveResume}
        onApply={handleApplyGenerated}
      />

      <p className="flex items-start gap-1.5 text-[11px] text-gray-500 leading-snug">
        <Palette size={12} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
        <span>Header style follows your résumé template (<strong>{templateLabel(template)}</strong>). Change the template in Design.</span>
      </p>

      {/* ── Photo ─────────────────────────────────────────────────────────── */}
      <SectionBlock title="Photo" defaultOpen={true}>
        <div className="flex items-center gap-3">
          {/* Preview / upload target */}
          <div
            onClick={() => photoInputRef.current?.click()}
            className="w-14 h-14 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors overflow-hidden shrink-0"
          >
            {cl.clPhoto ? (
              <img src={cl.clPhoto} alt="" className="w-full h-full object-cover" />
            ) : personal?.photo ? (
              <img src={personal.photo} alt="" className="w-full h-full object-cover opacity-50" />
            ) : (
              <div className="flex flex-col items-center gap-0.5 text-gray-400">
                <Camera size={16} />
                <span className="text-[9px]">Photo</span>
              </div>
            )}
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700">Cover Letter Photo</p>
            <p className={`text-[11px] mt-0.5 ${photoNote.warn ? 'text-amber-700' : 'text-gray-400'}`} data-testid="letter-photo-note">
              {photoNote.text}
            </p>
            <div className="flex gap-2 mt-1.5">
              {cl.clPhoto && (
                <button
                  onClick={() => updateCoverLetter('clPhoto', null)}
                  className="text-[11px] text-red-500 hover:text-red-600"
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
              className={`p-1.5 rounded transition-colors ${photoShown ? 'text-blue-500 hover:text-blue-600' : 'text-gray-300 hover:text-gray-400'}`}
              title={photoShown ? 'Hide photo from cover letter' : 'Show photo on cover letter'}
            >
              {photoShown ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          )}
        </div>

        {/* Photo text position — only when photo is shown, beside the name */}
        {photoShown && hasPhoto && centered && (
          <p className="text-[11px] text-gray-400">Centred header: the photo sits above the name.</p>
        )}
        {photoShown && hasPhoto && !centered && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Text Position (relative to photo)</p>
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
          <p className="text-[11px] text-gray-500 leading-snug">
            Centred like your résumé&apos;s header: photo, name and contacts on the centre line
            (Personal Info → Header Customization → Text Alignment).
          </p>
        ) : (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Fields Position</p>
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
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className={`text-[10px] mt-0.5 font-mono ${fieldsPosition === val ? 'text-blue-100' : 'text-gray-400'}`}>{desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Contact Style */}
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">Contact Style</p>
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
          <p className="text-xs font-semibold text-gray-700 mb-2">Contact Layout</p>
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
          <p className="text-xs font-semibold text-gray-700 mb-2">Visible Contact Fields</p>
          <div className="space-y-1.5">
            {CONTACT_FIELDS.map(({ key, label }) => {
              const Icon = ICONS[key];
              const val = personal?.[key];
              const isHidden = hiddenSet.has(key);
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className={`text-xs flex items-center gap-1.5 ${isHidden ? 'text-gray-400' : 'text-gray-700'}`}>
                    <Icon size={12} className="text-gray-400" />
                    {label}
                    {val && <span className="text-gray-400 font-normal truncate max-w-[100px]">— {val}</span>}
                  </span>
                  <button
                    onClick={() => toggleField(key)}
                    title={isHidden ? `Show ${label} on the cover letter` : `Hide ${label} from the cover letter`}
                    className={`p-0.5 rounded transition-colors ${isHidden ? 'text-gray-300 hover:text-gray-400' : 'text-blue-500 hover:text-blue-600'}`}
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
              className="absolute right-1.5 bottom-1.5 px-1.5 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 rounded"
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
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Letter Body</p>
          <button
            type="button"
            onClick={() => setGeneratorOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors shadow-xs"
          >
            <Sparkles size={13} className="text-blue-600" />
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
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Closing & Signature</p>
        <div className="space-y-2.5">
          <Field label="Closing Phrase" placeholder="Sincerely" {...f('closing')} />
          <div>
            <p className="block text-xs font-medium text-gray-500 mb-1">Signature Space</p>
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
