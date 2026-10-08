import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { useStableActions } from '@/hooks/useStableActions';
import { useSameList } from '@/hooks/useSameList';

// One options object for the life of the page: useSensor makes a new sensor from a new one, and dnd-kit
// wakes every sortable under it for a new list of sensors (PERF-4).
const KEYBOARD_SENSOR = { coordinateGetter: sortableKeyboardCoordinates };

/**
 * The Résumé tab: Collapse/Expand All, Personal Info, the sections (drag to reorder) and Add
 * Section. What is open is the Editor's state, so it survives a trip to Design or the letter.
 */
export function EditorResumeTab({
  resume, store,
  personalOpen, setPersonalOpen, allExpanded, forceOpenKey, toggleAllSections,
  addSectionOpen, setAddSectionOpen,
}) {
  // The store's actions as ones that keep their identity, so the memoised sections are not woken by a keystroke elsewhere.
  const actions = useStableActions(store);
  // The Personal Info editor gets the résumé's id, and reads the whole résumé (for an upload's size budget)
  // only when a file is picked: given the résumé itself it rendered again at every keystroke in a section.
  const latestResume = useRef(resume);
  useLayoutEffect(() => { latestResume.current = resume; });
  const getResume = useCallback(() => latestResume.current, []);
  const resumeId = useMemo(() => ({ id: resume.id }), [resume.id]);
  const sectionIds = useSameList(resume.sections.map(s => s.id));
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, KEYBOARD_SENSOR)
  );

  // Collapse/Expand All reaches the sections there when it was pressed (and every one when the tab
  // mounts, so a trip to Design keeps them as they were, or another résumé opens in the Editor, which
  // stays mounted from one to the next). One added since opens, as a new section does: it collapsed
  // after Collapse All, hiding its entry and its Add button (R2-113).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const forcedIds = useMemo(() => new Set(resume.sections.map(s => s.id)), [forceOpenKey, resume.id]);
  // The section just added from Add Section: its first entry opens, as an entry Add makes does (R4-LO-20).
  const [addedSectionId, setAddedSectionId] = useState(null);

  function handleSectionDragEnd(event) {
    const { active, over } = event;
    // A section let go over no other one (off the list) stays where it was.
    if (!over || active.id === over.id) return;
    const sections = resume.sections;
    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) actions.updateSections(arrayMove(sections, oldIndex, newIndex));
  }

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex justify-end">
        <button
          onClick={toggleAllSections}
          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-cv-muted hover:text-cv-brand-text hover:bg-cv-brand-soft border border-cv-hairline rounded-cv-control transition-colors"
        >
          {allExpanded ? <><ChevronsDownUp size={12} /> Collapse All</> : <><ChevronsUpDown size={12} /> Expand All</>}
        </button>
      </div>

      <div className="cv-card overflow-hidden">
        <button className="w-full flex items-center gap-2 px-4 py-3 bg-cv-ground text-left select-none" onClick={() => setPersonalOpen(o => !o)}>
          <User size={14} className="text-cv-faint shrink-0" />
          <span className="text-sm font-semibold text-cv-ink flex-1">Personal Info</span>
          {personalOpen ? <ChevronUp size={14} className="text-cv-faint" /> : <ChevronDown size={14} className="text-cv-faint" />}
        </button>
        {personalOpen && (
          <div className="p-4 border-t border-cv-hairline">
            <PersonalInfoEditor
              resume={resumeId}
              getResume={getResume}
              personal={resume.personal}
              updatePersonal={actions.updatePersonal}
              toggleFieldVisibility={actions.toggleFieldVisibility}
              settings={resume.settings}
              updateSetting={actions.updateSetting}
              clearSettings={actions.clearSettings}
              template={resume.template}
              coverLetter={resume.coverLetter}
            />
          </div>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
        <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
          {resume.sections.map(section => (
            <SortableSection
              key={section.id}
              section={section}
              template={resume.template}
              settings={resume.settings}
              updateSection={actions.updateSection}
              updateSectionSettings={actions.updateSectionSettings}
              removeSection={actions.removeSection}
              addItem={actions.addItem}
              updateItem={actions.updateItem}
              removeItem={actions.removeItem}
              reorderItems={actions.reorderItems}
              toggleSectionVisibility={actions.toggleSectionVisibility}
              duplicateSection={actions.duplicateSection}
              duplicateItem={actions.duplicateItem}
              forceOpen={allExpanded}
              forceOpenKey={forcedIds.has(section.id) ? forceOpenKey : 0}
              justAdded={section.id === addedSectionId}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="border border-dashed border-cv-field rounded-cv-card overflow-hidden">
        <button
          onClick={() => setAddSectionOpen(o => !o)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-cv-muted hover:text-cv-ink hover:bg-cv-ground transition-colors"
        >
          <Plus size={15} /> Add Section
          {addSectionOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {addSectionOpen && (
          <div className="px-3 pb-3 pt-1 space-y-3 border-t border-cv-hairline">
            {SECTION_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[10px] font-bold text-cv-faint uppercase tracking-widest mb-1.5 px-1">{group.label}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {group.types.map(({ type, label }) => (
                    <button key={type} onClick={() => { setAddedSectionId(actions.addSection(type)); setAddSectionOpen(false); }} className="px-3 py-2 text-xs text-cv-body bg-cv-surface border border-cv-hairline rounded-cv-control hover:border-cv-brand-soft-border hover:text-cv-brand-text hover:bg-cv-brand-soft text-left transition-colors">
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
