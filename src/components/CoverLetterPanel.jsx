import { useRef, useState } from 'react';
import { Mail, Phone, MapPin, Globe, Link2, Code, Eye, EyeOff, ChevronDown, ChevronUp, Camera } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';

const CONTACT_FIELDS = [
  { key: 'email',    label: 'Email',    Icon: Mail   },
  { key: 'phone',    label: 'Phone',    Icon: Phone  },
  { key: 'location', label: 'Location', Icon: MapPin },
  { key: 'website',  label: 'Website',  Icon: Globe  },
  { key: 'linkedin', label: 'LinkedIn', Icon: Link2  },
  { key: 'github',   label: 'GitHub',   Icon: Code   },
];

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-1.5 text-xs font-medium rounded border transition-all ${
        active
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
      }`}
    >
      {children}
    </button>
  );
}

function SectionBlock({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 text-left select-none"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm font-semibold text-gray-700 flex-1">{title}</span>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && (
        <div className="p-4 border-t border-gray-100 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function CoverLetterPanel({ coverLetter, personal, updateCoverLetter }) {
  const cl = coverLetter || {};
  const photoInputRef = useRef(null);

  function f(key) {
    return { value: cl[key], onChange: v => updateCoverLetter(key, v) };
  }

  // Cover letter uses its own hidden fields — independent from resume
  const hiddenFields = cl.hiddenFields ?? [];
  const hiddenSet = new Set(hiddenFields);

  function toggleField(key) {
    const next = hiddenSet.has(key)
      ? hiddenFields.filter(k => k !== key)
      : [...hiddenFields, key];
    updateCoverLetter('hiddenFields', next);
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => updateCoverLetter('clPhoto', ev.target.result);
    reader.readAsDataURL(file);
  }

  const hasPhoto = !!cl.clPhoto || !!personal?.photo;
  const photoShown = cl.showPhoto !== false;

  return (
    <div className="space-y-4 py-2">

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
            <p className="text-[11px] text-gray-400 mt-0.5">
              {cl.clPhoto ? 'Using own photo' : personal?.photo ? 'Using resume photo (faded = preview)' : 'No photo — upload or add to resume'}
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

        {/* Photo text position — only when photo is shown */}
        {photoShown && hasPhoto && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Text Position (relative to photo)</p>
            <div className="flex gap-2">
              {[
                { val: 'top',    label: '↑ Top'    },
                { val: 'center', label: '↕ Center' },
                { val: 'bottom', label: '↓ Bottom' },
              ].map(({ val, label }) => (
                <Chip key={val} active={(cl.photoTextAlign || 'center') === val} onClick={() => updateCoverLetter('photoTextAlign', val)}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </SectionBlock>

      {/* ── Header Layout ─────────────────────────────────────────────────── */}
      <SectionBlock title="Header Layout" defaultOpen={true}>
        {/* Fields position — 3 clear layout options */}
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
                  (cl.fieldsPosition || 'right') === val
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                <div className="font-medium">{label}</div>
                <div className={`text-[10px] mt-0.5 font-mono ${(cl.fieldsPosition || 'right') === val ? 'text-blue-100' : 'text-gray-400'}`}>{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Contact Style */}
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">Contact Style</p>
          <div className="flex gap-2">
            {[
              { val: 'icon',   label: '⊕ Icon' },
              { val: 'bullet', label: '• Bullet' },
              { val: 'bar',    label: '| Bar' },
            ].map(({ val, label }) => (
              <Chip key={val} active={(cl.headerStyle || 'bar') === val} onClick={() => updateCoverLetter('headerStyle', val)}>
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
              <Chip key={val} active={(cl.headerLayout || 'justify') === val} onClick={() => updateCoverLetter('headerLayout', val)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Field Visibility */}
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">Visible Contact Fields</p>
          <div className="space-y-1.5">
            {CONTACT_FIELDS.map(({ key, label, Icon }) => {
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

      {/* ── Letter Body ───────────────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Letter Body</p>
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Signature Space</label>
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
