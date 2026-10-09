import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useBoardStore } from '@/hooks/useBoardStore';
import { Button, DatePill, EmptyState, cx, useToast } from '@/components/ui';
import { BoardStorageNotice } from '@/components/board/BoardStorageNotice';
import { BoardToolbar, EMPTY_FILTERS } from '@/components/board/BoardToolbar';
import { ProjectHeader } from '@/components/board/ProjectTabs';
import { InlineCreate } from '@/components/board/InlineCreate';
import { EpicLozenge, LabelPill } from '@/components/board/IssueFields';
import { IssueHost, useIssueRoute } from '@/components/board/useIssueActions';
import { countLabel } from '@/utils/uiFormat';
import { StatusMenu } from '@/components/tracker/Lozenge';
import { IssueTypeIcon, Points, PriorityIcon, priorityOf } from '@/components/tracker/TrackerIcons';
import { filterIssues, sortIssues } from '@/utils/boardQuery';
import { issueKey, statusColumn } from '@/utils/boardModel';
import { boardSprint } from '@/utils/boardView';
import { relativeTime } from '@/utils/uiFormat';

/**
 * The columns a phone does without (Type, Labels, Parent, Points, Updated), in the header and every
 * row, with a narrower Summary: Status then starts about 256px in, on a 375px screen, and Priority
 * and Due date are a short pan away. Shown again from sm up.
 */
const PHONE_HIDDEN = 'hidden sm:table-cell';

const COLUMNS = [
  { id: 'type', label: 'Type', sort: 'type', className: `w-14 ${PHONE_HIDDEN}` },
  { id: 'key', label: 'Key', sort: 'key', className: 'w-24' },
  { id: 'title', label: 'Summary', sort: 'title', className: 'min-w-[10rem] sm:min-w-[16rem]' },
  { id: 'status', label: 'Status', sort: 'status', className: 'w-40' },
  { id: 'priority', label: 'Priority', sort: 'priority', className: 'w-28' },
  { id: 'labels', label: 'Labels', className: `w-44 ${PHONE_HIDDEN}` },
  { id: 'epic', label: 'Parent', className: `w-44 ${PHONE_HIDDEN}` },
  { id: 'due', label: 'Due date', sort: 'due', className: 'w-32' },
  { id: 'estimate', label: 'Points', sort: 'estimate', className: `w-20 ${PHONE_HIDDEN}` },
  { id: 'updated', label: 'Updated', sort: 'updated', className: `w-28 ${PHONE_HIDDEN}` },
];

