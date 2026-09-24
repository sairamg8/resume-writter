import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useBoardStore } from '@/hooks/useBoardStore';
import { PageHeader } from '@/components/shell/PageHeader';
import { BoardStorageNotice } from '@/components/board/BoardStorageNotice';
import { yourWork } from '@/utils/boardQuery';
import { isIssueDone, statusColumn } from '@/utils/boardModel';

/** The sections, in order: boardQuery.yourWork's buckets, and what each is called here. */
const SECTIONS = [
  { id: 'overdue', title: 'Overdue', tone: 'text-red-700' },
  { id: 'today', title: 'Due today', tone: 'text-amber-700' },
  { id: 'week', title: 'Due this week', tone: 'text-gray-900' },
  { id: 'inProgress', title: 'In progress', tone: 'text-gray-900' },
  { id: 'recent', title: 'Recently updated', tone: 'text-gray-900' },
];

/** One issue: key, title, its project, status and due date; opens it on its board, or marks it done. */
function WorkRow({ row, onOpen, onDone }) {
  const { board, issue, key } = row;
  const done = isIssueDone(board, issue);
  return (
    <li data-issue={issue.id} className="flex items-center gap-3 px-3 py-2">
      <button onClick={onOpen} className="flex-1 min-w-0 flex items-center gap-3 text-left hover:bg-gray-50 rounded-lg px-1 py-0.5" title={`Open ${key} on its board`}>
        <span className="text-[11px] font-mono text-gray-400 shrink-0">{key}</span>
        <span className={`flex-1 min-w-0 text-sm truncate ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{issue.title}</span>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-gray-500 shrink-0 max-w-[9rem]">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: board.color }} />
          <span className="truncate">{board.title}</span>
        </span>
        <span className="text-[11px] text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 shrink-0">{statusColumn(board, issue)?.title}</span>
        {issue.due && <span className="text-[11px] text-gray-400 shrink-0 w-20 text-right">{issue.due}</span>}
      </button>
      {!done && board.columns.some((c) => c.category === 'done') && (
        <button onClick={onDone} aria-label={`Mark ${key} done`} title="Mark done" className="p-1 text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 rounded shrink-0">
          <Check size={14} />
        </button>
      )}
    </li>
  );
}

/**
 * "Your work" (/work): what needs doing across every project (boardQuery.yourWork) — overdue, due
 * today, due this week, in progress — and the issues updated last. An issue opens on its board
 * (`?issue=KEY-N` opens its card), or is marked done here (into its project's first done column).
 * Epics hold issues rather than being work themselves, so they are left out, as on the board.
 */
export function YourWork() {
  const navigate = useNavigate();
  const store = useBoardStore();
  const boards = store.boards.map((b) => ({ ...b, issues: b.issues.filter((i) => i.type !== 'epic') }));
  const work = yourWork(boards);
  const open = SECTIONS.slice(0, 4).reduce((n, s) => n + work[s.id].length, 0);

  function markDone({ board, issue }) {
    const column = board.columns.find((c) => c.category === 'done');
    if (column) store.moveIssue(board.id, issue.id, { columnId: column.id });
  }

  return (
    <div className="flex flex-col min-h-full bg-[#f5f3ef]">
      <PageHeader title="Your work" subtitle={open ? `${open} issue${open === 1 ? '' : 's'} need attention across ${store.boards.length} project${store.boards.length === 1 ? '' : 's'}` : undefined} />
      <BoardStorageNotice persistError={store.persistError} recovery={store.recovery} onDismissRecovery={store.dismissRecovery} className="max-w-4xl w-full mx-auto px-4 sm:px-6 pt-3" />

      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-5 space-y-4">
        {work.recent.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm font-medium text-gray-500 mb-1">Nothing here yet</p>
            <p className="text-xs text-gray-400 mb-4">Issues due soon and in progress across your projects gather here.</p>
            <button onClick={() => navigate('/boards')} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Open projects</button>
          </div>
        ) : (
          <>
            {open === 0 && <p className="text-sm text-gray-500">Nothing overdue, due this week or in progress. Well done.</p>}
            {SECTIONS.filter((s) => work[s.id].length > 0).map((section) => (
              <section key={section.id} data-section={section.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
                  <h2 className={`text-sm font-semibold px-1 ${section.tone}`}>{section.title}</h2>
                  <span className="text-[11px] text-gray-400">{work[section.id].length}</span>
                </div>
                <ul className="divide-y divide-gray-100">
                  {work[section.id].map((row) => (
                    <WorkRow
                      key={`${row.board.id}-${row.issue.id}`}
                      row={row}
                      onOpen={() => navigate(`/boards/${encodeURIComponent(row.board.id)}?issue=${encodeURIComponent(row.key)}`)}
                      onDone={() => markDone(row)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
