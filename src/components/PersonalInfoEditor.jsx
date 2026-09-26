import { useState, useId } from 'react';
import { User, Mail, Phone, MapPin, Globe, Link, Code, FileText, Eye, EyeOff, ImagePlus, X, Sparkles } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import HeaderIconPickerModal from '@/components/HeaderIconPickerModal';
import { HeaderCustomization } from '@/components/PersonalInfoEditorHeader';
import { PhotoSection } from '@/components/PersonalInfoEditorPhoto';
import { ContactIcon } from '@/utils/contactIcons';
import { isContactIconImage } from '@/utils/contactIconPaths';
import { readImageFile } from '@/utils/imageUpload';
import { usePrintableImage, UNPRINTABLE_ICON } from '@/hooks/usePrintableImage';
import { anyDrawsContactIcons, drawsContactIcons, templateLabel as getTemplateLabel } from '@/constants/templates';
import { CONTACT_FIELDS } from '@/utils/contacts';

/** This editor's lucide icon and placeholder per contact field; the names come from CONTACT_FIELDS. */
const CONTACT_INPUTS = {
  email:    { icon: Mail,   placeholder: 'john@email.com' },
  phone:    { icon: Phone,  placeholder: '+1 (555) 000-0000' },
  location: { icon: MapPin, placeholder: 'City, State' },
  website:  { icon: Globe,  placeholder: 'yoursite.com' },
  linkedin: { icon: Link,   placeholder: 'linkedin.com/in/you' },
  github:   { icon: Code,   placeholder: 'github.com/you' },
};

// Name and title first — always printed — then the contact fields in the order every export
// prints them; a link field also offers a display label and a link URL.
const FIELDS = [
  { key: 'name',  label: 'Full Name', icon: User,     placeholder: 'John Doe',            required: true },
  { key: 'title', label: 'Job Title', icon: FileText, placeholder: 'Software Engineer',   required: true },
  ...CONTACT_FIELDS.map(({ key, label, link }) => ({ key, label, ...CONTACT_INPUTS[key], hasUrl: !!link, contactIcon: true })),
];

function CustomIconControl({ fieldKey, iconLabel, customIcon, s, onPickIconFile, setCustomIcon, onOpenPicker }) {
  const isImage = isContactIconImage(customIcon);
  const printable = usePrintableImage(isImage ? customIcon : null, { kind: 'icon' });
  const unprintable = isImage && printable === null;
  return (
    <div>
      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-gray-400 shrink-0">{iconLabel}</span>
        <button
          type="button"
          onClick={() => onOpenPicker?.(fieldKey)}
          title="Click to choose icon"
          className="flex items-center gap-1.5 px-1.5 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-blue-50/50 hover:border-blue-300 transition-colors cursor-pointer"
        >
          <ContactIcon field={fieldKey} settings={s} size={14} className="text-gray-600" />
        </button>
        <button
          type="button"
          onClick={() => onOpenPicker?.(fieldKey)}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
          title="Select from header icon library"
        >
          <Sparkles size={11} className="text-blue-600" />
          Choose Icon
        </button>
        <label className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
          <ImagePlus size={11} />
          {customIcon ? 'Replace' : 'Upload'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) onPickIconFile(fieldKey, f);
              e.target.value = '';
            }}
          />
        </label>
        {customIcon && (
          <button
            type="button"
            onClick={() => setCustomIcon(fieldKey, null)}
            className="inline-flex items-center gap-0.5 px-1.5 py-1 text-[10px] text-red-500 hover:bg-red-50 rounded cursor-pointer"
            title="Remove custom icon"
          >
            <X size={11} /> Clear
          </button>
        )}
      </div>
      {unprintable && (
        <p className="text-[11px] text-amber-700 mt-1" data-testid="icon-unprintable">
          {UNPRINTABLE_ICON}
        </p>
      )}
    </div>
  );
}

