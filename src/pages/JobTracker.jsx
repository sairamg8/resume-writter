import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Download, FileSpreadsheet, LayoutDashboard, List, MoreHorizontal, Plus, SquareKanban, Upload } from 'lucide-react';
import { useJobStore } from '@/hooks/useJobStore';
import { JOB_STATUSES } from '@/constants/jobs';
import { Button, IconButton, Menu, SearchInput, cx, useConfirmOptional, useToast, useUrlState } from '@/components/ui';
import { PageHeader } from '@/components/shell';
import { KanbanView } from '@/components/job/KanbanView';
import { ListView } from '@/components/job/ListView';
import { JobSummary } from '@/components/job/JobSummary';
import { CareerHistoryPanel } from '@/components/CareerHistoryPanel';
import { RecoveryNotice } from '@/components/RecoveryNotice';
import { JobsNotSavedAlert } from '@/components/job/JobsNotSavedAlert';
import { ImportNotice } from '@/components/job/ImportNotice';
import { downloadBlob } from '@/utils/download';
import { jobsToCsv } from '@/utils/jobCsv';
import { filterJobs } from '@/utils/jobQuery';
import { importMessage, jobsFromText, readImportFile } from '@/utils/jobImport';

const VIEWS = [
  { id: 'summary', label: 'Summary', icon: LayoutDashboard },
  { id: 'kanban', label: 'Board', icon: SquareKanban },
  { id: 'list', label: 'List', icon: List },
];

/** The views as tabs under the title: Summary · Board · List (`?view=`). */
function ViewTabs({ view, onChange }) {
  return (
    <nav aria-label="Job tracker views" className="flex items-end gap-5 overflow-x-auto">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          title={`${v.label === 'Board' ? 'Kanban' : v.label} view`}
          aria-current={view === v.id ? 'page' : undefined}
          onClick={() => onChange(v.id)}
          className={cx(
            'relative flex h-10 shrink-0 items-center gap-1.5 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full',
            view === v.id ? 'text-brand after:bg-brand' : 'text-ink-subtle hover:text-ink after:bg-transparent hover:after:bg-line',
          )}
        >
          <v.icon size={15} aria-hidden="true" /> {v.label}
        </button>
      ))}
    </nav>
  );
}

/**
 * The Job Tracker (/jobs), in the tracker's look: a Summary of the search (pipeline, statuses,
 * deadlines, follow-ups, career history), the Board (a column per status, drag or "Move to"),
 * and the List (a sortable table) — `?view=summary|kanban|list`. The search and the status quick
 * filters narrow the board and the list; Import, Export JSON / CSV and "Clear all jobs" sit in the
 * header. Deleting a job asks first, then offers Undo.
 */
