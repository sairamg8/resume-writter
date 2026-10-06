import { memo, useState, useEffect, useRef } from 'react';
import { Plus, ChevronDown, ChevronUp, GripVertical, Settings2, Eye, EyeOff, MoreHorizontal, RotateCcw, Trash2, Copy } from 'lucide-react';
import { SECTION_TYPE_DEFAULTS } from '@/utils/defaultData';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableItemWrapper } from '@/components/SectionEditorShared';
import { ExperienceItem, EducationItem, ProjectItem, VolunteeringItem, CustomItem } from '@/components/SectionEditorEntryItems';
import { SkillItem, LanguageItem, CertificationItem, AwardItem, ReferenceItem, InterestItem, NEW_ITEM, ADD_LABEL } from '@/components/SectionEditorLeafItems';
import { SectionCustomizer } from '@/components/SectionEditorCustomizer';
import { newSectionGrid } from '@/templates/pdf/shared/templateSectionDefaults';
import { templateId } from '@/constants/templates';
import { useToast } from '@/components/ui/Toast';
import { Menu } from '@/components/ui/Menu';

/** The card each section type draws for one entry. */
const ENTRY_CARD = {
  experience: ExperienceItem, education: EducationItem, skills: SkillItem, projects: ProjectItem,
  languages: LanguageItem, certifications: CertificationItem, awards: AwardItem,
  volunteering: VolunteeringItem, references: ReferenceItem, interests: InterestItem,
};

/**
 * One entry of a section, with its drag handle. Memoised on what it is given: an entry's object is a
 * new one only when it was edited (the store's updaters share the others), and the three actions are
 * the store's own, fixed ones, so a keystroke in one entry leaves every other entry, here and in the
 * other sections, as it is (PERF-4).
 */
const SectionEntry = memo(function SectionEntry({ sectionId, type, item, defaultOpen, updateItem, removeItem, duplicateItem }) {
  // By its own key only: a type named like an Object member ('valueOf') is a custom section (R1-LEFT-c).
  const Card = Object.hasOwn(ENTRY_CARD, type) ? ENTRY_CARD[type] : CustomItem;
  const factory = Object.hasOwn(NEW_ITEM, type) ? NEW_ITEM[type] : NEW_ITEM.custom;
  return (
    <SortableItemWrapper id={item.id}>
      <Card
        item={item}
        defaultOpen={defaultOpen}
        onUpdate={u => updateItem(sectionId, item.id, () => u)}
        onRemove={() => {
          // An untouched new entry goes without asking; anything with content asks first.
          if (untouched(item, factory()) || confirm('Delete this entry?')) removeItem(sectionId, item.id);
        }}
        onDuplicate={duplicateItem && (() => duplicateItem(sectionId, item.id))}
      />
    </SortableItemWrapper>
  );
});

