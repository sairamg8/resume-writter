import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, X } from 'lucide-react';
import { Button, Dialog, IconButton, Menu, ProgressBar, Select, TextArea, TextField, cx } from '@/components/ui';
import { IssueTypeIcon, Points, PriorityIcon } from '@/components/tracker/TrackerIcons';
import { StatusMenu } from '@/components/tracker/Lozenge';
import { DEFAULT_SPRINT_DAYS } from '@/constants/boards';
import { addDays, isIssueDone, issueKey, statusColumn, todayISO } from '@/utils/boardModel';
import { epicProgress, epicsOf, pointsByCategory } from '@/utils/boardQuery';
import { countLabel, formatShortDay } from '@/utils/uiFormat';
import { openOnKey } from '@/utils/cardKeys';
import { EpicLozenge } from './IssueFields';
import { InlineCreate } from './InlineCreate';

/** "Sep 25 – Oct 9", or '' for a sprint without dates. */
export const sprintDates = (s) => (s?.startDate && s?.endDate ? `${formatShortDay(s.startDate)} – ${formatShortDay(s.endDate)}` : '');

/** A section's points by status, as the tracker's three bubbles: to do, in progress, done. */
export function PointBubbles({ board, issues }) {
  const sum = pointsByCategory(board, issues);
  const tones = { todo: 'bg-loz-todo text-loz-todo-ink', inprogress: 'bg-loz-progress text-loz-progress-ink', done: 'bg-loz-done text-loz-done-ink' };
  const names = { todo: 'to do', inprogress: 'in progress', done: 'done' };
  return (
    <span className="flex items-center gap-1">
      {Object.keys(sum).map((k) => (
        <span key={k} title={`${sum[k]} story points ${names[k]}`} className={cx('inline-flex h-5 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold', tones[k])}>
          {sum[k]}<span className="sr-only"> points {names[k]}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * One issue in the backlog: sortable (`data.type` 'row', its section's sprint in `data.sprintId`),
 * a click or Enter opens it; type, key, summary, epic, status (a menu), points, priority, and a
 * ⋯ menu that moves it to a sprint or the backlog without dragging.
 */
export function BacklogRow({ board, issue, sprintId, targets, onOpen, onStatus, onMove, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id, data: { type: 'row', sprintId } });
  const key = issueKey(board, issue);
  const column = statusColumn(board, issue);
  const epic = issue.epicId ? board.issues.find((i) => i.id === issue.epicId) : null;
  const statuses = board.columns.map((c) => ({ id: c.id, name: c.title || 'Untitled', category: c.category }));
  const stop = { onClick: (e) => e.stopPropagation(), onKeyDown: (e) => e.stopPropagation(), onPointerDown: (e) => e.stopPropagation() };
  // The backlog lists open issues only, so a done row cannot be moved there: it would leave its sprint and vanish from the page.
  const places = isIssueDone(board, issue) ? targets.filter((t) => t.id !== null) : targets;
  const moveItem = (t) => {
    const here = (t.id ?? null) === (sprintId ?? null);
    // The section it is in (the ticked one) moves nothing: sent on, it put the row at that
    // section's foot. The board card's Move to does the same (R5-BRD-01).
    return { id: t.id ?? 'backlog', label: t.name, checked: here, radio: true, onSelect: () => { if (!here) onMove(t.id ?? null); } };
  };
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="button"
      aria-label={`${key} ${issue.title}`}
      onClick={onOpen}
      onKeyDown={(e) => openOnKey(e, onOpen)}
      className={cx(
        'group/row flex h-10 cursor-pointer touch-manipulation items-center gap-2.5 no-hover:select-none border-b border-cv-hairline bg-cv-surface px-3 text-sm last:border-b-0 hover:bg-cv-stage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cv-brand',
        isDragging && 'relative z-10 opacity-70 shadow-lg',
      )}
    >
      <IssueTypeIcon type={issue.type} />
      {/* The key on one line, at least 64px so short keys line up: a key of up to ten letters and
          its number is wider than that, and it widens its column while the summary gives way —
          held to w-16 it wrapped after the '-' or ran over the summary. Never truncated: the
          number is what tells the issue apart. */}
      <span className={cx('min-w-16 shrink-0 whitespace-nowrap text-[13px] text-cv-muted', column?.category === 'done' && 'line-through')}>{key}</span>
      <span className="min-w-0 flex-1 truncate text-cv-ink">{issue.title}</span>
      {epic && <EpicLozenge title={epic.title} className="hidden max-w-[10rem] sm:inline-flex" />}
      <span {...stop} className="hidden shrink-0 sm:block"><StatusMenu size="sm" value={column?.id} options={statuses} onChange={onStatus} /></span>
      <span className="flex w-6 shrink-0 justify-center"><Points value={issue.estimate} /></span>
      <PriorityIcon priority={issue.priority} />
      <span {...stop}>
        <Menu
          label={`${key} actions`}
          items={[
            // Only where there is somewhere else to go: a Kanban backlog has one section (R4-SW-B-03).
            ...(places.length > 1 ? [{ id: 'move', label: 'Move to', items: places.map(moveItem) }, { type: 'separator' }] : []),
            { id: 'del', label: 'Delete', danger: true, onSelect: onDelete },
          ]}
          trigger={<IconButton icon={MoreHorizontal} label={`${key} actions`} size="sm" tooltip={false} className="opacity-0 group-hover/row:opacity-100 no-hover:opacity-100 focus-visible:opacity-100" />}
        />
      </span>
    </li>
  );
}

/** The Epic panel beside the backlog: each epic's progress; a click filters to its issues. */
export function EpicPanel({ board, selected = [], onToggle, onOpen, onCreate, onClose }) {
  const epics = epicsOf(board);
  return (
    <aside aria-label="Epics" className="flex w-full shrink-0 flex-col gap-2 rounded-cv-control border border-cv-hairline bg-cv-surface p-3 lg:w-72 lg:self-start">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-cv-ink">Epic</h2>
        <IconButton icon={X} label="Close the epic panel" size="sm" onClick={onClose} />
      </div>
      {epics.length === 0 && <p className="text-[13px] text-cv-faint">No epics yet. An epic groups the issues of a bigger piece of work.</p>}
      <ul className="flex flex-col gap-1.5">
        {epics.map((e) => {
          const p = epicProgress(board, e.id);
          const on = selected.includes(e.id);
          return (
            <li key={e.id} className={cx('rounded-cv-control border p-2 transition-colors', on ? 'border-cv-brand bg-cv-brand-soft' : 'border-cv-hairline hover:bg-cv-stage')}>
              <div className="flex items-center gap-2">
                <button type="button" aria-pressed={on} onClick={() => onToggle(e.id)} className="min-w-0 flex-1 truncate text-left text-sm font-medium text-cv-ink focus-visible:outline-none focus-visible:underline" title="Show only this epic's issues">
                  {e.title}
                </button>
                <button type="button" onClick={() => onOpen(issueKey(board, e))} className="shrink-0 text-[12px] text-cv-muted hover:text-cv-brand-text hover:underline">{issueKey(board, e)}</button>
              </div>
              <ProgressBar className="mt-2" value={p.done} max={Math.max(p.total, 1)} autoTone label={`${e.title} progress`} valueText={`${p.done} of ${p.total} done`} />
              <p className="mt-1 text-[11px] text-cv-faint">{p.done} of {countLabel(p.total, 'issue')} done{p.points ? ` · ${p.donePoints}/${p.points} points` : ''}</p>
            </li>
          );
        })}
      </ul>
      {/* Only epics are made here: a Task/Story/Bug picker would be ignored (R4-BRD-10), and the
          prompt asks for an epic, not a task (R4-SW-B-04). */}
      <InlineCreate label="Create epic" showType={false} placeholder="What is this epic?" onCreate={({ title }) => onCreate(title)} />
    </aside>
  );
}

/** Start a sprint: its name, start and end (today and two weeks on) and goal. */
export function StartSprintDialog({ sprint, onStart, onClose }) {
  const today = todayISO();
  const [f, setF] = useState(() => sprint && ({
    name: sprint.name, goal: sprint.goal ?? '',
    startDate: sprint.startDate || today,
    endDate: sprint.endDate || addDays(sprint.startDate || today, DEFAULT_SPRINT_DAYS),
  }));
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  // A blank name, or an end before the start, is said under its field and Start waits for it —
  // the store would otherwise keep the old name, or clamp the end to a 0-day sprint (R4-DUX-21).
  const nameError = f && !f.name.trim() ? 'Enter a name' : undefined;
  // ISO days compare as text; a cleared date falls back to the store's default, so it is no error.
  const endError = f?.startDate && f.endDate && f.endDate < f.startDate ? 'End date must be on or after the start date' : undefined;
  const valid = !!f && !nameError && !endError;
  return (
    <Dialog open={!!sprint} onClose={onClose} title={`Start ${sprint?.name ?? 'sprint'}`} description="Plan the dates and the goal of this sprint." size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={() => valid && onStart({ ...f, name: f.name.trim() })}>Start</Button></>}>
      {f && (
        <div className="flex flex-col gap-4">
          <TextField label="Sprint name" required value={f.name} error={nameError} onChange={(e) => set({ name: e.target.value })} data-autofocus />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Start date" type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
            <TextField label="End date" type="date" value={f.endDate} error={endError} onChange={(e) => set({ endDate: e.target.value })} />
          </div>
          <TextArea label="Sprint goal" value={f.goal} onChange={(e) => set({ goal: e.target.value })} rows={3} />
        </div>
      )}
    </Dialog>
  );
}

/** Complete the active sprint: how it went, and where its open issues go. */
export function CompleteSprintDialog({ sprint, stats, futures, onComplete, onClose }) {
  const [to, setTo] = useState('backlog');
  return (
    <Dialog open={!!sprint} onClose={onClose} title={`Complete ${sprint?.name ?? 'sprint'}`} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onComplete(to === 'backlog' ? null : to)}>Complete sprint</Button></>}>
      {stats && (
        <div className="flex flex-col gap-4 text-sm text-cv-ink">
          <p>This sprint contains <strong>{stats.done} completed issue{stats.done === 1 ? '' : 's'}</strong> and <strong>{stats.open} open issue{stats.open === 1 ? '' : 's'}</strong>.</p>
          {stats.open > 0 ? (
            <Select
              label="Move open issues to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              options={[{ value: 'backlog', label: 'Backlog' }, ...futures.map((s) => ({ value: s.id, label: s.name }))]}
            />
          ) : <p className="text-cv-muted">Every issue in this sprint is done. Nice work.</p>}
        </div>
      )}
    </Dialog>
  );
}
