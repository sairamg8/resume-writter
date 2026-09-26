import { useState } from 'react';
import RichTextEditor from '@/components/RichTextEditor';
import { InputField, MonthPicker, FieldRow, ItemCard, MONTHS } from '@/components/SectionEditorShared';
import { parseMonthYear } from '@/utils/dates';

/**
 * The current flag: the entry ends "Present" and its End Date is cleared. A job's, and an
 * education's, project's or volunteering role's (R2-150), which printed their start date alone.
 */
function CurrentBox({ item, onUpdate, label }) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
      <input type="checkbox" checked={item.current || false} onChange={e => onUpdate({ ...item, current: e.target.checked, endDate: '' })} className="rounded" />
      {label}
    </label>
  );
}

/** Start and End Date, the End disabled while the entry is current, and its current flag. */
function CurrentDates({ item, onUpdate, label }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <MonthPicker label="Start Date" value={item.startDate} onChange={v => u('startDate', v)} />
        <MonthPicker label="End Date" value={item.current ? '' : item.endDate} onChange={v => u('endDate', v)} disabled={item.current} />
      </div>
      <CurrentBox item={item} onUpdate={onUpdate} label={label} />
    </>
  );
}

export function ExperienceItem({ item, onUpdate, onRemove, onDuplicate, defaultOpen }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  const itemHidden = new Set(item.hiddenFields || []);
  function toggleField(f) {
    const cur = item.hiddenFields || [];
    onUpdate({ ...item, hiddenFields: itemHidden.has(f) ? cur.filter(x => x !== f) : [...cur, f] });
  }
  return (
    <ItemCard label={item.role || item.company} onRemove={onRemove} onDuplicate={onDuplicate} visible={visible} defaultOpen={defaultOpen} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <FieldRow label="Company" field="company" hiddenSet={itemHidden} onToggle={toggleField}>
        <InputField value={item.company} onChange={v => u('company', v)} placeholder="Company Name" />
      </FieldRow>
      <FieldRow label="Job Title" field="role" hiddenSet={itemHidden} onToggle={toggleField}>
        <InputField value={item.role} onChange={v => u('role', v)} placeholder="Software Engineer" />
      </FieldRow>
      <FieldRow label="Location" field="location" hiddenSet={itemHidden} onToggle={toggleField}>
        <InputField value={item.location} onChange={v => u('location', v)} placeholder="City, State" />
      </FieldRow>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <FieldRow label="Start Date" field="startDate" hiddenSet={itemHidden} onToggle={toggleField}>
          <MonthPicker value={item.startDate} onChange={v => u('startDate', v)} />
        </FieldRow>
        <FieldRow label="End Date" field="endDate" hiddenSet={itemHidden} onToggle={toggleField}>
          <MonthPicker value={item.current ? '' : item.endDate} onChange={v => u('endDate', v)} disabled={item.current} />
        </FieldRow>
      </div>
      <CurrentBox item={item} onUpdate={onUpdate} label="Currently working here" />
      <FieldRow label="Description" field="description" hiddenSet={itemHidden} onToggle={toggleField}>
        <RichTextEditor key={item.id + '_desc'} value={item.description} onChange={v => u('description', v)} placeholder="Use bullet points for achievements — start each with a strong verb and a measurable result." rows={5} />
      </FieldRow>
    </ItemCard>
  );
}

export function EducationItem({ item, onUpdate, onRemove, onDuplicate, defaultOpen }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  return (
    <ItemCard label={item.institution || item.degree} onRemove={onRemove} onDuplicate={onDuplicate} visible={visible} defaultOpen={defaultOpen} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <InputField label="Institution" value={item.institution} onChange={v => u('institution', v)} placeholder="University Name" />
      <InputField label="Degree" value={item.degree} onChange={v => u('degree', v)} placeholder="B.S. Computer Science" />
      <InputField label="Field of Study" value={item.fieldOfStudy} onChange={v => u('fieldOfStudy', v)} placeholder="Computer Science" />
      <InputField label="Location" value={item.location} onChange={v => u('location', v)} placeholder="City, State" />
      <CurrentDates item={item} onUpdate={onUpdate} label="Currently studying here" />
      <InputField label="GPA (optional)" value={item.gpa} onChange={v => u('gpa', v)} placeholder="3.8" />
      <RichTextEditor key={item.id + '_desc'} label="Description" value={item.description} onChange={v => u('description', v)} placeholder="Relevant coursework, activities, honors..." rows={3} />
    </ItemCard>
  );
}

