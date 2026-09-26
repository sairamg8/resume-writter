import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { boardsNow, useBoardStore } from '@/hooks/useBoardStore';
import { Button, DatePill, EmptyState, IconButton, TabPanel, Tabs, useToast } from '@/components/ui';
import { PageHeader } from '@/components/shell';
import { BoardStorageNotice } from '@/components/board/BoardStorageNotice';
import { ProjectAvatar } from '@/components/board/ProjectTabs';
import { IssueHost, useIssueRoute } from '@/components/board/useIssueActions';
import { Lozenge } from '@/components/tracker/Lozenge';
import { IssueTypeIcon, PriorityIcon } from '@/components/tracker/TrackerIcons';
import { issueCounts, yourWork } from '@/utils/boardQuery';
import { isIssueDone, statusColumn } from '@/utils/boardModel';
import { relativeTime } from '@/utils/uiFormat';

/** The sections of "To do", in order: boardQuery.yourWork's buckets, and what each is called here. */
const SECTIONS = [
  { id: 'overdue', title: 'Overdue' },
  { id: 'today', title: 'Due today' },
  { id: 'week', title: 'Due this week' },
  { id: 'inProgress', title: 'In progress' },
];

/** One issue: type, key, summary, its project, status, due date — opens in place; ✓ marks it done. */
function WorkRow({ row, onOpen, onDone, showUpdated }) {
  const { board, issue, key } = row;
  const column = statusColumn(board, issue);
  const done = isIssueDone(board, issue);
  return (
    <li data-issue={issue.id} className="group flex items-center gap-3 border-b border-line-subtle px-2 py-1.5 last:border-b-0 hover:bg-hovered">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" title={`Open ${key}`}>
        <IssueTypeIcon type={issue.type} />
        <span className="min-w-0 flex-1">
          <span className={done ? 'block truncate text-sm text-ink-subtlest line-through' : 'block truncate text-sm text-ink'}>{issue.title}</span>
          <span className="block truncate text-[12px] text-ink-subtlest">{key} · {board.title}</span>
        </span>
        <PriorityIcon priority={issue.priority} />
        {issue.due && <DatePill value={issue.due} done={done} size="sm" />}
        <Lozenge tone={column?.category} className="hidden sm:inline-flex">{column?.title}</Lozenge>
        {showUpdated && <span className="hidden w-20 shrink-0 text-right text-[12px] text-ink-subtlest md:block">{relativeTime(issue.updatedAt)}</span>}
      </button>
      {!done && onDone && board.columns.some((c) => c.category === 'done') && (
        <IconButton icon={Check} size="sm" label={`Mark ${key} done`} onClick={onDone} className="hover:text-loz-done-ink" />
      )}
    </li>
  );
}

/**
 * "Your work" (/work): your recent projects as cards, then To do — what needs doing across every
 * project (overdue, due today, this week, in progress; boardQuery.yourWork) — and Worked on, the
 * issues updated last. An issue opens here (`?issue=KEY-N`), or is marked done (into its
 * project's first done column, with an Undo toast). Epics hold issues rather than being work, so
 * they are left out.
 */