export default function PersonalInfoEditor({ resume: whole, personal, updatePersonal, toggleFieldVisibility, settings, updateSetting, clearSettings, template, coverLetter }) {
  const hidden = new Set(personal.hiddenFields || []);
  const s = settings || {};
  // Where a field's icon prints: the résumé, or only the cover letter, whose own Contact Style
  // "Icon" draws them under a Bar or Bullet résumé (R9-5). The upload is offered either way,
  // named for where it prints; null when nothing draws icons (ONB-8).
  const iconLabel = !anyDrawsContactIcons(template, s, coverLetter) ? null
    : drawsContactIcons(template, s) ? 'Resume icon' : 'Cover letter icon';
  const [headerOpen, setHeaderOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [pickerField, setPickerField] = useState(null);
  const activePickerField = FIELDS.find(f => f.key === pickerField);
  const uid = useId();
  const templateLabel = getTemplateLabel(template);

  function set(key, val) { updateSetting?.(key, val); }

  function setCustomIcon(field, dataUrl) {
    const prev = s.customContactIcons || {};
    if (!dataUrl) {
      const next = { ...prev };
      delete next[field];
      set('customContactIcons', next);
      return;
    }
    set('customContactIcons', { ...prev, [field]: dataUrl });
  }

  function onPickIconFile(field, file) {
    if (!file) return;
    // A file that is not an image (a PDF picked under "All files") is refused by readImageFile with
    // its message, as the photo upload is: returning here did nothing, and said nothing (R4-DUX-29).
    const prev = s.customContactIcons || {};
    // The whole résumé, sections and all: an upload may take only what its cloud document has left (R2-097).
    const resume = { ...whole, personal, settings: s, template, coverLetter };
    readImageFile(file, { kind: 'icon', resume, replacing: prev[field] }).then(dataUrl => setCustomIcon(field, dataUrl), err => alert(err.message));
  }

  return (
    <div className="space-y-5">

      <HeaderCustomization
        s={s}
        set={set}
        clear={(keys) => clearSettings?.(keys)}
        personal={personal}
        template={template}
        templateLabel={templateLabel}
        open={headerOpen}
        onToggle={() => setHeaderOpen(o => !o)}
      />

      <PhotoSection
        resume={whole}
        personal={personal}
        updatePersonal={updatePersonal}
        toggleFieldVisibility={toggleFieldVisibility}
        hidden={hidden}
        s={s}
        set={set}
        template={template}
        coverLetter={coverLetter}
        open={photoOpen}
        onToggle={() => setPhotoOpen(o => !o)}
      />

      <div>
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">Fields</p>
        <p className="text-[11px] text-gray-400 mb-3">Toggle eye icon to show/hide on resume</p>
        <div className="space-y-2.5">
          {FIELDS.map(({ key, label, icon: Icon, placeholder, required, hasUrl, contactIcon }) => {
            const isHidden = hidden.has(key);
            const urlKey = key + 'Url';
            const labelKey = key + 'Label';
            const hasValue = !!personal[key];
            const customIcon = s.customContactIcons?.[key];
            const showIconControls = !!(contactIcon && iconLabel);
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor={uid + key} className="text-xs font-medium text-gray-500 flex items-center gap-1">
                    <Icon size={13} className="text-gray-400" />
                    {label}
                  </label>
                  {!required && (
                    <button
                      onClick={() => toggleFieldVisibility(key)}
                      className={`p-0.5 rounded transition-colors ${isHidden ? 'text-gray-300 hover:text-gray-400' : 'text-blue-500 hover:text-blue-600'}`}
                      title={isHidden ? 'Show on resume' : 'Hide on resume'}
                    >
                      {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  )}
                </div>
                <input
                  id={uid + key}
                  type="text"
                  value={personal[key] || ''}
                  onChange={e => updatePersonal(key, e.target.value)}
                  placeholder={placeholder}
                  className={`w-full px-2.5 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${isHidden ? 'border-gray-100 bg-gray-50 text-gray-400' : 'border-gray-200 bg-white'}`}
                />
                {hasUrl && hasValue && (
                  <div className="mt-1 flex flex-col sm:flex-row gap-1.5">
                    <input type="text" aria-label={`${label} display label`} value={personal[labelKey] || ''} onChange={e => updatePersonal(labelKey, e.target.value)} placeholder="Display label (optional)" className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50 text-gray-600 placeholder-gray-300" />
                    <input type="text" aria-label={`${label} link URL`} value={personal[urlKey] || ''} onChange={e => updatePersonal(urlKey, e.target.value)} placeholder="Link URL (e.g. https://...)" className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50 text-gray-600 placeholder-gray-300" />
                  </div>
                )}
                {showIconControls && (
                  <CustomIconControl
                    fieldKey={key}
                    iconLabel={iconLabel}
                    customIcon={customIcon}
                    s={s}
                    onPickIconFile={onPickIconFile}
                    setCustomIcon={setCustomIcon}
                    onOpenPicker={setPickerField}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Professional Summary</p>
          <button
            onClick={() => toggleFieldVisibility('summary')}
            className={`p-0.5 rounded transition-colors ${hidden.has('summary') ? 'text-gray-300 hover:text-gray-400' : 'text-blue-500 hover:text-blue-600'}`}
            title={hidden.has('summary') ? 'Show summary on resume' : 'Hide summary from resume'}
          >
            {hidden.has('summary') ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        </div>
        <RichTextEditor ariaLabel="Professional summary" value={personal.summary || ''} onChange={v => updatePersonal('summary', v)} placeholder="Brief professional summary highlighting your experience, skills, and goals..." rows={4} />
      </div>

      {/* Keyed by the field: each open starts on Recommended with an empty search, not on the last
          field's (it stays mounted while closed). */}
      <HeaderIconPickerModal
        key={pickerField || ''}
        isOpen={Boolean(pickerField)}
        onClose={() => setPickerField(null)}
        fieldKey={pickerField}
        fieldLabel={activePickerField?.label}
        currentCustomIcon={pickerField ? s.customContactIcons?.[pickerField] : null}
        settings={s}
        onSelectIcon={iconId => setCustomIcon(pickerField, iconId)}
        onPickIconFile={file => onPickIconFile(pickerField, file)}
        onClearIcon={() => setCustomIcon(pickerField, null)}
      />
    </div>
  );
}
