import { useState, useEffect, useRef } from 'react';
import { ArrowRightLeft, CheckSquare, ExternalLink, MapPin, Trash2 } from 'lucide-react';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core';
import { JOB_STATUSES } from '@/constants/jobs';
import { Avatar, DatePill, IconButton, Menu, cx } from '@/components/ui';
import { hasRichText, richTextToPlain, safeHref } from '@/utils/richText';
import { JOB_DRAG_INSTRUCTIONS, openOnKey } from '@/utils/cardKeys';
import { formatShortDay } from '@/utils/uiFormat';

/** Keeps a press on a control inside a card from starting the card's drag (mouse or touch). */
const stopDrag = { onMouseDown: e => e.stopPropagation(), onTouchStart: e => e.stopPropagation() };

/**
 * A job's card face, in the tracker's look: the company (its avatar, name and posting link), the
 * role, where and how much, the notes' first lines as text, and a footer — applied on, the
 * deadline, the tasks done. Presentational, so it doubles as the drag overlay (`overlay`).
 */
function KanbanCard({ job, onDelete, onMove, overlay = false }) {
  const todos = job.todos || [];
  const todoDone = todos.filter(t => t.done).length;
  const allDone = todos.length > 0 && todoDone === todos.length;
  const where = [job.location, job.salary].filter(Boolean).join(' · ');

  return (
    <div className={cx(
      'flex flex-col gap-2 rounded bg-white p-3 select-none shadow-[0_1px_1px_#091e4240,0_0_1px_#091e424f] transition-colors',
      overlay ? 'rotate-2 shadow-[0_8px_12px_#091e4226,0_0_1px_#091e424f]' : 'group-hover/card:bg-sunken',
    )}>
      <div className="flex items-start gap-2">
        <Avatar name={job.company || '?'} size="sm" shape="square" decorative />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-5 text-ink">{job.company || '—'}</p>
          <p className="text-[13px] leading-5 text-ink-subtle line-clamp-2">{job.role || '—'}</p>
        </div>
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
            className="mt-0.5 shrink-0 rounded p-0.5 text-ink-subtlest transition-colors hover:bg-neutral-fill hover:text-brand"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {where && (
        <p className="flex items-center gap-1 text-[12px] text-ink-subtlest">
          <MapPin size={12} aria-hidden="true" className="shrink-0" /><span className="truncate">{where}</span>
        </p>
      )}
      {job.contact && <p className="truncate text-[12px] text-brand">{job.contact}</p>}
      {hasRichText(job.notes) && (
        <p className="text-[12px] leading-4 text-ink-subtlest italic line-clamp-2">{richTextToPlain(job.notes)}</p>
      )}

      {(job.appliedDate || job.deadline || todos.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {job.appliedDate && <span className="text-[11px] text-ink-subtlest" title={`Applied ${job.appliedDate}`}>Applied {formatShortDay(job.appliedDate) || job.appliedDate}</span>}
          {job.deadline && <DatePill value={job.deadline} size="sm" />}
          {todos.length > 0 && (
            <span className={cx('ml-auto inline-flex items-center gap-1 text-[11px] font-medium', allDone ? 'text-loz-done-ink' : 'text-ink-subtlest')}>
              <CheckSquare size={12} aria-hidden="true" /> {todoDone}/{todos.length} tasks
            </span>
          )}
        </div>
      )}
      {todos.length > 0 && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-hovered" aria-hidden="true">
          <div className={cx('h-full rounded-full', allDone ? 'bg-[#22a06b]' : 'bg-brand')} style={{ width: `${(todoDone / todos.length) * 100}%` }} />
        </div>
      )}

      {/* Shown on hover, and while Tab is on one of its buttons (an unseen focus otherwise). */}
      {!overlay && (
        <div className="-mb-1 flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100 no-hover:opacity-100">
          {onMove && (
            <span {...stopDrag} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
              <Menu
                label="Move to"
                items={JOB_STATUSES.map(s => ({ id: s.id, label: s.label, checked: s.id === job.status, radio: true, onSelect: () => s.id !== job.status && onMove(job.id, s.id) }))}
                trigger={<IconButton icon={ArrowRightLeft} label="Move to another status" size="sm" tooltip={false} />}
              />
            </span>
          )}
          <button
            {...stopDrag}
            onClick={e => { e.stopPropagation(); onDelete(job.id); }}
            title="Delete application"
            aria-label="Delete application"
            className="rounded p-1 text-ink-subtlest transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function DraggableCard({ job, onNavigate, onDelete, onMove }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onNavigate(job.id)}
      onKeyDown={e => openOnKey(e, () => onNavigate(job.id))}
      className={cx('group/card cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand', isDragging && 'opacity-30')}
    >
      <KanbanCard job={job} onDelete={onDelete} onMove={onMove} />
    </div>
  );
}

function KanbanColumn({ status, jobs, onNavigate, onDelete, onMove }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <section id={`kanban-col-${status.id}`} aria-label={`${status.label} column`} className="flex w-[264px] shrink-0 snap-center flex-col rounded-md bg-sunken">
      <header className="flex h-11 items-center gap-2 px-3">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
        <h2 className="truncate text-[12px] font-semibold uppercase tracking-[0.03em] text-ink-subtle">{status.label}</h2>
        <span className="shrink-0 text-[12px] font-semibold text-ink-subtlest">{jobs.length}</span>
      </header>
      <div
        ref={setNodeRef}
        className={cx('flex min-h-32 flex-1 flex-col gap-1 rounded-b-md px-1 pb-1 transition-colors', isOver && 'bg-brand-subtle/70')}
      >
        {jobs.map(job => (
          <DraggableCard key={job.id} job={job} onNavigate={onNavigate} onDelete={onDelete} onMove={onMove} />
        ))}
        {jobs.length === 0 && <p className="px-2 py-3 text-center text-[12px] text-ink-subtlest">Drop a job here</p>}
      </div>
    </section>
  );
}

/**
 * The job board: a column per status, a card per job — drag a card to another column (a mouse
 * drags on a small move, a finger on a press-and-hold) or use its "Move to" menu; a click or
 * Enter opens the job. `scrollToStatus` brings a filtered status's column into view.
 */
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
  const move = (id, status) => updateJob(id, { status });

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
      <div ref={containerRef} className="flex snap-x snap-mandatory items-start gap-2 overflow-x-auto pb-4 md:snap-none">
        {JOB_STATUSES.map(status => (
          <KanbanColumn
            key={status.id}
            status={status}
            jobs={jobs.filter(j => j.status === status.id)}
            onNavigate={onNavigate}
            onDelete={onDelete}
            onMove={move}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeJob ? <div className="w-[256px]"><KanbanCard job={activeJob} overlay /></div> : null}
      </DragOverlay>
    </DndContext>
  );
}
