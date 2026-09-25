import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useBoardStore } from '@/hooks/useBoardStore';
import { Button, DatePill, EmptyState, cx } from '@/components/ui';
import { BoardStorageNotice } from '@/components/board/BoardStorageNotice';
import { BoardToolbar, EMPTY_FILTERS } from '@/components/board/BoardToolbar';
import { ProjectHeader } from '@/components/board/ProjectTabs';
import { InlineCreate } from '@/components/board/InlineCreate';
import { EpicLozenge, LabelPill } from '@/components/board/IssueFields';
import { IssueHost, useIssueRoute } from '@/components/board/useIssueActions';
import { StatusMenu } from '@/components/tracker/Lozenge';
import { IssueTypeIcon, Points, PriorityIcon, priorityOf } from '@/components/tracker/TrackerIcons';
import { filterIssues, sortIssues } from '@/utils/boardQuery';
import { issueKey, statusColumn } from '@/utils/boardModel';
import { relativeTime } from '@/utils/uiFormat';

const COLUMNS = [
  { id: 'type', label: 'Type', sort: 'type', className: 'w-14' },
  { id: 'key', label: 'Key', sort: 'key', className: 'w-24' },
  { id: 'title', label: 'Summary', sort: 'title', className: 'min-w-[16rem]' },
  { id: 'status', label: 'Status', sort: 'status', className: 'w-40' },
  { id: 'priority', label: 'Priority', sort: 'priority', className: 'w-28' },
  { id: 'labels', label: 'Labels', className: 'w-44' },
  { id: 'epic', label: 'Parent', className: 'w-44' },
  { id: 'due', label: 'Due date', sort: 'due', className: 'w-32' },
  { id: 'estimate', label: 'Points', sort: 'estimate', className: 'w-20' },
  { id: 'updated', label: 'Updated', sort: 'updated', className: 'w-28' },
];

/** A header cell: a sort button with its direction (aria-sort on the cell). */
function Th({ col, sort, onSort }) {
  const on = sort.by === col.sort;
  return (
    <th scope="col" aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} className={cx('h-9 border-b border-line bg-white px-2 text-left text-[12px] font-semibold text-ink-subtle', col.className)}>
      {col.sort ? (
        <button type="button" onClick={() => onSort(col.sort)} className="inline-flex items-center gap-1 rounded px-1 hover:bg-neutral-fill hover:text-ink">
          {col.label}
          {on && (sort.dir === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
        </button>
      ) : <span className="px-1">{col.label}</span>}
    </th>
  );
}

/**
 * A project's List (/boards/:id/list): every issue — done ones and epics too — as a sortable
 * table, filtered by the toolbar; the status changes in place, a row opens its issue, and new
 * issues are created at the foot.
 */
export function ProjectList() {
  const { id } = useParams();
  const store = useBoardStore();
  const board = store.boards.find((b) => b.id === id);
  const route = useIssueRoute(store.boards, board);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState({ by: 'rank', dir: 'asc' });
  if (!board) {
    return <EmptyState className="m-auto" title="This project doesn’t exist" description="It may have been deleted, or the link is wrong." action={<Button variant="primary" to="/boards">View all projects</Button>} />;
  }
  const statuses = board.columns.map((c) => ({ id: c.id, name: c.title || 'Untitled', category: c.category }));
  const rows = sortIssues(board, filterIssues(board, filters), sort.by, sort.dir);
  const onSort = (by) => setSort((s) => (s.by === by ? (s.dir === 'asc' ? { by, dir: 'desc' } : { by: 'rank', dir: 'asc' }) : { by, dir: 'asc' }));
  const epicOf = (i) => (i.epicId ? board.issues.find((e) => e.id === i.epicId) : null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProjectHeader board={board} />
      <BoardStorageNotice persistError={store.persistError} recovery={store.recovery} onDismissRecovery={store.dismissRecovery} className="px-4 pt-3 md:px-8" />
      <BoardToolbar board={board} filters={filters} onChange={setFilters} right={<span className="text-[13px] text-ink-subtlest">{rows.length} of {board.issues.length} issues</span>} />
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-8 md:px-8">
        <table className="w-full min-w-[64rem] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Issues of {board.title}</caption>
          <thead className="sticky top-0 z-10">
            <tr>{COLUMNS.map((col) => <Th key={col.id} col={col} sort={sort} onSort={onSort} />)}</tr>
          </thead>
          <tbody>
            {rows.map((issue) => {
              const key = issueKey(board, issue);
              const column = statusColumn(board, issue);
              const done = column?.category === 'done';
              const labels = issue.labelIds.map((l) => board.labels.find((x) => x.id === l)).filter(Boolean);
              const epic = epicOf(issue);
              return (
                <tr key={issue.id} className="group h-10 hover:bg-hovered">
                  <td className="border-b border-line-subtle px-3"><IssueTypeIcon type={issue.type} /></td>
                  <td className={cx('border-b border-line-subtle px-2 text-ink-subtle', done && 'line-through')}>{key}</td>
                  <td className="border-b border-line-subtle px-2">
                    <button type="button" onClick={() => route.open(key)} className="max-w-full truncate text-left text-ink hover:text-brand hover:underline">{issue.title}</button>
                  </td>
                  <td className="border-b border-line-subtle px-2">
                    <StatusMenu size="sm" value={column?.id} options={statuses} onChange={(columnId) => store.updateIssue(board.id, issue.id, { columnId })} label={`Status of ${key}`} />
                  </td>
                  <td className="border-b border-line-subtle px-2">
                    <span className="inline-flex items-center gap-1.5 text-ink"><PriorityIcon priority={issue.priority} decorative />{priorityOf(issue.priority).name}</span>
                  </td>
                  <td className="border-b border-line-subtle px-2">
                    <span className="flex gap-1 overflow-hidden">{labels.slice(0, 2).map((l) => <LabelPill key={l.id} label={l} className="max-w-[6rem]" />)}{labels.length > 2 && <span className="text-[11px] text-ink-subtlest">+{labels.length - 2}</span>}</span>
                  </td>
                  <td className="border-b border-line-subtle px-2">{epic && <EpicLozenge title={epic.title} className="max-w-[10rem]" />}</td>
                  <td className="border-b border-line-subtle px-2">{issue.due && <DatePill value={issue.due} done={done} size="sm" />}</td>
                  <td className="border-b border-line-subtle px-2"><Points value={issue.estimate} /></td>
                  <td className="border-b border-line-subtle px-2 text-[13px] text-ink-subtle">{relativeTime(issue.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-10 text-center text-sm text-ink-subtlest">{board.issues.length ? 'No issues match these filters.' : 'No issues yet. Create the first one below.'}</p>}
        <div className="mt-1 max-w-xl">
          <InlineCreate variant="row" onCreate={({ title, type }) => store.addIssue(board.id, { title, type })} />
        </div>
      </div>
      <IssueHost route={route} />
    </div>
  );
}
