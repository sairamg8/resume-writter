import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlignLeft, ExternalLink, Info, LayoutList, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useJobStore } from '@/hooks/useJobStore';
import { JOB_SOURCES, JOB_STATUSES, WORK_MODES } from '@/constants/jobs';
import { Avatar, Button, DatePill, EmptyState, IconButton, Menu, ProgressBar, cx, useConfirmOptional, useToast } from '@/components/ui';
import { PageHeader } from '@/components/shell';
import { StatusMenu } from '@/components/tracker/Lozenge';
import { TasksTab } from '@/components/job/TasksTab';
import { OverviewTab } from '@/components/job/OverviewTab';
import { NotesTab } from '@/components/job/NotesTab';
import { JobsNotSavedAlert } from '@/components/job/JobsNotSavedAlert';
import { jobTone } from '@/components/job/jobTone';
import { linkedResume } from '@/utils/jobQuery';
import { safeHref } from '@/utils/richText';
import { formatDateTime, relativeTime } from '@/utils/uiFormat';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'tasks',    label: 'Tasks',    icon: LayoutList },
  { id: 'notes',    label: 'Notes',    icon: AlignLeft },
];

const nameIn = (list, id) => list.find((x) => x.id === id)?.label ?? '';

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
  const { jobs, persistError, updateJob, deleteJob, restoreJob } = useJobStore();
  const confirm = useConfirmOptional();
  const { toast } = useToast();
  const { appState } = store;
  const resumes = appState.resumes;
  const [activeTab, setActiveTab] = useState('tasks');

  const job = jobs.find(j => j.id === id);

  if (!job) {
    return <EmptyState className="m-auto" title="Job not found" description="It may have been deleted, or the link is wrong." action={<Button variant="primary" to="/jobs">← Back to Job Tracker</Button>} />;
  }

  function set(key, val) { updateJob(job.id, { [key]: val }); }

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
  const statuses = JOB_STATUSES.map((s) => ({ id: s.id, name: s.label, category: jobTone(s.id) }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        breadcrumbs={[{ label: 'Job Tracker', to: '/jobs' }, { label: job.company || 'Untitled Company' }]}
        title={job.company || 'Untitled Company'}
        subtitle={job.role || 'No role specified'}
        icon={<Avatar name={job.company || '?'} size="lg" shape="square" decorative />}
        actions={(
          <>
            <Button leftIcon={Pencil} onClick={() => navigate(`/jobs/${job.id}/edit`)} title="Edit job">Edit</Button>
            {safeHref(job.url) && (
              <a href={safeHref(job.url)} target="_blank" rel="noopener noreferrer" title="Open job posting" className="inline-flex h-8 items-center gap-2 rounded bg-neutral-fill px-3 text-sm font-medium text-ink-subtle transition-colors hover:bg-neutral-fill-hover hover:text-ink">
                <ExternalLink size={16} aria-hidden="true" /> Posting
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
          <div className="flex items-end gap-5 overflow-x-auto">
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setActiveTab(tab.id)}
                  className={cx(
                    'relative flex h-10 shrink-0 items-center gap-1.5 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full',
                    active ? 'text-brand after:bg-brand' : 'text-ink-subtle hover:text-ink after:bg-transparent hover:after:bg-line',
                  )}
                >
                  <Icon size={15} aria-hidden="true" />
                  {tab.label}
                  {tab.id === 'tasks' && todos.length > 0 && (
                    <span className={cx('rounded-full px-1.5 text-[11px] font-semibold', active ? 'bg-brand-subtle-hover text-brand' : 'bg-neutral-fill-hover text-ink-subtle')}>
                      {todos.length}
                    </span>
                  )}
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
            />
          )}
          {activeTab === 'notes' && (
            <NotesTab job={job} set={set} />
          )}
        </div>

        <aside aria-label="Job details" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <StatusMenu value={job.status} options={statuses} onChange={(status) => set('status', status)} className="self-start" />
          <section className="rounded-md border border-line">
            <h2 className="border-b border-line px-3 py-2.5 text-sm font-semibold text-ink">Details</h2>
            <div className="flex flex-col px-2 py-1.5">
              <Row label="Applied">{job.appliedDate && <DatePill value={job.appliedDate} kind="plain" size="sm" />}</Row>
              <Row label="Deadline">{job.deadline && <DatePill value={job.deadline} size="sm" />}</Row>
              <Row label="Follow up">{job.followUpDate && <DatePill value={job.followUpDate} size="sm" />}</Row>
              <Row label="Location">{job.location}</Row>
              <Row label="Work mode">{nameIn(WORK_MODES, job.workMode)}</Row>
              <Row label="Salary">{job.salary}</Row>
              <Row label="Contact">{job.contact}</Row>
              <Row label="Source">{nameIn(JOB_SOURCES, job.source)}</Row>
              <Row label="Résumé">{link.state === 'linked' ? (link.resume.name || 'Untitled') : link.state === 'deleted' ? 'Résumé deleted' : null}</Row>
            </div>
            {todos.length > 0 && (
              <div className="border-t border-line px-3 py-3">
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
