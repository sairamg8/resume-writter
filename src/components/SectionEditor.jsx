import { useState, useEffect, useRef, useMemo } from 'react';
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

export function SortableSection({
  section, template, updateSection, updateSectionSettings,
  removeSection, addItem, updateItem, removeItem, reorderItems,
  toggleSectionVisibility, duplicateSection, duplicateItem,
  forceOpen, forceOpenKey, justAdded,
  settings,
}) {
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

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

  // An entry nobody has filled in yet: no field holds anything but what a new entry starts with (a
  // new language's 'Professional', a job's current: false). Deleting one does not ask (R4-ED-06).
  // Every field counts, not only text ones: a job marked current (which prints 'Present') or older
  // data's bullets list was deleted without asking (R4-LO-20). The id, the entry's hidden switch and
  // its hidden fields are how it shows, not what it holds.
  const fresh = useMemo(() => factory(), [factory]);
  function untouched(item) {
    return !Object.entries(item).some(([k, v]) => !NOT_CONTENT.has(k) && isContent(v, fresh[k]));
  }

  function renderItem(item) {
    const props = {
      item,
      defaultOpen: item.id === openOnMount.current,
      onUpdate: u => updateItem(section.id, item.id, () => u),
      onRemove: () => {
        // An untouched new entry goes without asking; anything with content asks first.
        if (untouched(item) || confirm('Delete this entry?')) removeItem(section.id, item.id);
      },
      onDuplicate: duplicateItem && (() => duplicateItem(section.id, item.id)),
    };
    switch (section.type) {
      case 'experience':     return <ExperienceItem     {...props} />;
      case 'education':      return <EducationItem      {...props} />;
      case 'skills':         return <SkillItem          {...props} />;
      case 'projects':       return <ProjectItem        {...props} />;
      case 'languages':      return <LanguageItem       {...props} />;
      case 'certifications': return <CertificationItem  {...props} />;
      case 'awards':         return <AwardItem          {...props} />;
      case 'volunteering':   return <VolunteeringItem   {...props} />;
      case 'references':     return <ReferenceItem      {...props} />;
      case 'interests':      return <InterestItem       {...props} />;
      default:               return <CustomItem         {...props} />;
    }
  }

  return (
    <div ref={setNodeRef} style={style} className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-colors ${isHidden ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
      <div className={`flex items-center gap-1.5 px-3 py-2.5 border-b border-gray-100 ${isHidden ? 'bg-gray-50/50' : 'bg-gray-50'}`}>
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none shrink-0">
          <GripVertical size={15} />
        </button>
        <input
          type="text"
          aria-label="Section title"
          value={section.title}
          onChange={e => updateSection(section.id, s => ({ ...s, title: e.target.value }))}
          className={`flex-1 text-sm font-semibold bg-transparent focus:outline-none min-w-0 ${isHidden ? 'text-gray-400 line-through' : 'text-gray-700'}`}
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
        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className={`p-1.5 rounded transition-colors ${menuOpen ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
            title="Section options"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
              <button
                onClick={() => { setCustomizerOpen(o => !o); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                <Settings2 size={13} /> {customizerOpen ? 'Hide options' : 'Customize layout'}
              </button>
              <button
                onClick={() => {
                  const factory = Object.hasOwn(SECTION_TYPE_DEFAULTS, section.type) ? SECTION_TYPE_DEFAULTS[section.type] : SECTION_TYPE_DEFAULTS.custom;
                  // In its template's own Grids where it has one (Compact's grid, T9), as a new section is.
                  const fresh = newSectionGrid(factory(section.id), templateId(template));
                  // Grids, title style, order and spacing all go at once, without asking: a notice with
                  // Undo puts the section's own settings back (R4-DUX-16).
                  const before = section.settings;
                  updateSection(section.id, s => ({ ...s, settings: { ...fresh.settings } }));
                  setMenuOpen(false);
                  toast({
                    id: `section-style-reset-${section.id}`,
                    title: 'Section style reset',
                    description: section.title || undefined,
                    duration: 8000,
                    action: { label: 'Undo', onClick: () => updateSection(section.id, s => ({ ...s, settings: before })) },
                  });
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                <RotateCcw size={13} /> Reset style
              </button>
              {duplicateSection && (
                <button
                  onClick={() => { duplicateSection(section.id); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <Copy size={13} /> Duplicate section
                </button>
              )}
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  const n = section.items.length;
                  const what = n ? ` and its ${n} ${n === 1 ? 'entry' : 'entries'}` : '';
                  if (confirm(`Delete the "${section.title}" section${what}?`)) removeSection(section.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 size={13} /> Delete section
              </button>
            </div>
          )}
        </div>
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
                <SortableItemWrapper key={item.id} id={item.id}>
                  {renderItem(item)}
                </SortableItemWrapper>
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
