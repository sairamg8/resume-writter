import { useState, useEffect, useRef } from 'react';
import { ExternalLink, Trash2, CheckSquare } from 'lucide-react';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core';
import { JOB_STATUSES } from '@/constants/jobs';
import { deadlineState } from '@/utils/dates';
import { hasRichText, richTextToPlain, safeHref } from '@/utils/richText';
import { JOB_DRAG_INSTRUCTIONS, openOnKey } from '@/utils/cardKeys';

/** Keeps a press on a control inside a card from starting the card's drag (mouse or touch). */
const stopDrag = { onMouseDown: e => e.stopPropagation(), onTouchStart: e => e.stopPropagation() };

function KanbanCard({ job, onDelete, overlay = false }) {
  const deadline = deadlineState(job.deadline);
  const isDeadlineSoon = deadline === 'soon';
  const isDeadlinePast = deadline === 'past';
  const todos = job.todos || [];
  const todoDone = todos.filter(t => t.done).length;
  const allDone = todos.length > 0 && todoDone === todos.length;

  return (
    <div className={`bg-white border rounded-xl p-3 select-none ${overlay ? 'shadow-2xl border-indigo-200 rotate-1 scale-105' : 'border-gray-200 shadow-sm hover:shadow-md'} transition-all`}>
      <div className="flex items-start justify-between gap-1 mb-0.5">
        <p className="text-sm font-semibold text-gray-900 leading-snug">{job.company || '—'}</p>
        {safeHref(job.url) && (
          <a
            href={safeHref(job.url)}
            target="_blank"
            rel="noopener noreferrer"
            {...stopDrag}
            /* The card's click opens the job: the posting opened and the tracker left too (R2-099). */
            onClick={e => e.stopPropagation()}
            title="Open job posting"
            aria-label={`Open the ${job.company || 'job'} posting`}
            className="p-0.5 text-gray-300 hover:text-blue-500 shrink-0 mt-0.5 transition-colors"
          >
            <ExternalLink size={11} />
          </a>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-2">{job.role || '—'}</p>

      {(job.location || job.salary) && (
        <p className="text-[10px] text-gray-400 mb-1.5">
          {[job.location, job.salary].filter(Boolean).join(' · ')}
        </p>
      )}

      {job.contact && (
        <p className="text-[10px] text-indigo-400 mb-1.5 truncate">{job.contact}</p>
      )}

      {job.appliedDate && (
        <p className="text-[10px] text-gray-400 mb-1">Applied {job.appliedDate}</p>
      )}

      {job.deadline && (
        <p className={`text-[10px] font-medium mb-1 ${isDeadlinePast ? 'text-red-500' : isDeadlineSoon ? 'text-amber-500' : 'text-gray-400'}`}>
          {isDeadlinePast ? 'Deadline passed' : isDeadlineSoon ? 'Due soon' : 'Due'} {job.deadline}
        </p>
      )}

      {hasRichText(job.notes) && (
        <p className="text-[10px] text-gray-400 line-clamp-2 mb-1.5 italic leading-relaxed">
          {richTextToPlain(job.notes)}
        </p>
      )}

      {todos.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckSquare size={10} className={allDone ? 'text-indigo-500' : 'text-gray-300'} />
            <span className={`text-[10px] font-medium ${allDone ? 'text-indigo-500' : 'text-gray-400'}`}>
              {todoDone}/{todos.length} tasks
            </span>
          </div>
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${allDone ? 'bg-indigo-500' : 'bg-indigo-300'}`}
              style={{ width: `${(todoDone / todos.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Shown on hover, and while Tab is on its delete button (an unseen focus otherwise). */}
      <div className="flex items-center justify-between mt-2 opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 no-hover:opacity-100 transition-opacity">
        <span className="text-[10px] text-indigo-400 font-medium">Open →</span>
        <button
          {...stopDrag}
          onClick={e => { e.stopPropagation(); onDelete(job.id); }}
          title="Delete application"
          aria-label="Delete application"
          className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function DraggableCard({ job, onNavigate, onDelete }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onNavigate(job.id)}
      onKeyDown={e => openOnKey(e, () => onNavigate(job.id))}
      className={`group/card cursor-pointer ${isDragging ? 'opacity-30 cursor-grabbing' : ''}`}
    >
      <KanbanCard job={job} onDelete={onDelete} />
    </div>
  );
}

function KanbanColumn({ status, jobs, onNavigate, onDelete }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <div id={`kanban-col-${status.id}`} className="flex flex-col shrink-0 w-56">
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
        <span className="text-xs font-semibold text-gray-700 truncate">{status.label}</span>
        <span className="ml-auto text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">
          {jobs.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 flex-1 min-h-32 p-2 rounded-xl transition-colors ${
          isOver ? 'bg-indigo-50 border-2 border-indigo-200 border-dashed' : 'bg-gray-100/60'
        }`}
      >
        {jobs.map(job => (
          <DraggableCard key={job.id} job={job} onNavigate={onNavigate} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

export function KanbanView({ jobs, updateJob, onNavigate, onDelete, scrollToStatus }) {
  const [activeId, setActiveId] = useState(null);
  // A mouse drags on a small move, a finger on a press-and-hold, as on the boards: the pointer sensor
  // on a card without touch-action: none lost every touch drag to the page's scroll (R2-038), and a
  // swipe must still scroll the columns.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  const activeJob = jobs.find(j => j.id === activeId);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!scrollToStatus) return;
    const el = containerRef.current?.querySelector(`#kanban-col-${scrollToStatus}`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [scrollToStatus]);

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ screenReaderInstructions: JOB_DRAG_INSTRUCTIONS }}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={({ active, over }) => {
        setActiveId(null);
        if (!over) return;
        const current = jobs.find(j => j.id === active.id);
        if (current && over.id !== current.status) {
          updateJob(active.id, { status: over.id });
        }
      }}
      onDragCancel={() => setActiveId(null)}
    >
      <div ref={containerRef} className="flex gap-3 overflow-x-auto pb-4">
        {JOB_STATUSES.map(status => (
          <KanbanColumn
            key={status.id}
            status={status}
            jobs={jobs.filter(j => j.status === status.id)}
            onNavigate={onNavigate}
            onDelete={onDelete}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeJob ? <KanbanCard job={activeJob} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
