import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBoardStore } from '@/hooks/useBoardStore';
import { Button, EmptyState, IconButton, cx } from '@/components/ui';
import { ProjectHeader } from '@/components/board/ProjectTabs';
import { IssueHost, useIssueRoute } from '@/components/board/useIssueActions';
import { IssueTypeIcon } from '@/components/tracker/TrackerIcons';
import { Lozenge } from '@/components/tracker/Lozenge';
import { childrenOf, epicsOf } from '@/utils/boardQuery';
import { addDays, issueKey, statusColumn, todayISO, toLocalISO } from '@/utils/boardModel';
import { dayRange, daysBetween, weekStart } from '@/utils/calendarGrid';
import { formatShortDay } from '@/utils/uiFormat';

const DAY_W = 28;
const DAYS = 56;
const BAR = { todo: 'bg-[#8590a2]', inprogress: 'bg-[#1d7afc]', done: 'bg-[#22a06b]' };

/** An issue's span on the timeline: start (its start date, else created day) to due; null without a due date. */
function spanOf(issue) {
  if (!issue.due) return null;
  const start = issue.startDate || toLocalISO(issue.createdAt ?? Date.now());
  return start <= issue.due ? { start, end: issue.due } : { start: issue.due, end: issue.due };
}

/** An epic's span: its own dates, else from its children's earliest start to their latest due. */
function epicSpan(board, epic) {
  const own = spanOf(epic);
  const kids = childrenOf(board, epic.id).map(spanOf).filter(Boolean);
  if (!kids.length) return own;
  const all = own ? [own, ...kids] : kids;
  return { start: all.map((s) => s.start).sort()[0], end: all.map((s) => s.end).sort().at(-1) };
}

