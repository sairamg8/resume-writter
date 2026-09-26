import { Link, useParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, PencilLine, PlusCircle } from 'lucide-react';
import { useBoardStore } from '@/hooks/useBoardStore';
import { Avatar, Button, EmptyState, ProgressBar } from '@/components/ui';
import { BoardStorageNotice } from '@/components/board/BoardStorageNotice';
import { ProjectHeader } from '@/components/board/ProjectTabs';
import { IssueHost, useIssueRoute } from '@/components/board/useIssueActions';
import { ColumnBars, Donut, ShareBars } from '@/components/tracker/Charts';
import { IssueTypeIcon, PriorityIcon } from '@/components/tracker/TrackerIcons';
import { projectSummary } from '@/utils/projectSummary';
import { describeActivity } from '@/utils/issueHistory';
import { relativeTime } from '@/utils/uiFormat';

const CATEGORY_COLORS = { todo: '#8590a2', inprogress: '#1d7afc', done: '#22a06b' };

function Stat({ icon: Icon, tone, value, label, hint }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-white p-4">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon size={20} aria-hidden="true" /></span>
      <div className="min-w-0">
        <p className="text-sm text-ink"><span className="font-semibold">{value} {label}</span></p>
        <p className="text-[12px] text-ink-subtlest">{hint}</p>
      </div>
    </div>
  );
}

function Card({ title, description, children, className = '' }) {
  return (
    <section className={`flex flex-col gap-4 rounded-md border border-line bg-white p-5 ${className}`}>
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="text-[13px] text-ink-subtle">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * A project's Summary (/boards/:id/summary): the last 7 days at a glance (done, updated, created,
 * due soon), the status overview, the priority breakdown, the types of work, the epics' progress
 * and the latest changes — each opening the issue it names.
 */
export function ProjectSummary() {
  const { id } = useParams();
  const store = useBoardStore();
  const board = store.boards.find((b) => b.id === id);
  const route = useIssueRoute(store.boards, board);
  if (!board) {
    return <EmptyState className="m-auto" title="This project doesn’t exist" description="It may have been deleted, or the link is wrong." action={<Button variant="primary" to="/boards">View all projects</Button>} />;
  }
  const s = projectSummary(board);
  const base = `/boards/${encodeURIComponent(board.id)}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProjectHeader board={board} />
      <BoardStorageNotice persistError={store.persistError} recovery={store.recovery} onDismissRecovery={store.dismissRecovery} className="px-4 pt-3 md:px-8" />
      <div className="flex flex-1 flex-col gap-4 bg-sunken px-4 py-6 md:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={CheckCircle2} tone="bg-loz-done text-loz-done-ink" value={s.completed} label="completed" hint="in the last 7 days" />
          <Stat icon={PencilLine} tone="bg-loz-progress text-loz-progress-ink" value={s.updated} label="updated" hint="in the last 7 days" />
          <Stat icon={PlusCircle} tone="bg-[#dfd8fd] text-[#5e4db2]" value={s.created} label="created" hint="in the last 7 days" />
          <Stat icon={CalendarClock} tone="bg-[#f8e6a0] text-[#7f5f01]" value={s.dueSoon} label="due soon" hint="in the next 7 days" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Status overview" description={<>The status of your issues. <Link className="text-brand hover:underline" to={`${base}/list`}>View all issues</Link></>}>
            <Donut
              caption="total issues"
              parts={[
                { id: 'todo', label: 'To do', value: s.byCategory.todo, color: CATEGORY_COLORS.todo },
                { id: 'inprogress', label: 'In progress', value: s.byCategory.inprogress, color: CATEGORY_COLORS.inprogress },
                { id: 'done', label: 'Done', value: s.byCategory.done, color: CATEGORY_COLORS.done },
              ]}
            />
          </Card>
          <Card title="Recent activity" description="Stay up to date with what’s happening across the project.">
            {s.recent.length === 0 ? <p className="text-sm text-ink-subtlest">Nothing has happened yet.</p> : (
              <ul className="flex flex-col gap-3">
                {s.recent.map(({ issue, key, entry }) => {
                  const d = describeActivity(entry);
                  return (
                    <li key={`${issue.id}-${entry.id}`} className="flex gap-3 text-sm">
                      <Avatar name="You" size="sm" decorative />
                      <p className="min-w-0 text-ink">
                        <span className="font-semibold">You</span> {d.text}{d.to !== null && <> to <span className="font-medium">{d.to}</span></>} on{' '}
                        <button type="button" onClick={() => route.open(key)} className="inline-flex items-center gap-1 align-bottom font-medium text-brand hover:underline">
                          <IssueTypeIcon type={issue.type} size={14} decorative />{key}: {issue.title}
                        </button>
                        <span className="ml-1.5 text-[12px] text-ink-subtlest">{relativeTime(entry.at)}</span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card title="Priority breakdown" description="A holistic view of how work is being prioritized.">
            <ColumnBars bars={s.byPriority.map((p) => ({ id: p.id, label: p.name, value: p.count, icon: <PriorityIcon priority={p.id} decorative /> }))} />
          </Card>
          <Card title="Types of work" description="A breakdown of issues by their types.">
            <ShareBars rows={s.byType.map((t) => ({ id: t.id, label: t.name, share: t.share, count: t.count, icon: <IssueTypeIcon type={t.id} decorative /> }))} />
          </Card>
          <Card title="Epic progress" description="See how your epics are progressing at a glance." className="lg:col-span-2">
            {s.epics.length === 0 ? <p className="text-sm text-ink-subtlest">No epics yet. Create one to group the issues of a bigger piece of work.</p> : (
              <ul className="flex flex-col gap-3">
                {s.epics.map((e) => (
                  <li key={e.issue.id} className="grid items-center gap-3 sm:grid-cols-[16rem_1fr_7rem]">
                    <button type="button" onClick={() => route.open(e.key)} className="flex min-w-0 items-center gap-2 text-left text-sm text-ink hover:underline">
                      <IssueTypeIcon type="epic" decorative /><span className="truncate">{e.issue.title}</span>
                    </button>
                    <ProgressBar value={e.done} max={Math.max(e.total, 1)} autoTone label={`${e.issue.title} progress`} valueText={`${e.done} of ${e.total} done`} />
                    <span className="text-[13px] text-ink-subtle">{e.done} of {e.total} done</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <IssueHost route={route} />
    </div>
  );
}