/** A header cell: a sort button with its direction (aria-sort on the cell). */
function Th({ col, sort, onSort }) {
  const on = sort.by === col.sort;
  return (
    <th scope="col" aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} className={cx('h-9 border-b border-cv-hairline bg-cv-surface px-2 text-left text-[12px] font-semibold text-cv-muted', col.className)}>
      {col.sort ? (
        <button type="button" onClick={() => onSort(col.sort)} className="inline-flex items-center gap-1 rounded px-1 hover:bg-neutral-fill hover:text-cv-ink">
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
  const { toast } = useToast();
  if (!board) {
    return <EmptyState className="m-auto" title="This project doesn’t exist" description="It may have been deleted, or the link is wrong." action={<Button variant="primary" to="/boards">View all projects</Button>} />;
  }
  const statuses = board.columns.map((c) => ({ id: c.id, name: c.title || 'Untitled', category: c.category }));
  const rows = sortIssues(board, filterIssues(board, filters), sort.by, sort.dir);
  const onSort = (by) => setSort((s) => (s.by === by ? (s.dir === 'asc' ? { by, dir: 'desc' } : { by: 'rank', dir: 'asc' }) : { by, dir: 'asc' }));
  // A new issue the filters don't match never shows up: say it was made, and offer to open it, as
  // the Board does (R4-DUX-08), or "+ Create issue" looks like it failed (R5-HUNT3).
  const create = ({ title, type }) => {
    // Into the running sprint when sprints are on, as the board column and the Create dialog do, or it lands in the backlog and is not on the board.
    const made = store.addIssue(board.id, { title, type, sprintId: boardSprint(board)?.id ?? null });
    if (!made || filterIssues(board, filters, { issues: [made] }).length > 0) return;
    const key = issueKey(board, made);
    toast({ tone: 'success', title: `${key} created — hidden by your filters`, action: { label: 'Open', onClick: () => route.open(key) } });
  };
  const epicOf = (i) => (i.epicId ? board.issues.find((e) => e.id === i.epicId) : null);

  return (
    <div className="flex flex-1 flex-col md:min-h-0">
      <ProjectHeader board={board} />
      <BoardStorageNotice persistError={store.persistError} recovery={store.recovery} onDismissRecovery={store.dismissRecovery} className="px-4 pt-3 md:px-8" />
      <BoardToolbar board={board} filters={filters} onChange={setFilters} withEpics right={<span className="text-[13px] text-cv-faint">{rows.length} of {countLabel(board.issues.length, 'issue')}</span>} />
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-8 max-md:flex-none md:px-8">
        <table className="w-full border-separate border-spacing-0 text-sm sm:min-w-[64rem]">
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
                <tr key={issue.id} className="group h-10 hover:bg-cv-stage">
                  <td className={cx('border-b border-line-subtle px-3', PHONE_HIDDEN)}><IssueTypeIcon type={issue.type} /></td>
                  <td className={cx('whitespace-nowrap border-b border-line-subtle px-2 text-cv-muted', done && 'line-through')}>{key}</td>
                  <td className="border-b border-line-subtle px-2">
                    {/* A long summary is cut short in the cell at every width (inline-size containment:
                        it no longer sets the column's width), so it cannot push Status off screen —
                        from sm up it widened the table past its 64rem floor too (R5-JOB-06). */}
                    <button type="button" onClick={() => route.open(key)} className="w-full max-w-full truncate text-left text-cv-ink hover:text-cv-brand-text hover:underline contain-inline-size">{issue.title}</button>
                  </td>
                  <td className="border-b border-line-subtle px-2">
                    <StatusMenu size="sm" value={column?.id} options={statuses} onChange={(columnId) => store.updateIssue(board.id, issue.id, { columnId })} label={`Status of ${key}`} />
                  </td>
                  <td className="border-b border-line-subtle px-2">
                    <span className="inline-flex items-center gap-1.5 text-cv-ink"><PriorityIcon priority={issue.priority} decorative />{priorityOf(issue.priority).name}</span>
                  </td>
                  <td className={cx('border-b border-line-subtle px-2', PHONE_HIDDEN)}>
                    <span className="flex gap-1 overflow-hidden">{labels.slice(0, 2).map((l) => <LabelPill key={l.id} label={l} className="max-w-[6rem]" />)}{labels.length > 2 && <span className="text-[11px] text-cv-faint">+{labels.length - 2}</span>}</span>
                  </td>
                  <td className={cx('border-b border-line-subtle px-2', PHONE_HIDDEN)}>{epic && <EpicLozenge title={epic.title} className="max-w-[10rem]" />}</td>
                  <td className="border-b border-line-subtle px-2">{issue.due && <DatePill value={issue.due} done={done} size="sm" />}</td>
                  <td className={cx('border-b border-line-subtle px-2', PHONE_HIDDEN)}><Points value={issue.estimate} /></td>
                  <td className={cx('border-b border-line-subtle px-2 text-[13px] text-cv-muted', PHONE_HIDDEN)}>{relativeTime(issue.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-10 text-center text-sm text-cv-faint">{board.issues.length ? 'No issues match these filters.' : 'No issues yet. Create the first one below.'}</p>}
        <div className="mt-1 max-w-xl">
          <InlineCreate variant="row" onCreate={create} />
        </div>
      </div>
      <IssueHost route={route} />
    </div>
  );
}