export const SortableSection = memo(function SortableSection({
  section, template, updateSection, updateSectionSettings,
  removeSection, addItem, updateItem, removeItem, reorderItems,
  toggleSectionVisibility, duplicateSection, duplicateItem,
  forceOpen, forceOpenKey, justAdded,
  settings,
}) {
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (forceOpenKey > 0) setSectionOpen(forceOpen);
  }, [forceOpenKey]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const itemSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isHidden = section.visible === false;

  function handleItemDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = section.items.findIndex(i => i.id === active.id);
    const newIndex = section.items.findIndex(i => i.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) reorderItems(section.id, oldIndex, newIndex);
  }

  // By its own key only: a type named like an Object member ('valueOf') is a custom section (R1-LEFT-c).
  const factory = Object.hasOwn(NEW_ITEM, section.type) ? NEW_ITEM[section.type] : NEW_ITEM.custom;

  // The entry the user just added — with Add, or as the first entry of the section they just added
  // (justAdded) — opens once, so its fields show at once instead of a collapsed 'New Entry' to find
  // and click (R4-ED-07). Only that one: a blank entry left from an earlier visit opened on load and
  // on every re-expand of its section (R4-LO-20). Forgotten once its card is on screen.
  const openOnMount = useRef(justAdded ? section.items[0]?.id : null);
  useEffect(() => {
    if (openOnMount.current && section.items.some(i => i.id === openOnMount.current)) openOnMount.current = null;
  });

  function handleAddItem() {
    const item = factory();
    openOnMount.current = item.id;
    addItem(section.id, item);
  }

  function resetStyle() {
    const factory = Object.hasOwn(SECTION_TYPE_DEFAULTS, section.type) ? SECTION_TYPE_DEFAULTS[section.type] : SECTION_TYPE_DEFAULTS.custom;
    // In its template's own Grids where it has one (Compact's grid, T9), as a new section is.
    const fresh = newSectionGrid(factory(section.id), templateId(template));
    // Grids, title style, order and spacing all go at once, without asking: a notice with
    // Undo puts the section's own settings back (R4-DUX-16). Only while the section still
    // holds the very settings the reset wrote: ids repeat across résumés ('experience' in
    // every blank one), so after opening another résumé, or a later edit, Undo writes nothing.
    const before = section.settings;
    const reset = { ...fresh.settings };
    updateSection(section.id, s => ({ ...s, settings: reset }));
    const undo = s => {
      if (s.settings !== reset) return s;
      if (before !== undefined) return { ...s, settings: before };
      const { settings: _reset, ...rest } = s;
      return rest;
    };
    toast({
      id: `section-style-reset-${section.id}`,
      title: 'Section style reset',
      description: section.title || undefined,
      duration: 8000,
      action: { label: 'Undo', onClick: () => updateSection(section.id, undo) },
    });
  }

  function deleteSection() {
    const n = section.items.length;
    const what = n ? ` and its ${n} ${n === 1 ? 'entry' : 'entries'}` : '';
    if (confirm(`Delete the "${section.title}" section${what}?`)) removeSection(section.id);
  }

  // The ⋯ menu, on the kit's Menu: it opens in a layer of its own beside the button, kept inside the
  // window. Drawn inside the card, the card's overflow-hidden cut it off: on a collapsed or short
  // section only its top showed, and Delete section could not be reached (R4-DPH-24). A pick closes it.
  const menuItems = [
    { label: customizerOpen ? 'Hide options' : 'Customize layout', icon: Settings2, onSelect: () => setCustomizerOpen(o => !o) },
    { label: 'Reset style', icon: RotateCcw, onSelect: resetStyle },
    ...(duplicateSection ? [{ label: 'Duplicate section', icon: Copy, onSelect: () => duplicateSection(section.id) }] : []),
    { type: 'separator' },
    { label: 'Delete section', icon: Trash2, danger: true, onSelect: deleteSection },
  ];

  return (
    <div ref={setNodeRef} style={style} className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-colors ${isHidden ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
      <div className={`flex items-center gap-1.5 px-3 py-2.5 border-b border-gray-100 ${isHidden ? 'bg-gray-50/50' : 'bg-gray-50'}`}>
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none shrink-0">
          <GripVertical size={15} />
        </button>
        {/* 16 px on touch: iOS zooms the page into a smaller field it focuses (R4-DPH-28). */}
        <input
          type="text"
          aria-label="Section title"
          value={section.title}
          onChange={e => updateSection(section.id, s => ({ ...s, title: e.target.value }))}
          className={`flex-1 text-sm pointer-coarse:text-base font-semibold bg-transparent focus:outline-none min-w-0 ${isHidden ? 'text-gray-400 line-through' : 'text-gray-700'}`}
        />
        {isHidden && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded shrink-0">Hidden</span>
        )}
        <button
          onClick={() => toggleSectionVisibility?.(section.id)}
          className={`p-1.5 rounded transition-colors shrink-0 ${isHidden ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100' : 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'}`}
          title={isHidden ? 'Show section on resume' : 'Hide section from resume'}
        >
          {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <Menu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          items={menuItems}
          minWidth={176}
          label="Section options"
          trigger={
            <button
              className={`p-1.5 rounded transition-colors shrink-0 ${menuOpen ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              title="Section options"
            >
              <MoreHorizontal size={14} />
            </button>
          }
        />
        <button
          onClick={() => setSectionOpen(o => !o)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors shrink-0"
        >
          {sectionOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {customizerOpen && (
        <SectionCustomizer section={section} template={template} updateSectionSettings={updateSectionSettings} settings={settings} />
      )}

      {sectionOpen && (
        <div className="p-3 space-y-2">
          <DndContext sensors={itemSensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
            <SortableContext items={section.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              {section.items.map(item => (
                <SectionEntry
                  key={item.id}
                  sectionId={section.id}
                  type={section.type}
                  item={item}
                  defaultOpen={item.id === openOnMount.current}
                  updateItem={updateItem}
                  removeItem={removeItem}
                  duplicateItem={duplicateItem}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button
            onClick={handleAddItem}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium mt-1 px-1 py-1"
          >
            <Plus size={13} /> {(Object.hasOwn(ADD_LABEL, section.type) && ADD_LABEL[section.type]) || 'Add Entry'}
          </button>
        </div>
      )}
    </div>
  );
});

/**
 * An entry nobody has filled in yet: no field holds anything but what a new entry starts with (`fresh`:
 * a new language's 'Professional', a job's current: false). Deleting one does not ask (R4-ED-06).
 * Every field counts, not only text ones: a job marked current (which prints 'Present') or older
 * data's bullets list was deleted without asking (R4-LO-20). The id, the entry's hidden switch and
 * its hidden fields are how it shows, not what it holds.
 */
function untouched(item, fresh) {
  return !Object.entries(item).some(([k, v]) => !NOT_CONTENT.has(k) && isContent(v, fresh[k]));
}

/** Keys of an entry that hold no content of their own: its id, and how it shows (R4-LO-20). */
const NOT_CONTENT = new Set(['id', 'visible', 'hiddenFields']);

/**
 * Whether a stored value is something the user put there: text other than blanks, a number, true,
 * or a list or object holding any — unless it is `start`, the value a new entry starts with.
 */
function isContent(v, start) {
  if (typeof v === 'string') return v.trim() !== '' && v !== start;
  if (typeof v === 'number') return Number.isFinite(v) && v !== start;
  if (typeof v === 'boolean') return v && v !== start;
  if (Array.isArray(v)) return v.some(x => isContent(x));
  if (v && typeof v === 'object') return Object.values(v).some(x => isContent(x));
  return false;
}
