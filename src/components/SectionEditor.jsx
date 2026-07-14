import { useState, useEffect, useRef } from 'react';
import { Plus, ChevronDown, ChevronUp, GripVertical, Settings2, Eye, EyeOff, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import { SECTION_TYPE_DEFAULTS } from '@/utils/defaultData';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableItemWrapper } from '@/components/SectionEditorShared';
import { ExperienceItem, EducationItem, ProjectItem, VolunteeringItem, CustomItem } from '@/components/SectionEditorEntryItems';
import { SkillItem, LanguageItem, CertificationItem, AwardItem, ReferenceItem, InterestItem, NEW_ITEM, ADD_LABEL } from '@/components/SectionEditorLeafItems';
import { SectionCustomizer } from '@/components/SectionEditorCustomizer';

export function SortableSection({
  section, updateSection, updateSectionSettings,
  removeSection, addItem, updateItem, removeItem, reorderItems,
  toggleSectionVisibility,
  forceOpen, forceOpenKey,
}) {
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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

  function handleAddItem() {
    const factory = NEW_ITEM[section.type] || NEW_ITEM.custom;
    addItem(section.id, factory());
  }

  function renderItem(item) {
    const props = {
      item,
      onUpdate: u => updateItem(section.id, item.id, () => u),
      onRemove: () => removeItem(section.id, item.id),
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
                  const factory = SECTION_TYPE_DEFAULTS[section.type] || SECTION_TYPE_DEFAULTS.custom;
                  const fresh = factory(section.id);
                  updateSection(section.id, s => ({ ...s, settings: { ...fresh.settings } }));
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                <RotateCcw size={13} /> Reset style
              </button>
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={() => { removeSection(section.id); setMenuOpen(false); }}
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
        <SectionCustomizer section={section} updateSectionSettings={updateSectionSettings} />
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
            <Plus size={13} /> {ADD_LABEL[section.type] || 'Add Entry'}
          </button>
        </div>
      )}
    </div>
  );
}
