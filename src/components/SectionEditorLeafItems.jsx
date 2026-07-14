import { Eye, EyeOff, Trash2 } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import { InputField, MonthPicker, FieldRow, ItemCard } from '@/components/SectionEditorShared';

export function SkillItem({ item, onUpdate, onRemove }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  const itemHidden = new Set(item.hiddenFields || []);
  function toggleField(f) {
    const cur = item.hiddenFields || [];
    onUpdate({ ...item, hiddenFields: itemHidden.has(f) ? cur.filter(x => x !== f) : [...cur, f] });
  }
  return (
    <ItemCard label={item.category || 'Skill Group'} onRemove={onRemove} visible={visible} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <FieldRow label="Title / Category" field="category" hiddenSet={itemHidden} onToggle={toggleField}>
        <InputField value={item.category} onChange={v => u('category', v)} placeholder="e.g. Frontend Development" />
      </FieldRow>
      <FieldRow label="Skills / Details" field="skills" hiddenSet={itemHidden} onToggle={toggleField}>
        <InputField value={item.skills} onChange={v => u('skills', v)} placeholder="JavaScript, React, TypeScript, Next.js" />
      </FieldRow>
    </ItemCard>
  );
}

export function LanguageItem({ item, onUpdate, onRemove }) {
  const visible = item.visible !== false;
  return (
    <div className={`flex gap-2 items-center ${visible ? '' : 'opacity-50'}`}>
      <div className="flex-1 grid grid-cols-[2fr_3fr] gap-2">
        <input
          type="text"
          value={item.language || ''}
          onChange={e => onUpdate({ ...item, language: e.target.value })}
          placeholder="Language"
          className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={item.proficiency || 'Professional'}
          onChange={e => onUpdate({ ...item, proficiency: e.target.value })}
          className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic'].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <button
        onClick={() => onUpdate({ ...item, visible: !visible })}
        className={`p-1.5 shrink-0 ${visible ? 'text-blue-500 hover:text-blue-700' : 'text-gray-400 hover:text-gray-500'}`}
        title={visible ? 'Hide entry' : 'Show entry'}
      >
        {visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
      <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-500 shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

export function CertificationItem({ item, onUpdate, onRemove }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  return (
    <ItemCard label={item.name} onRemove={onRemove} visible={visible} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <InputField label="Certification Name" value={item.name} onChange={v => u('name', v)} placeholder="AWS Certified Developer" />
      <InputField label="Issuing Organization" value={item.issuer} onChange={v => u('issuer', v)} placeholder="Amazon Web Services" />
      <div className="grid grid-cols-2 gap-2">
        <MonthPicker label="Issue Date" value={item.date} onChange={v => u('date', v)} />
        <MonthPicker label="Expiry Date" value={item.expiry} onChange={v => u('expiry', v)} />
      </div>
      <InputField label="Credential ID (optional)" value={item.credentialId} onChange={v => u('credentialId', v)} placeholder="ABC-12345" />
      <InputField label="Link URL (optional)" value={item.url} onChange={v => u('url', v)} placeholder="https://credential.example.com" />
      {item.url && (
        <InputField label="Link label (optional)" value={item.urlLabel || ''} onChange={v => u('urlLabel', v)} placeholder="View Certificate" />
      )}
    </ItemCard>
  );
}

export function AwardItem({ item, onUpdate, onRemove }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  return (
    <ItemCard label={item.title} onRemove={onRemove} visible={visible} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <InputField label="Award Title" value={item.title} onChange={v => u('title', v)} placeholder="Dean's List Award" />
      <InputField label="Issuing Organization" value={item.issuer} onChange={v => u('issuer', v)} placeholder="University of California" />
      <MonthPicker label="Date" value={item.date} onChange={v => u('date', v)} />
      <RichTextEditor key={item.id + '_desc'} label="Description (optional)" value={item.description} onChange={v => u('description', v)} placeholder="Brief description of the award..." rows={2} />
    </ItemCard>
  );
}

export function ReferenceItem({ item, onUpdate, onRemove }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  return (
    <ItemCard label={item.name} onRemove={onRemove} visible={visible} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <InputField label="Name" value={item.name} onChange={v => u('name', v)} placeholder="Jane Smith" />
      <InputField label="Job Title" value={item.jobTitle} onChange={v => u('jobTitle', v)} placeholder="Engineering Manager" />
      <InputField label="Company" value={item.company} onChange={v => u('company', v)} placeholder="Acme Corp" />
      <InputField label="Relationship" value={item.relationship} onChange={v => u('relationship', v)} placeholder="Former Manager" />
      <div className="grid grid-cols-2 gap-2">
        <InputField label="Email" value={item.email} onChange={v => u('email', v)} placeholder="jane@acme.com" />
        <InputField label="Phone" value={item.phone} onChange={v => u('phone', v)} placeholder="+1 555-0000" />
      </div>
    </ItemCard>
  );
}

export function InterestItem({ item, onUpdate, onRemove }) {
  const visible = item.visible !== false;
  return (
    <div className={`flex gap-2 items-center ${visible ? '' : 'opacity-50'}`}>
      <input
        type="text"
        value={item.interests || ''}
        onChange={e => onUpdate({ ...item, interests: e.target.value })}
        placeholder="e.g. Photography, Hiking, Open Source"
        className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        onClick={() => onUpdate({ ...item, visible: !visible })}
        className={`p-1.5 shrink-0 ${visible ? 'text-blue-500 hover:text-blue-700' : 'text-gray-400 hover:text-gray-500'}`}
        title={visible ? 'Hide entry' : 'Show entry'}
      >
        {visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
      <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-500 shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

export const NEW_ITEM = {
  experience:     () => ({ id: `exp_${Date.now()}`,   company: '', role: '', location: '', startDate: '', endDate: '', current: false, description: '', bullets: [] }),
  education:      () => ({ id: `edu_${Date.now()}`,   institution: '', degree: '', fieldOfStudy: '', location: '', startDate: '', endDate: '', gpa: '', description: '', bullets: [] }),
  skills:         () => ({ id: `sk_${Date.now()}`,    category: '', skills: '' }),
  projects:       () => ({ id: `proj_${Date.now()}`,  name: '', url: '', technologies: '', startDate: '', endDate: '', description: '', bullets: [] }),
  languages:      () => ({ id: `lang_${Date.now()}`,  language: '', proficiency: 'Professional' }),
  certifications: () => ({ id: `cert_${Date.now()}`,  name: '', issuer: '', date: '', expiry: '', credentialId: '', url: '' }),
  awards:         () => ({ id: `awd_${Date.now()}`,   title: '', issuer: '', date: '', description: '' }),
  volunteering:   () => ({ id: `vol_${Date.now()}`,   org: '', role: '', location: '', startDate: '', endDate: '', description: '', bullets: [] }),
  references:     () => ({ id: `ref_${Date.now()}`,   name: '', jobTitle: '', company: '', relationship: '', email: '', phone: '' }),
  interests:      () => ({ id: `int_${Date.now()}`,   interests: '' }),
  custom:         () => ({ id: `cust_${Date.now()}`,  title: '', subtitle: '', date: '', location: '', description: '', bullets: [] }),
};

export const ADD_LABEL = {
  experience: 'Add Experience', education: 'Add Education', skills: 'Add Skill Group',
  projects: 'Add Project', languages: 'Add Language', certifications: 'Add Certification',
  awards: 'Add Award', volunteering: 'Add Volunteering', references: 'Add Reference',
  interests: 'Add Interest', custom: 'Add Entry',
};
