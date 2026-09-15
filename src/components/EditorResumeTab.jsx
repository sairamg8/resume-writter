import {
  Plus, User, ChevronDown, ChevronUp, ChevronsDownUp, ChevronsUpDown,
} from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { SECTION_GROUPS } from '@/constants/resume';
import PersonalInfoEditor from '@/components/PersonalInfoEditor';
import { SortableSection } from '@/components/SectionEditor';

/**
 * The Résumé tab: Collapse/Expand All, Personal Info, the sections (drag to reorder) and Add
 * Section. What is open is the Editor's state, so it survives a trip to Design or the letter.
 */
export function EditorResumeTab({
  resume, store,
  personalOpen, setPersonalOpen, allExpanded, forceOpenKey, toggleAllSections,
  addSectionOpen, setAddSectionOpen,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleSectionDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const sections = resume.sections;
      const oldIndex = sections.findIndex(s => s.id === active.id);
      const newIndex = sections.findIndex(s => s.id === over.id);
      store.updateSections(arrayMove(sections, oldIndex, newIndex));
    }
  }

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex justify-end">
        <button
          onClick={toggleAllSections}
          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 rounded-lg transition-colors"
        >
          {allExpanded ? <><ChevronsDownUp size={12} /> Collapse All</> : <><ChevronsUpDown size={12} /> Expand All</>}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <button className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 text-left select-none" onClick={() => setPersonalOpen(o => !o)}>
          <User size={14} className="text-gray-400 shrink-0" />
          <span className="text-sm font-semibold text-gray-700 flex-1">Personal Info</span>
          {personalOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>
        {personalOpen && (
          <div className="p-4 border-t border-gray-100">
            <PersonalInfoEditor
              personal={resume.personal}
              updatePersonal={store.updatePersonal}
              toggleFieldVisibility={store.toggleFieldVisibility}
              settings={resume.settings}
              updateSetting={store.updateSetting}
              template={resume.template}
              coverLetter={resume.coverLetter}
            />
          </div>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
        <SortableContext items={resume.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {resume.sections.map(section => (
            <SortableSection
              key={section.id}
              section={section}
              template={resume.template}
              updateSection={store.updateSection}
              updateSectionSettings={store.updateSectionSettings}
              removeSection={store.removeSection}
              addItem={store.addItem}
              updateItem={store.updateItem}
              removeItem={store.removeItem}
              reorderItems={store.reorderItems}
              toggleSectionVisibility={store.toggleSectionVisibility}
              forceOpen={allExpanded}
              forceOpenKey={forceOpenKey}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="border border-dashed border-gray-300 rounded-xl overflow-hidden">
        <button
          onClick={() => setAddSectionOpen(o => !o)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Plus size={15} /> Add Section
          {addSectionOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {addSectionOpen && (
          <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-100">
            {SECTION_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 px-1">{group.label}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {group.types.map(({ type, label }) => (
                    <button key={type} onClick={() => { store.addSection(type); setAddSectionOpen(false); }} className="px-3 py-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 text-left transition-colors">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="h-4" />
    </div>
  );
}
