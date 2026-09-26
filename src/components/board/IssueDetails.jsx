import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from '@/components/ui';
import { formatDateTime, relativeTime } from '@/utils/uiFormat';
import { DateInput, EpicPicker, LabelsPicker, PointsInput, PriorityPicker, RecurrencePicker, SprintPicker, TypePicker } from './IssueFields';

/** One field of the Details box: its name on the left, its picker on the right. */
function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-center gap-2 py-0.5">
      <span className="text-[13px] font-semibold text-ink-subtle">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const Stamp = ({ label, at }) => (at ? (
  <p className="text-[12px] text-ink-subtlest">
    {label} <time dateTime={new Date(at).toISOString()} title={formatDateTime(at)}>{relativeTime(at)}</time>
  </p>
) : null);

/**
 * The issue view's right-hand Details box — type, priority, labels, parent epic, sprint (a scrum
 * project, or one with sprints), story points, dates and recurrence, each changed in place — and
 * under it when the issue was created, updated and resolved. The box folds away like the
 * tracker's; `onChange(patch)` sends every change to the store.
 */
export function IssueDetails({ board, issue, onChange, onCreateLabel }) {
  const [open, setOpen] = useState(true);
  const sprints = board.mode === 'scrum' || board.sprints.length > 0;
  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-md border border-line">
        <h3>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex w-full items-center justify-between gap-2 rounded-t-md border-b border-line px-3 py-2.5 text-left text-sm font-semibold text-ink transition-colors hover:bg-hovered focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
          >
            Details
            <ChevronDown size={16} aria-hidden="true" className={cx('transition-transform', !open && '-rotate-90')} />
          </button>
        </h3>
        {open && (
          <div className="flex flex-col px-2 py-2">
            <Row label="Issue type"><TypePicker value={issue.type} onChange={(type) => onChange({ type })} /></Row>
            <Row label="Priority"><PriorityPicker value={issue.priority} onChange={(priority) => onChange({ priority })} /></Row>
            <Row label="Labels">
              <LabelsPicker board={board} value={issue.labelIds} onChange={(labelIds) => onChange({ labelIds })} onCreateLabel={onCreateLabel} />
            </Row>
            {issue.type !== 'epic' && (
              <Row label="Parent epic"><EpicPicker board={board} value={issue.epicId} onChange={(epicId) => onChange({ epicId })} /></Row>
            )}
            {sprints && <Row label="Sprint"><SprintPicker board={board} value={issue.sprintId} onChange={(sprintId) => onChange({ sprintId })} /></Row>}
            <Row label="Story points"><PointsInput value={issue.estimate} onChange={(estimate) => onChange({ estimate })} /></Row>
            <Row label="Start date"><DateInput label="Start date" value={issue.startDate} onChange={(startDate) => onChange({ startDate })} /></Row>
            <Row label="Due date"><DateInput label="Due date" value={issue.due} onChange={(due) => onChange({ due })} /></Row>
            <Row label="Repeats"><RecurrencePicker value={issue.recurrence} onChange={(recurrence) => onChange({ recurrence })} /></Row>
          </div>
        )}
      </section>
      <div className="flex flex-col gap-0.5 px-1">
        <Stamp label="Created" at={issue.createdAt} />
        <Stamp label="Updated" at={issue.updatedAt} />
        <Stamp label="Resolved" at={issue.resolvedAt} />
      </div>
    </div>
  );
}
