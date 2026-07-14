import RichTextEditor from '@/components/RichTextEditor';
import { InputField, MonthPicker, FieldRow, ItemCard } from '@/components/SectionEditorShared';

export function ExperienceItem({ item, onUpdate, onRemove }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  const itemHidden = new Set(item.hiddenFields || []);
  function toggleField(f) {
    const cur = item.hiddenFields || [];
    onUpdate({ ...item, hiddenFields: itemHidden.has(f) ? cur.filter(x => x !== f) : [...cur, f] });
  }
  return (
    <ItemCard label={item.role || item.company} onRemove={onRemove} visible={visible} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <FieldRow label="Company" field="company" hiddenSet={itemHidden} onToggle={toggleField}>
        <InputField value={item.company} onChange={v => u('company', v)} placeholder="Company Name" />
      </FieldRow>
      <FieldRow label="Job Title" field="role" hiddenSet={itemHidden} onToggle={toggleField}>
        <InputField value={item.role} onChange={v => u('role', v)} placeholder="Software Engineer" />
      </FieldRow>
      <FieldRow label="Location" field="location" hiddenSet={itemHidden} onToggle={toggleField}>
        <InputField value={item.location} onChange={v => u('location', v)} placeholder="City, State" />
      </FieldRow>
      <div className="grid grid-cols-2 gap-2">
        <FieldRow label="Start Date" field="startDate" hiddenSet={itemHidden} onToggle={toggleField}>
          <MonthPicker value={item.startDate} onChange={v => u('startDate', v)} />
        </FieldRow>
        <FieldRow label="End Date" field="endDate" hiddenSet={itemHidden} onToggle={toggleField}>
          <MonthPicker value={item.current ? '' : item.endDate} onChange={v => u('endDate', v)} disabled={item.current} />
        </FieldRow>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
        <input type="checkbox" checked={item.current || false} onChange={e => onUpdate({ ...item, current: e.target.checked, endDate: '' })} className="rounded" />
        Currently working here
      </label>
      <FieldRow label="Description" field="description" hiddenSet={itemHidden} onToggle={toggleField}>
        <RichTextEditor key={item.id + '_desc'} value={item.description} onChange={v => u('description', v)} placeholder="Use bullet points for achievements. Use italic for project sub-headings (bold is auto-stripped in ATS PDF exports)." rows={5} />
      </FieldRow>
    </ItemCard>
  );
}

export function EducationItem({ item, onUpdate, onRemove }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  return (
    <ItemCard label={item.institution || item.degree} onRemove={onRemove} visible={visible} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <InputField label="Institution" value={item.institution} onChange={v => u('institution', v)} placeholder="University Name" />
      <InputField label="Degree" value={item.degree} onChange={v => u('degree', v)} placeholder="B.S. Computer Science" />
      <InputField label="Field of Study" value={item.fieldOfStudy} onChange={v => u('fieldOfStudy', v)} placeholder="Computer Science" />
      <InputField label="Location" value={item.location} onChange={v => u('location', v)} placeholder="City, State" />
      <div className="grid grid-cols-2 gap-2">
        <MonthPicker label="Start Date" value={item.startDate} onChange={v => u('startDate', v)} />
        <MonthPicker label="End Date" value={item.endDate} onChange={v => u('endDate', v)} />
      </div>
      <InputField label="GPA (optional)" value={item.gpa} onChange={v => u('gpa', v)} placeholder="3.8" />
      <RichTextEditor key={item.id + '_desc'} label="Description" value={item.description} onChange={v => u('description', v)} placeholder="Relevant coursework, activities, honors..." rows={3} />
    </ItemCard>
  );
}

export function ProjectItem({ item, onUpdate, onRemove }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  return (
    <ItemCard label={item.name} onRemove={onRemove} visible={visible} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <InputField label="Project Name" value={item.name} onChange={v => u('name', v)} placeholder="My Awesome Project" />
      <InputField label="URL (optional)" value={item.url} onChange={v => u('url', v)} placeholder="github.com/you/project" />
      <InputField label="Technologies" value={item.technologies} onChange={v => u('technologies', v)} placeholder="React, Node.js, PostgreSQL" />
      <div className="grid grid-cols-2 gap-2">
        <MonthPicker label="Start Date" value={item.startDate} onChange={v => u('startDate', v)} />
        <MonthPicker label="End Date" value={item.endDate} onChange={v => u('endDate', v)} />
      </div>
      <RichTextEditor key={item.id + '_desc'} label="Description" value={item.description} onChange={v => u('description', v)} placeholder="What this project does and why it matters..." rows={4} />
    </ItemCard>
  );
}

export function VolunteeringItem({ item, onUpdate, onRemove }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  return (
    <ItemCard label={item.role || item.org} onRemove={onRemove} visible={visible} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <InputField label="Organization" value={item.org} onChange={v => u('org', v)} placeholder="Non-profit Organization" />
      <InputField label="Role" value={item.role} onChange={v => u('role', v)} placeholder="Volunteer Coordinator" />
      <InputField label="Location" value={item.location} onChange={v => u('location', v)} placeholder="City, State" />
      <div className="grid grid-cols-2 gap-2">
        <MonthPicker label="Start Date" value={item.startDate} onChange={v => u('startDate', v)} />
        <MonthPicker label="End Date" value={item.endDate} onChange={v => u('endDate', v)} />
      </div>
      <RichTextEditor key={item.id + '_desc'} label="Description" value={item.description} onChange={v => u('description', v)} placeholder="What you did and impact made..." rows={3} />
    </ItemCard>
  );
}

export function CustomItem({ item, onUpdate, onRemove }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  return (
    <ItemCard label={item.title} onRemove={onRemove} visible={visible} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <InputField label="Title" value={item.title} onChange={v => u('title', v)} placeholder="Entry Title" />
      <InputField label="Subtitle" value={item.subtitle} onChange={v => u('subtitle', v)} placeholder="Organization or Context" />
      <div className="grid grid-cols-2 gap-2">
        <MonthPicker label="Date / Period" value={item.date} onChange={v => u('date', v)} />
        <InputField label="Location" value={item.location} onChange={v => u('location', v)} placeholder="City, State" />
      </div>
      <RichTextEditor key={item.id + '_desc'} label="Description" value={item.description} onChange={v => u('description', v)} placeholder="Free-form description..." rows={3} />
    </ItemCard>
  );
}