export function YourWork() {
  const store = useBoardStore();
  const route = useIssueRoute(store.boards);
  const { toast } = useToast();
  const [tab, setTab] = useState('todo');
  const boards = store.boards.map((b) => ({ ...b, issues: b.issues.filter((i) => i.type !== 'epic') }));
  const work = yourWork(boards);
  const open = SECTIONS.reduce((n, s) => n + work[s.id].length, 0);
  const recentProjects = [...store.boards].sort((a, b) => Number(b.starred) - Number(a.starred) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).slice(0, 4);
  // The row drops out of the list at once, so the toast is the only word of where it went — and
  // its Undo puts the issue back in the column it came from, at its old place in the rank (before
  // the issue that followed it). The move keeps the sprint, so there is none to restore. A repeating
  // issue's next occurrence, made as it was resolved, goes too while nobody has touched it — else
  // Undo would leave two; with it gone, marking the issue done again makes the next one afresh.
  function markDone({ board, issue, key }) {
    const column = board.columns.find((c) => c.category === 'done');
    if (!column) return;
    const { issues } = store.boards.find((b) => b.id === board.id) ?? board; // with its epics: the whole rank
    const beforeId = issues[issues.findIndex((i) => i.id === issue.id) + 1]?.id ?? null;
    store.moveIssue(board.id, issue.id, { columnId: column.id });
    const moved = boardsNow().find((b) => b.id === board.id)?.issues.find((i) => i.id === issue.id);
    const spawnedId = moved?.recurrenceNextId && moved.recurrenceNextId !== issue.recurrenceNextId ? moved.recurrenceNextId : null;
    function undo() {
      store.moveIssue(board.id, issue.id, { columnId: issue.columnId, beforeId });
      const spawned = spawnedId && boardsNow().find((b) => b.id === board.id)?.issues.find((i) => i.id === spawnedId);
      if (spawned && spawned.updatedAt === spawned.createdAt) store.deleteIssue(board.id, spawnedId);
    }
    toast({ title: `${key} marked done`, action: { label: 'Undo', onClick: undo } });
  }
  const row = (r, extra = {}) => <WorkRow key={`${r.board.id}-${r.issue.id}`} row={r} onOpen={() => route.open(r.key)} onDone={() => markDone(r)} {...extra} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Your work" subtitle={open ? `${open} issue${open === 1 ? '' : 's'} need attention across ${store.boards.length} project${store.boards.length === 1 ? '' : 's'}` : undefined} />
      <BoardStorageNotice persistError={store.persistError} recovery={store.recovery} onDismissRecovery={store.dismissRecovery} className="px-4 pt-3 md:px-8" />
      <div className="flex flex-col gap-6 px-4 py-4 md:px-8">
        {store.boards.length === 0 ? (
          <EmptyState title="Nothing here yet" description="Issues due soon and in progress across your projects gather here." action={<Button variant="primary" to="/boards?create=1">Create a project</Button>} />
        ) : (
          <>
            <section aria-labelledby="recent-projects">
              <div className="mb-2 flex items-center justify-between">
                <h2 id="recent-projects" className="text-sm font-semibold text-ink-subtle">Recent projects</h2>
                <Link to="/boards" className="text-sm text-brand hover:underline">View all projects</Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {recentProjects.map((b) => {
                  const counts = issueCounts(b);
                  const base = `/boards/${encodeURIComponent(b.id)}`;
                  return (
                    <div key={b.id} className="relative overflow-hidden rounded-md border border-line bg-white p-4 pl-6 shadow-[0_1px_1px_#091e4220]">
                      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-3" style={{ backgroundColor: b.color }} />
                      <div className="flex items-center gap-2.5">
                        <ProjectAvatar board={b} size={28} />
                        <div className="min-w-0">
                          <Link to={base} className="block truncate text-sm font-semibold text-ink hover:underline">{b.title}</Link>
                          <p className="text-[12px] text-ink-subtlest">{b.mode === 'scrum' ? 'Scrum' : 'Kanban'} project</p>
                        </div>
                      </div>
                      <p className="mt-3 text-[12px] font-semibold uppercase text-ink-subtle">Quick links</p>
                      <div className="mt-1 flex flex-col gap-0.5 text-sm">
                        <Link to={base} className="flex justify-between rounded px-1 py-0.5 text-ink hover:bg-hovered">Open issues <span className="rounded-full bg-neutral-fill-hover px-2 text-[12px]">{counts.open}</span></Link>
                        <Link to={`${base}/backlog`} className="rounded px-1 py-0.5 text-ink hover:bg-hovered">Backlog</Link>
                        <Link to={`${base}/summary`} className="rounded px-1 py-0.5 text-ink hover:bg-hovered">Summary</Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="flex flex-col gap-3">
              <Tabs id="your-work" aria-label="Your work" value={tab} onChange={setTab} items={[{ value: 'todo', label: 'To do', count: open || null }, { value: 'worked', label: 'Worked on' }]} />
              <TabPanel tabsId="your-work" value="todo" current={tab} className="flex flex-col gap-4">
                {open === 0 && <p className="text-sm text-ink-subtle">Nothing overdue, due this week or in progress. Well done.</p>}
                {SECTIONS.filter((s) => work[s.id].length > 0).map((s) => (
                  <section key={s.id} data-section={s.id}>
                    <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">{s.title} <span className="font-normal text-ink-subtlest">{work[s.id].length}</span></h3>
                    <ul className="rounded-md border border-line">{work[s.id].map((r) => row(r))}</ul>
                  </section>
                ))}
              </TabPanel>
              <TabPanel tabsId="your-work" value="worked" current={tab}>
                <section data-section="recent">
                  {work.recent.length === 0 ? <p className="text-sm text-ink-subtle">No issues yet.</p> : (
                    <ul className="rounded-md border border-line">{work.recent.map((r) => row(r, { showUpdated: true }))}</ul>
                  )}
                </section>
              </TabPanel>
            </section>
          </>
        )}
      </div>
      <IssueHost route={route} />
    </div>
  );
}