/** One row: the name in the sticky column, the bar across the days. */
function Row({ board, issue, span, from, depth = 0, open, onToggle, onOpen }) {
  const key = issueKey(board, issue);
  const cat = statusColumn(board, issue)?.category ?? 'todo';
  const left = span ? daysBetween(from, span.start) : null;
  const width = span ? daysBetween(span.start, span.end) + 1 : 0;
  const clippedLeft = left === null ? null : Math.max(left, 0);
  const clippedWidth = left === null ? 0 : Math.min(width - (clippedLeft - left), DAYS - clippedLeft);
  return (
    <div className="flex h-10 border-b border-line-subtle hover:bg-hovered">
      <div className="sticky left-0 z-10 flex w-80 shrink-0 items-center gap-2 border-r border-line bg-white px-3" style={{ paddingLeft: 12 + depth * 24 }}>
        {onToggle ? (
          <button type="button" aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} the issues of ${issue.title}`} onClick={onToggle} className="rounded p-0.5 text-ink-subtle hover:bg-neutral-fill">
            <ChevronDown size={14} aria-hidden="true" className={cx('transition-transform', !open && '-rotate-90')} />
          </button>
        ) : <span className="w-5 shrink-0" />}
        <IssueTypeIcon type={issue.type} />
        <button type="button" onClick={() => onOpen(key)} className="min-w-0 flex-1 truncate text-left text-sm text-ink hover:underline">
          <span className="mr-1.5 text-ink-subtle">{key}</span>{issue.title}
        </button>
        <Lozenge tone={cat} className="hidden xl:inline-flex">{statusColumn(board, issue)?.title}</Lozenge>
      </div>
      <div className="relative shrink-0" style={{ width: DAYS * DAY_W }}>
        {span && clippedWidth > 0 && (
          <button
            type="button"
            onClick={() => onOpen(key)}
            title={`${key}: ${formatShortDay(span.start)} – ${formatShortDay(span.end)}`}
            className={cx('absolute top-2 h-6 truncate rounded px-2 text-left text-[12px] font-medium text-white shadow-sm hover:brightness-110', issue.type === 'epic' ? 'bg-[#8270db]' : BAR[cat])}
            style={{ left: clippedLeft * DAY_W + 2, width: clippedWidth * DAY_W - 4 }}
          >
            {issue.title}
          </button>
        )}
        {!span && <span className="absolute top-2.5 left-3 text-[12px] text-ink-subtlest">No due date</span>}
      </div>
    </div>
  );
}

/**
 * A project's Timeline (/boards/:id/timeline): its epics, each unfolding into its issues, then the
 * issues in no epic, as bars from start (or created) to due over eight weeks — today marked, the
 * range moved a week at a time. A click opens the issue; dates are set in its Details.
 */
export function ProjectTimeline() {
  const { id } = useParams();
  const store = useBoardStore();
  const board = store.boards.find((b) => b.id === id);
  const route = useIssueRoute(store.boards, board);
  const today = todayISO();
  const [from, setFrom] = useState(() => addDays(weekStart(today), -7));
  const [folded, setFolded] = useState(() => new Set());
  if (!board) {
    return <EmptyState className="m-auto" title="This project doesn’t exist" description="It may have been deleted, or the link is wrong." action={<Button variant="primary" to="/boards">View all projects</Button>} />;
  }
  const days = dayRange(from, DAYS);
  const epics = epicsOf(board);
  const loose = board.issues.filter((i) => i.type !== 'epic' && !epics.some((e) => e.id === i.epicId));
  const todayAt = daysBetween(from, today);
  const toggle = (eid) => setFolded((f) => { const n = new Set(f); if (n.has(eid)) n.delete(eid); else n.add(eid); return n; });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProjectHeader board={board} />
      <div className="flex items-center gap-2 px-4 py-3 md:px-8">
        <Button onClick={() => setFrom(addDays(weekStart(today), -7))}>Today</Button>
        <IconButton icon={ChevronLeft} label="Earlier" onClick={() => setFrom((f) => addDays(f, -7))} />
        <IconButton icon={ChevronRight} label="Later" onClick={() => setFrom((f) => addDays(f, 7))} />
        <span className="ml-1 text-sm text-ink-subtle">{formatShortDay(days[0])} – {formatShortDay(days.at(-1))}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-8 md:px-8">
        <div className="relative w-max min-w-full rounded-md border border-line">
          <div className="sticky top-0 z-20 flex border-b border-line bg-white">
            <div className="sticky left-0 z-10 flex w-80 shrink-0 items-center border-r border-line bg-white px-3 text-[12px] font-semibold text-ink-subtle">Issue</div>
            <div className="flex">
              {days.map((d) => (
                <div key={d} className={cx('flex h-9 shrink-0 flex-col items-center justify-center border-l border-line-subtle text-[11px]', d === today ? 'font-bold text-brand' : 'text-ink-subtlest')} style={{ width: DAY_W }}>
                  {Number(d.slice(8)) === 1 || d === days[0]
                    ? <span className="whitespace-nowrap font-semibold text-ink-subtle">{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span>
                    : <span>{Number(d.slice(8))}</span>}
                </div>
              ))}
            </div>
          </div>
          {todayAt !== null && todayAt >= 0 && todayAt < DAYS && (
            <span aria-hidden="true" className="pointer-events-none absolute top-0 bottom-0 z-0 w-0.5 bg-brand/70" style={{ left: 320 + todayAt * DAY_W + DAY_W / 2 }} />
          )}
          {epics.map((e) => {
            const open = !folded.has(e.id);
            return (
              <div key={e.id}>
                <Row board={board} issue={e} span={epicSpan(board, e)} from={from} open={open} onToggle={() => toggle(e.id)} onOpen={route.open} />
                {open && childrenOf(board, e.id).map((c) => <Row key={c.id} board={board} issue={c} span={spanOf(c)} from={from} depth={1} onOpen={route.open} />)}
              </div>
            );
          })}
          {loose.map((i) => <Row key={i.id} board={board} issue={i} span={spanOf(i)} from={from} onOpen={route.open} />)}
          {board.issues.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-subtlest">No issues yet.</p>}
        </div>
      </div>
      <IssueHost route={route} />
    </div>
  );
}
