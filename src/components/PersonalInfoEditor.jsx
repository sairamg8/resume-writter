import { useState, useId } from 'react';
import { User, Mail, Phone, MapPin, Globe, Link, Code, FileText, Eye, EyeOff, ImagePlus, X } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import { HeaderCustomization } from '@/components/PersonalInfoEditorHeader';
import { PhotoSection } from '@/components/PersonalInfoEditorPhoto';
import { ContactIcon } from '@/utils/contactIcons';
import { readImageFile } from '@/utils/imageUpload';
import { drawsContactIcons } from '@/constants/templates';

const FIELDS = [
  { key: 'name',     label: 'Full Name',  icon: User,     placeholder: 'John Doe',            required: true },
  { key: 'title',    label: 'Job Title',  icon: FileText, placeholder: 'Software Engineer',    required: true },
  { key: 'email',    label: 'Email',      icon: Mail,     placeholder: 'john@email.com',      contactIcon: true },
  { key: 'phone',    label: 'Phone',      icon: Phone,    placeholder: '+1 (555) 000-0000',   contactIcon: true },
  { key: 'location', label: 'Location',   icon: MapPin,   placeholder: 'City, State',         contactIcon: true },
  { key: 'website',  label: 'Website',    icon: Globe,    placeholder: 'yoursite.com', hasUrl: true, contactIcon: true },
  { key: 'linkedin', label: 'LinkedIn',   icon: Link,     placeholder: 'linkedin.com/in/you', hasUrl: true, contactIcon: true },
  { key: 'github',   label: 'GitHub',     icon: Code,     placeholder: 'github.com/you', hasUrl: true, contactIcon: true },
];

export default function PersonalInfoEditor({ personal, updatePersonal, toggleFieldVisibility, settings, updateSetting, template }) {
  const hidden = new Set(personal.hiddenFields || []);
  const s = settings || {};
  const [headerOpen, setHeaderOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const uid = useId();
  const templateLabel = template ? template.charAt(0).toUpperCase() + template.slice(1) : 'Classic';

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
    if (!file || !file.type.startsWith('image/')) return;
    // The 400 KB limit is readImageFile's, on the icon as stored: a big BMP or WebP converts to a
    // few KB, so the upload's own size decides nothing (R7-15).
    readImageFile(file, { kind: 'icon' }).then(dataUrl => setCustomIcon(field, dataUrl), err => alert(err.message));
  }

  return (
    <div className="space-y-5">

      <HeaderCustomization
        s={s}
        set={set}
        template={template}
        templateLabel={templateLabel}
        open={headerOpen}
        onToggle={() => setHeaderOpen(o => !o)}
      />

      <PhotoSection
        personal={personal}
        updatePersonal={updatePersonal}
        toggleFieldVisibility={toggleFieldVisibility}
        hidden={hidden}
        s={s}
        set={set}
        template={template}
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
            const showIconControls = contactIcon && drawsContactIcons(template, s);
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
                  <div className="mt-1 flex gap-1.5">
                    <input type="text" aria-label={`${label} display label`} value={personal[labelKey] || ''} onChange={e => updatePersonal(labelKey, e.target.value)} placeholder="Display label (optional)" className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50 text-gray-600 placeholder-gray-300" />
                    <input type="text" aria-label={`${label} link URL`} value={personal[urlKey] || ''} onChange={e => updatePersonal(urlKey, e.target.value)} placeholder="Link URL (e.g. https://...)" className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50 text-gray-600 placeholder-gray-300" />
                  </div>
                )}
                {showIconControls && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 shrink-0">Resume icon</span>
                    <div className="flex items-center gap-1.5 px-1.5 py-1 rounded border border-gray-200 bg-gray-50">
                      <ContactIcon field={key} settings={s} size={14} className="text-gray-600" />
                    </div>
                    <label className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                      <ImagePlus size={11} />
                      {customIcon ? 'Replace' : 'Upload'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) onPickIconFile(key, f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {customIcon && (
                      <button
                        type="button"
                        onClick={() => setCustomIcon(key, null)}
                        className="inline-flex items-center gap-0.5 px-1.5 py-1 text-[10px] text-red-500 hover:bg-red-50 rounded"
                        title="Remove custom icon"
                      >
                        <X size={11} /> Clear
                      </button>
                    )}
                  </div>
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
    </div>
  );
}