export function ProjectItem({ item, onUpdate, onRemove, onDuplicate, defaultOpen }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  return (
    <ItemCard label={item.name} onRemove={onRemove} onDuplicate={onDuplicate} visible={visible} defaultOpen={defaultOpen} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <InputField label="Project Name" value={item.name} onChange={v => u('name', v)} placeholder="My Awesome Project" />
      <InputField label="URL (optional)" value={item.url} onChange={v => u('url', v)} placeholder="github.com/you/project" />
      <InputField label="Technologies" value={item.technologies} onChange={v => u('technologies', v)} placeholder="React, Node.js, PostgreSQL" />
      <CurrentDates item={item} onUpdate={onUpdate} label="Ongoing project" />
      <RichTextEditor key={item.id + '_desc'} label="Description" value={item.description} onChange={v => u('description', v)} placeholder="What this project does and why it matters..." rows={4} />
    </ItemCard>
  );
}

export function VolunteeringItem({ item, onUpdate, onRemove, onDuplicate, defaultOpen }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  return (
    <ItemCard label={item.role || item.org} onRemove={onRemove} onDuplicate={onDuplicate} visible={visible} defaultOpen={defaultOpen} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <InputField label="Organization" value={item.org} onChange={v => u('org', v)} placeholder="Non-profit Organization" />
      <InputField label="Role" value={item.role} onChange={v => u('role', v)} placeholder="Volunteer Coordinator" />
      <InputField label="Location" value={item.location} onChange={v => u('location', v)} placeholder="City, State" />
      <CurrentDates item={item} onUpdate={onUpdate} label="Currently volunteering here" />
      <RichTextEditor key={item.id + '_desc'} label="Description" value={item.description} onChange={v => u('description', v)} placeholder="What you did and impact made..." rows={3} />
    </ItemCard>
  );
}

export function CustomItem({ item, onUpdate, onRemove, onDuplicate, defaultOpen }) {
  const u = (k, v) => onUpdate({ ...item, [k]: v });
  const visible = item.visible !== false;
  // A stored date the month picker cannot hold — an imported period ('Jan 2020 – Mar 2021',
  // '2019 – 2021'), a season — is edited as text: the picker showed its first month and year, or
  // blanks, and any pick wrote 'Jan 2021' over the whole period (R4-ED-03). The PDF prints the date
  // as stored. Once a text box, it stays one while the entry is on screen, so it does not turn into
  // the picker mid-typing (a period retyped passes through '2019', which the picker reads).
  const [periodText, setPeriodText] = useState(false);
  if (!periodText && isPeriodText(item.date)) setPeriodText(true);
  return (
    <ItemCard label={item.title} onRemove={onRemove} onDuplicate={onDuplicate} visible={visible} defaultOpen={defaultOpen} onToggleVisibility={() => onUpdate({ ...item, visible: !visible })}>
      <InputField label="Title" value={item.title} onChange={v => u('title', v)} placeholder="Entry Title" />
      <InputField label="Subtitle" value={item.subtitle} onChange={v => u('subtitle', v)} placeholder="Organization or Context" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {periodText
          ? <InputField label="Date / Period" value={item.date} onChange={v => u('date', v)} placeholder="Jan 2020 – Mar 2021" />
          : <MonthPicker label="Date / Period" value={item.date} onChange={v => u('date', v)} />}
        <InputField label="Location" value={item.location} onChange={v => u('location', v)} placeholder="City, State" />
      </div>
      <RichTextEditor key={item.id + '_desc'} label="Description" value={item.description} onChange={v => u('description', v)} placeholder="Free-form description..." rows={3} />
    </ItemCard>
  );
}

/** A date the month picker cannot show and write back whole: text that is no month and year, nor a bare month. */
function isPeriodText(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  return !parseMonthYear(value) && !MONTHS.includes(value.trim());
}
