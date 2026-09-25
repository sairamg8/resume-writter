import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useBoardStore } from '@/hooks/useBoardStore';
import { Button, EmptyState, IconButton, cx } from '@/components/ui';
import { useWorkspace } from '@/components/shell';
import { BoardToolbar, EMPTY_FILTERS } from '@/components/board/BoardToolbar';
import { ProjectHeader } from '@/components/board/ProjectTabs';
import { IssueHost, useIssueRoute } from '@/components/board/useIssueActions';
import { IssueTypeIcon } from '@/components/tracker/TrackerIcons';
import { filterIssues } from '@/utils/boardQuery';
import { isIssueDone, issueKey, todayISO } from '@/utils/boardModel';
import { monthWeeks, shiftMonth } from '@/utils/calendarGrid';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_IN_DAY = 3;

/**
 * A project's Calendar (/boards/:id/calendar): a month of weeks with each issue on its due date,
 * filtered by the toolbar — a click opens it, "+" on a day creates one due that day. Issues with
 * no due date are counted under the grid.
 */
export function ProjectCalendar() {
  const { id } = useParams();
  const store = useBoardStore();
  const workspace = useWorkspace();
  const board = store.boards.find((b) => b.id === id);
  const route = useIssueRoute(store.boards, board);
  const today = todayISO();
  const [month, setMonth] = useState(() => `${today.slice(0, 7)}-01`);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [expanded, setExpanded] = useState(null);
  if (!board) {
    return <EmptyState className="m-auto" title="This project doesn’t exist" description="It may have been deleted, or the link is wrong." action={<Button variant="primary" to="/boards">View all projects</Button>} />;
  }
  const issues = filterIssues(board, filters);
  const byDay = new Map();
  for (const i of issues) if (i.due) byDay.set(i.due, [...(byDay.get(i.due) ?? []), i]);
  const undated = issues.filter((i) => !i.due).length;
  const title = new Date(`${month}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProjectHeader board={board} />
      <BoardToolbar board={board} filters={filters} onChange={setFilters} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 pb-8 md:px-8">
        <div className="flex items-center gap-2">
          <Button size="md" onClick={() => setMonth(`${today.slice(0, 7)}-01`)}>Today</Button>
          <IconButton icon={ChevronLeft} label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))} />
          <IconButton icon={ChevronRight} label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))} />
          <h2 className="ml-1 text-lg font-semibold text-ink" aria-live="polite">{title}</h2>
          {undated > 0 && <span className="ml-auto text-[13px] text-ink-subtlest">{undated} issue{undated === 1 ? ' has' : 's have'} no due date</span>}
        </div>
        <div role="grid" aria-label={`${title} calendar`} className="min-w-[48rem] overflow-hidden rounded-md border border-line">
          <div role="row" className="grid grid-cols-7 border-b border-line bg-sunken">
            {WEEKDAYS.map((d) => <div key={d} role="columnheader" className="px-2 py-1.5 text-[12px] font-semibold uppercase text-ink-subtle">{d}</div>)}
          </div>
          {monthWeeks(month).map((week) => (
            <div key={week[0].iso} role="row" className="grid grid-cols-7 border-b border-line last:border-b-0">
              {week.map((day) => {
                const list = byDay.get(day.iso) ?? [];
                const open = expanded === day.iso;
                const shown = open ? list : list.slice(0, MAX_IN_DAY);
                const isToday = day.iso === today;
                return (
                  <div key={day.iso} role="gridcell" aria-label={day.iso} className={cx('group/day relative flex min-h-28 flex-col gap-1 border-r border-line p-1.5 last:border-r-0', !day.inMonth && 'bg-sunken/70')}>
                    <div className="flex items-center justify-between">
                      <span className={cx('flex size-6 items-center justify-center rounded-full text-[12px]', isToday ? 'bg-brand font-semibold text-white' : day.inMonth ? 'text-ink' : 'text-ink-subtlest')}>
                        {Number(day.iso.slice(8))}
                      </span>
                      <IconButton icon={Plus} label={`Create an issue due ${day.iso}`} size="sm" tooltip={false} onClick={() => workspace?.openCreate({ boardId: board.id, due: day.iso })} className="opacity-0 group-hover/day:opacity-100 no-hover:opacity-100 focus-visible:opacity-100" />
                    </div>
                    {shown.map((i) => {
                      const key = issueKey(board, i);
                      const done = isIssueDone(board, i);
                      return (
                        <button key={i.id} type="button" onClick={() => route.open(key)} title={`${key} ${i.title}`} className={cx('flex min-w-0 items-center gap-1.5 rounded border border-line bg-white px-1.5 py-0.5 text-left text-[12px] shadow-[0_1px_1px_#091e4220] hover:bg-hovered', done && 'text-ink-subtlest line-through')}>
                          <IssueTypeIcon type={i.type} size={12} decorative />
                          <span className="truncate">{i.title}</span>
                        </button>
                      );
                    })}
                    {list.length > MAX_IN_DAY && (
                      <button type="button" onClick={() => setExpanded(open ? null : day.iso)} className="self-start rounded px-1 text-[12px] font-medium text-ink-subtle hover:bg-neutral-fill">
                        {open ? 'Show less' : `+${list.length - MAX_IN_DAY} more`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <IssueHost route={route} />
    </div>
  );
}