export function JobTracker({ store }) {
  const navigate = useNavigate();
  const { jobs, persistError, recovery, dismissRecovery, updateJob, deleteJob, restoreJob, importJobs, clearDemoData } = useJobStore();
  const confirm = useConfirmOptional();
  const { toast } = useToast();
  const { appState } = store;
  const { resumes } = appState;
  const [view, setView] = useUrlState('view', 'kanban');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const importRef = useRef(null);
  const [importNotice, setImportNotice] = useState(null); // { kind, text } (importMessage)

  function handleExport() {
    downloadBlob(new Blob([JSON.stringify(jobs, null, 2)], { type: 'application/json' }), 'job_applications.json');
  }
  function handleExportCsv() {
    downloadBlob(new Blob([jobsToCsv(jobs)], { type: 'text/csv;charset=utf-8;' }), 'job_applications.csv');
  }
  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    readImportFile(file, {
      // A file the browser could not read said nothing (J-23).
      onError: text => setImportNotice({ kind: 'error', text }),
      onText: text => {
        const { list, error } = jobsFromText(text);
        // Counts, not silence, after an import that worked (J-04).
        setImportNotice(error ? { kind: 'error', text: error } : importMessage(importJobs(list)));
      },
    });
    e.target.value = '';
  }

  async function confirmDelete(id) {
    const job = jobs.find(j => j.id === id);
    const name = job?.company || 'this job';
    if (!await confirm({ title: `Delete ${name}?`, body: 'The application, its tasks and notes will be deleted. You can undo this for a few seconds.', confirmLabel: 'Delete', tone: 'danger' })) return;
    const removed = deleteJob(id);
    toast({ title: `${name} deleted`, action: removed ? { label: 'Undo', onClick: () => restoreJob(removed.job, removed.index) } : undefined });
  }
  async function clearAll() {
    if (await confirm({ title: 'Clear all jobs?', body: 'Every tracked job is removed so you can start fresh.', confirmLabel: 'Clear all jobs', tone: 'danger' })) clearDemoData();
  }

  const filteredJobs = filterJobs(jobs, { q: search, statuses: filterStatus ? [filterStatus] : [] });
  const filtering = Boolean(search.trim() || filterStatus);
  const open = id => navigate(`/jobs/${id}`);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Job Tracker"
        subtitle={`${jobs.length} application${jobs.length === 1 ? '' : 's'} tracked`}
        icon={<span className="flex size-8 items-center justify-center rounded-md bg-brand text-white"><Briefcase size={16} aria-hidden="true" /></span>}
        actions={(
          <>
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <Button leftIcon={Upload} onClick={() => importRef.current?.click()}>Import</Button>
            <Button leftIcon={Download} onClick={handleExport} title="Export as JSON backup">Export JSON</Button>
            <Button leftIcon={FileSpreadsheet} onClick={handleExportCsv} title="Export as spreadsheet CSV for Excel or Google Sheets">Export CSV</Button>
            <Menu
              label="More job actions"
              items={[{ id: 'clear', label: 'Clear all jobs', danger: true, onSelect: clearAll }]}
              trigger={<IconButton icon={MoreHorizontal} label="More job actions" />}
            />
            <Button variant="primary" leftIcon={Plus} onClick={() => navigate('/jobs/new')}>Add job</Button>
          </>
        )}
        tabs={<ViewTabs view={view} onChange={setView} />}
      />
      <JobsNotSavedAlert error={persistError} className="px-4 pt-3 md:px-8" />
      {recovery && (
        <div className="px-4 pt-3 md:px-8">
          <RecoveryNotice what="job list" recovery={recovery} onDismiss={dismissRecovery} />
        </div>
      )}
      <ImportNotice notice={importNotice} onDismiss={() => setImportNotice(null)} className="px-4 pt-3 md:px-8" />

      {view === 'summary' ? (
        <div className="grid gap-4 bg-sunken px-4 py-6 md:px-8 xl:grid-cols-[1fr_18rem]">
          <JobSummary jobs={jobs} onOpen={open} />
          <aside aria-label="Career history" className="flex flex-col gap-2">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">Career history</h2>
            <CareerHistoryPanel resumes={resumes} activeId={appState.activeId} showJobTrackerLink={false} />
          </aside>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 md:px-8">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search company, role, location…"
              aria-label="Search applications"
              size="sm"
              className="mr-1 w-full sm:w-64"
            />
            {JOB_STATUSES.map(s => {
              const count = jobs.filter(j => j.status === s.id).length;
              if (!count) return null;
              const on = filterStatus === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilterStatus(prev => prev === s.id ? '' : s.id)}
                  className={cx(
                    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60',
                    on ? 'bg-brand-subtle text-brand hover:bg-brand-subtle-hover' : 'text-ink-subtle hover:bg-neutral-fill hover:text-ink',
                  )}
                >
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label} {count}
                </button>
              );
            })}
            {filterStatus && (
              <button type="button" onClick={() => setFilterStatus('')} className="h-8 rounded px-2.5 text-sm font-medium text-ink-subtle hover:text-ink hover:underline">Clear</button>
            )}
            {filtering && <span className="ml-auto text-[13px] text-ink-subtlest">{filteredJobs.length} result{filteredJobs.length !== 1 ? 's' : ''}</span>}
          </div>
          <div className="min-h-0 flex-1 px-4 pb-6 md:px-8">
            {view === 'list' ? (
              <ListView jobs={filteredJobs} resumes={resumes} onNavigate={open} onDelete={confirmDelete} />
            ) : (
              <KanbanView jobs={filteredJobs} updateJob={updateJob} onNavigate={open} onDelete={confirmDelete} scrollToStatus={filterStatus} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
