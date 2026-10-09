import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlignLeft, ExternalLink, Info, LayoutList, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { jobsNow, useJobStore } from '@/hooks/useJobStore';
import { JOB_SOURCES, JOB_STATUSES, WORK_MODES } from '@/constants/jobs';
import { Avatar, Button, DatePill, EmptyState, IconButton, Menu, ProgressBar, TabCount, buttonClass, useConfirmOptional, useToast } from '@/components/ui';
import { tabClass } from '@/components/ui/Tabs.jsx';
import { PageHeader } from '@/components/shell';
import { StatusMenu } from '@/components/tracker/Lozenge';
import { TasksTab } from '@/components/job/TasksTab';
import { OverviewTab } from '@/components/job/OverviewTab';
import { NotesTab } from '@/components/job/NotesTab';
import { JobsNotSavedAlert } from '@/components/job/JobsNotSavedAlert';
import { jobTone } from '@/components/job/jobTone';
import { isOpen, linkedResume } from '@/utils/jobQuery';
import { safeHref } from '@/utils/richText';
import { formatDateTime, parseISODay, relativeTime } from '@/utils/uiFormat';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'tasks',    label: 'Tasks',    icon: LayoutList },
  { id: 'notes',    label: 'Notes',    icon: AlignLeft },
];

const nameIn = (list, id) => list.find((x) => x.id === id)?.label ?? '';

/** A day's pill; a day no pill can read (an imported 'next week') as it is written, not a blank row. */
const dayOf = (value, pill) => value && (parseISODay(value) ? pill : value);

/** One row of the Details box: its name, and the value (or "None"). */
function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-2 px-1 py-1.5">
      <span className="text-[13px] font-semibold text-ink-subtle">{label}</span>
      <span className="min-w-0 truncate text-sm text-ink">{children || <span className="text-ink-subtlest">None</span>}</span>
    </div>
  );
}

/**
 * One job, laid out like a tracker issue: the company and role with the page's actions (edit,
 * open the posting, delete), the Overview · Tasks · Notes tabs on the left, and on the right the
 * status button and the Details box (applied, deadline, follow-up, location, work mode, salary,
 * contact, source, résumé), the tasks' progress and when it was created and updated.
 */
