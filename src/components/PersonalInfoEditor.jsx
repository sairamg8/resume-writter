import { useState } from 'react';
import { User, Mail, Phone, MapPin, Globe, Link, Code, FileText, Eye, EyeOff } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import { HeaderCustomization } from '@/components/PersonalInfoEditorHeader';
import { PhotoSection } from '@/components/PersonalInfoEditorPhoto';

const FIELDS = [
  { key: 'name',     label: 'Full Name',  icon: User,     placeholder: 'John Doe',            required: true },
  { key: 'title',    label: 'Job Title',  icon: FileText, placeholder: 'Software Engineer',    required: true },
  { key: 'email',    label: 'Email',      icon: Mail,     placeholder: 'john@email.com' },
  { key: 'phone',    label: 'Phone',      icon: Phone,    placeholder: '+1 (555) 000-0000' },
  { key: 'location', label: 'Location',   icon: MapPin,   placeholder: 'City, State' },
  { key: 'website',  label: 'Website',    icon: Globe,    placeholder: 'yoursite.com', hasUrl: true },
  { key: 'linkedin', label: 'LinkedIn',   icon: Link,     placeholder: 'linkedin.com/in/you', hasUrl: true },
  { key: 'github',   label: 'GitHub',     icon: Code,     placeholder: 'github.com/you', hasUrl: true },
];

export default function PersonalInfoEditor({ personal, updatePersonal, toggleFieldVisibility, settings, updateSetting, template }) {
  const hidden = new Set(personal.hiddenFields || []);
  const s = settings || {};
  const [headerOpen, setHeaderOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const isClassicOrMinimal = !template || template === 'classic' || template === 'minimal';
  const templateLabel = template ? template.charAt(0).toUpperCase() + template.slice(1) : 'Classic';

  function set(key, val) { updateSetting?.(key, val); }

  return (
    <div className="space-y-5">

      <HeaderCustomization
        s={s}
        set={set}
        isClassicOrMinimal={isClassicOrMinimal}
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
        open={photoOpen}
        onToggle={() => setPhotoOpen(o => !o)}
      />

      <div>
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">Fields</p>
        <p className="text-[11px] text-gray-400 mb-3">Toggle eye icon to show/hide on resume</p>
        <div className="space-y-2.5">
          {FIELDS.map(({ key, label, icon: Icon, placeholder, required, hasUrl }) => {
            const isHidden = hidden.has(key);
            const urlKey = key + 'Url';
            const labelKey = key + 'Label';
            const hasValue = !!personal[key];
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
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
                  type="text"
                  value={personal[key] || ''}
                  onChange={e => updatePersonal(key, e.target.value)}
                  placeholder={placeholder}
                  className={`w-full px-2.5 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${isHidden ? 'border-gray-100 bg-gray-50 text-gray-400' : 'border-gray-200 bg-white'}`}
                />
                {hasUrl && hasValue && (
                  <div className="mt-1 flex gap-1.5">
                    <input type="text" value={personal[labelKey] || ''} onChange={e => updatePersonal(labelKey, e.target.value)} placeholder="Display label (optional)" className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50 text-gray-600 placeholder-gray-300" />
                    <input type="text" value={personal[urlKey] || ''} onChange={e => updatePersonal(urlKey, e.target.value)} placeholder="Link URL (e.g. https://...)" className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50 text-gray-600 placeholder-gray-300" />
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
        <RichTextEditor label="" value={personal.summary || ''} onChange={v => updatePersonal('summary', v)} placeholder="Brief professional summary highlighting your experience, skills, and goals..." rows={4} />
      </div>
    </div>
  );
}
