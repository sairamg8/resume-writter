import { Copy, Eye, EyeOff, Trash2 } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import { newId } from '@/utils/ids';
import { InputField, MonthPicker, FieldRow, ItemCard } from '@/components/SectionEditorShared';

export function SkillItem({ item, onUpdate, onRemove, onDuplicate, defaultOpen }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  const itemHidden = new Set(item.hiddenFields || []);
  function toggleField(f) {
    const cur = item.hiddenFields || [];
    onUpdate({ ...item, hiddenFields: itemHidden.has(f) ? cur.filter(x => x !== f) : [...cur, f] });
  }
  return (
    <ItemCard label={item.category || 'Skill Group'} onRemove={onRemove} onDuplicate={onDuplicate} visible={visible} defaultOpen={defaultOpen} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <FieldRow label="Title / Category" field="category" hiddenSet={itemHidden} onToggle={toggleField}>
        <InputField value={item.category} onChange={v => u('category', v)} placeholder="e.g. Frontend Development" />
      </FieldRow>
      <FieldRow label="Skills / Details" field="skills" hiddenSet={itemHidden} onToggle={toggleField}>
        <InputField value={item.skills} onChange={v => u('skills', v)} placeholder="JavaScript, React, TypeScript, Next.js" />
      </FieldRow>
    </ItemCard>
  );
}

/**
 * The Duplicate button of a one-line row (a language, an interest), which has no card header to
 * hold ItemCard's: the same button, beside the row's own show/hide and delete (R2-151).
 */
function RowDuplicate({ onDuplicate }) {
  if (!onDuplicate) return null;
  return (
    <button onClick={onDuplicate} title="Duplicate entry" aria-label="Duplicate entry" className="p-1.5 text-gray-400 hover:text-blue-600 shrink-0">
      <Copy size={13} />
    </button>
  );
}

const PROFICIENCIES = ['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic'];

export function LanguageItem({ item, onUpdate, onRemove, onDuplicate }) {
  const visible = item.visible !== false;
  // The select shows exactly what the résumé prints. A starter, an import or a hand-written file can
  // store a level the list does not name ('Conversational', 'C1') or none at all (''); with no option
  // of that value the browser showed the first one instead, and picking the level already on screen
  // fired no change, so it could not be chosen. An unset level is its own option, and an unusual one
  // is added to the list, as the date pickers do for an unusual year.
  const proficiency = item.proficiency == null ? '' : String(item.proficiency);
  return (
    <div className={`flex gap-2 items-center ${visible ? '' : 'opacity-50'}`}>
      <div className="flex-1 grid grid-cols-[2fr_3fr] gap-2">
        <input
          type="text"
          aria-label="Language"
          value={item.language || ''}
          onChange={e => onUpdate({ ...item, language: e.target.value })}
          placeholder="Language"
          className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          aria-label="Proficiency"
          value={proficiency}
          onChange={e => onUpdate({ ...item, proficiency: e.target.value })}
          className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Not set</option>
          {PROFICIENCIES.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
          {proficiency && !PROFICIENCIES.includes(proficiency) && (
            <option value={proficiency}>{proficiency}</option>
          )}
        </select>
      </div>
      <button
        onClick={() => onUpdate({ ...item, visible: !visible })}
        className={`p-1.5 shrink-0 ${visible ? 'text-blue-500 hover:text-blue-700' : 'text-gray-400 hover:text-gray-500'}`}
        title={visible ? 'Hide entry' : 'Show entry'}
      >
        {visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
      <RowDuplicate onDuplicate={onDuplicate} />
      <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-500 shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

export function CertificationItem({ item, onUpdate, onRemove, onDuplicate, defaultOpen }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  return (
    <ItemCard label={item.name} onRemove={onRemove} onDuplicate={onDuplicate} visible={visible} defaultOpen={defaultOpen} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
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

export function AwardItem({ item, onUpdate, onRemove, onDuplicate, defaultOpen }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  return (
    <ItemCard label={item.title} onRemove={onRemove} onDuplicate={onDuplicate} visible={visible} defaultOpen={defaultOpen} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <InputField label="Award Title" value={item.title} onChange={v => u('title', v)} placeholder="Dean's List Award" />
      <InputField label="Issuing Organization" value={item.issuer} onChange={v => u('issuer', v)} placeholder="University of California" />
      <MonthPicker label="Date" value={item.date} onChange={v => u('date', v)} />
      <RichTextEditor key={item.id + '_desc'} label="Description (optional)" value={item.description} onChange={v => u('description', v)} placeholder="Brief description of the award..." rows={2} />
    </ItemCard>
  );
}

export function ReferenceItem({ item, onUpdate, onRemove, onDuplicate, defaultOpen }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  return (
    <ItemCard label={item.name} onRemove={onRemove} onDuplicate={onDuplicate} visible={visible} defaultOpen={defaultOpen} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
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

export function InterestItem({ item, onUpdate, onRemove, onDuplicate }) {
  const visible = item.visible !== false;
  return (
    <div className={`flex gap-2 items-center ${visible ? '' : 'opacity-50'}`}>
      <input
        type="text"
        aria-label="Interests"
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
      <RowDuplicate onDuplicate={onDuplicate} />
      <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-500 shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

export const NEW_ITEM = {
  experience:     () => ({ id: newId('exp'),  company: '', role: '', location: '', startDate: '', endDate: '', current: false, description: '', bullets: [] }),
  education:      () => ({ id: newId('edu'),  institution: '', degree: '', fieldOfStudy: '', location: '', startDate: '', endDate: '', gpa: '', description: '', bullets: [] }),
  skills:         () => ({ id: newId('sk'),   category: '', skills: '' }),
  projects:       () => ({ id: newId('proj'), name: '', url: '', technologies: '', startDate: '', endDate: '', description: '', bullets: [] }),
  languages:      () => ({ id: newId('lang'), language: '', proficiency: 'Professional' }),
  certifications: () => ({ id: newId('cert'), name: '', issuer: '', date: '', expiry: '', credentialId: '', url: '' }),
  awards:         () => ({ id: newId('awd'),  title: '', issuer: '', date: '', description: '' }),
  volunteering:   () => ({ id: newId('vol'),  org: '', role: '', location: '', startDate: '', endDate: '', description: '', bullets: [] }),
  references:     () => ({ id: newId('ref'),  name: '', jobTitle: '', company: '', relationship: '', email: '', phone: '' }),
  interests:      () => ({ id: newId('int'),  interests: '' }),
  custom:         () => ({ id: newId('cust'), title: '', subtitle: '', date: '', location: '', description: '', bullets: [] }),
};

export const ADD_LABEL = {
  experience: 'Add Experience', education: 'Add Education', skills: 'Add Skill Group',
  projects: 'Add Project', languages: 'Add Language', certifications: 'Add Certification',
  awards: 'Add Award', volunteering: 'Add Volunteering', references: 'Add Reference',
  interests: 'Add Interest', custom: 'Add Entry',
};