export function JobDetail({ store }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { jobs, persistError, updateJob, changeStatus, undoStatus, deleteJob, restoreJob } = useJobStore();
  const confirm = useConfirmOptional();
  const { toast } = useToast();
  const { appState } = store;
  const resumes = appState.resumes;
  const [activeTab, setActiveTab] = useState('tasks');

  const job = jobs.find(j => j.id === id);

  if (!job) {
    return <EmptyState className="m-auto" title="Job not found" description="It may have been deleted, or the link is wrong." action={<Button variant="primary" to="/jobs">← Back to Job Tracker</Button>} />;
  }

  function set(key, val) {
    if (key === 'status') moveStatus(val);
    else updateJob(job.id, { [key]: val });
  }
  // A click on a stepper step or the status menu offers Undo: moving back by hand left a false
  // history entry and an applied date, and the Summary counted the job at that step (R5-HUNT7).
  function moveStatus(status) {
    const change = changeStatus(job.id, status);
    if (!change) return;
    const label = JOB_STATUSES.find(s => s.id === change.after.status)?.label || change.after.status;
    toast({ title: `Moved to ${label}`, action: { label: 'Undo', onClick: () => undoStatus(change) } });
  }
  // The tasks as stored now: an Undo on a deleted task can be clicked after the Tasks tab that did
  // the delete has gone (another tab opened, then Tasks again), and must not write back the list
  // it last saw over the tasks added or ticked since (useRemoveWithUndo).
  const todosNow = () => {
    const stored = jobsNow().find((j) => j.id === job.id);
    return stored ? stored.todos || [] : undefined;
  };

  async function remove() {
    const name = job.company || 'this job';
    if (!await confirm({ title: `Delete ${name}?`, body: 'The application, its tasks and notes will be deleted. You can undo this for a few seconds.', confirmLabel: 'Delete', tone: 'danger' })) return;
    const removed = deleteJob(job.id);
    navigate('/jobs');
    toast({ title: `${name} deleted`, action: removed ? { label: 'Undo', onClick: () => restoreJob(removed.job, removed.index) } : undefined });
  }

  const todos = job.todos || [];
  const doneTodos = todos.filter(t => t.done).length;
  // { state, resume }: the résumé itself only when it is still there (J-21).
  const link = linkedResume(job, resumes);
  // A closed job (on hold, rejected, withdrawn) has nothing to chase: its dates are never late.
  const closed = !isOpen(job);
  const statuses = JOB_STATUSES.map((s) => ({ id: s.id, name: s.label, category: jobTone(s.id) }));

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        breadcrumbs={[{ label: 'Job Tracker', to: '/jobs' }, { label: job.company || 'Untitled Company' }]}
        title={job.company || 'Untitled Company'}
        subtitle={job.role || 'No role specified'}
        icon={<Avatar name={job.company || '?'} size="lg" shape="square" decorative />}
        actions={(
          <>
            <Button leftIcon={Pencil} onClick={() => navigate(`/jobs/${encodeURIComponent(job.id)}/edit`, { state: { fromJob: true } })} title="Edit job">Edit</Button>
            {/* A link drawn as the kit's button (buttonClass, and its icon and label as Button lays
                them out), so it matches Edit beside it, pressed state included. */}
            {safeHref(job.url) && (
              <a href={safeHref(job.url)} target="_blank" rel="noopener noreferrer" title="Open job posting" className={buttonClass()}>
                <ExternalLink size={16} className="shrink-0" aria-hidden="true" />
                <span className="truncate">Posting</span>
              </a>
            )}
            <Menu
              label="Job actions"
              items={[{ id: 'delete', label: 'Delete', icon: Trash2, danger: true, onSelect: remove }]}
              trigger={<IconButton icon={MoreHorizontal} label="Job actions" />}
            />
          </>
        )}
        tabs={(
          // The kit's tab look and count (tabClass, TabCount), as the other page headers wear; still
          // buttons marking the open tab with aria-current, not the kit's role="tab" Tabs.
          <div className="flex items-end gap-5 overflow-x-auto overflow-y-hidden">
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setActiveTab(tab.id)}
                  className={tabClass(active)}
                >
                  <Icon size={15} aria-hidden="true" />
                  {tab.label}
                  {tab.id === 'tasks' && todos.length > 0 && <TabCount>{todos.length}</TabCount>}
                </button>
              );
            })}
          </div>
        )}
      />
      <JobsNotSavedAlert error={persistError} className="px-4 pt-4 md:px-8" />

      <div className="grid gap-8 px-4 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {activeTab === 'overview' && (
            <OverviewTab job={job} set={set} resumes={resumes} navigate={navigate} />
          )}
          {activeTab === 'tasks' && (
            <TasksTab
              todos={todos}
              onChange={todos => set('todos', todos)}
              readNow={todosNow}
            />
          )}
          {activeTab === 'notes' && (
            <NotesTab job={job} set={set} />
          )}
        </div>

        {/* lg:top-40 (160 px): the page header is sticky from md and about 140 px tall with its tabs, and a sticky
            top is measured from the scroll box's top edge, so top-4 parked the box's first 120 px under the header.
            The column is about 500 px tall, so on a short window (a 720 px laptop) its lower rows would sit below the
            fold until the page's end: it is as high as the room left under the top bar and the header (14.5rem: 3.5
            + 10 + 1 spare) and scrolls inside that. The menus it opens are portals, so they are not clipped. */}
        <aside aria-label="Job details" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-40 lg:max-h-[calc(100dvh-14.5rem)] lg:self-start lg:overflow-y-auto">
          <StatusMenu value={job.status} options={statuses} onChange={(status) => set('status', status)} className="self-start" />
          <section className="rounded-cv-card border border-cv-hairline">
            <h2 className="border-b border-cv-hairline px-3 py-2.5 text-sm font-semibold text-ink">Details</h2>
            <div className="flex flex-col px-2 py-1.5">
              <Row label="Applied">{dayOf(job.appliedDate, <DatePill value={job.appliedDate} kind="plain" size="sm" />)}</Row>
              <Row label="Deadline">{dayOf(job.deadline, <DatePill value={job.deadline} done={closed} size="sm" />)}</Row>
              <Row label="Follow up">{dayOf(job.followUpDate, <DatePill value={job.followUpDate} done={closed} size="sm" />)}</Row>
              <Row label="Location">{job.location}</Row>
              <Row label="Work mode">{nameIn(WORK_MODES, job.workMode)}</Row>
              <Row label="Salary">{job.salary}</Row>
              <Row label="Contact">{job.contact}</Row>
              <Row label="Source">{nameIn(JOB_SOURCES, job.source)}</Row>
              <Row label="Résumé">{link.state === 'linked' ? (link.resume.name || 'Untitled') : link.state === 'deleted' ? 'Résumé deleted' : null}</Row>
            </div>
            {todos.length > 0 && (
              <div className="border-t border-cv-hairline px-3 py-3">
                <p className="mb-1.5 flex justify-between text-[12px] font-semibold text-ink-subtle"><span>Tasks</span><span>{doneTodos} of {todos.length} done</span></p>
                <ProgressBar value={doneTodos} max={todos.length} autoTone label="Tasks done" valueText={`${doneTodos} of ${todos.length} done`} />
              </div>
            )}
          </section>
          <div className="flex flex-col gap-0.5 px-1 text-[12px] text-ink-subtlest">
            {job.createdAt && <p>Created <time title={formatDateTime(job.createdAt)}>{relativeTime(job.createdAt)}</time></p>}
            {job.updatedAt && <p>Updated <time title={formatDateTime(job.updatedAt)}>{relativeTime(job.updatedAt)}</time></p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
