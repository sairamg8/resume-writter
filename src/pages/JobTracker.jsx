import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Download, Upload, LayoutGrid, List,
  Briefcase, Search, X, Eraser, FileSpreadsheet,
} from 'lucide-react';
import { useJobStore } from '@/hooks/useJobStore';
import { JOB_STATUSES } from '@/constants/jobs';
import { KanbanView } from '@/components/job/KanbanView';
import { ListView } from '@/components/job/ListView';
import { CareerHistoryPanel } from '@/components/CareerHistoryPanel';
import { RecoveryNotice } from '@/components/RecoveryNotice';
import { JobsNotSavedAlert } from '@/components/job/JobsNotSavedAlert';
import { SyncHeldNotice } from '@/components/SyncHeldNotice';
import { ImportNotice } from '@/components/job/ImportNotice';
import { downloadBlob } from '@/utils/download';
import { jobsToCsv } from '@/utils/jobCsv';
import { filterJobs, jobStats } from '@/utils/jobQuery';
import { importMessage, jobsFromText, readImportFile } from '@/utils/jobImport';

export function JobTracker({ store }) {
  const navigate = useNavigate();
  const { jobs, persistError, recovery, dismissRecovery, updateJob, deleteJob, importJobs, clearDemoData } = useJobStore();
  const { appState } = store;
  const { resumes } = appState;

  const [view, setView] = useState('kanban');
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

  function confirmDelete(id) {
    const job = jobs.find(j => j.id === id);
    if (confirm(`Delete ${job?.company || 'this job'}?`)) deleteJob(id);
  }

  const handleFilterStatus = id => setFilterStatus(prev => prev === id ? '' : id);

  const filteredJobs = filterJobs(jobs, { q: search, statuses: filterStatus ? [filterStatus] : [] });

  const counts = jobStats(jobs); // the definitions, tested: src/utils/jobQuery.js
  const { rejected: rejectedCount, withdrawn: withdrawnCount } = counts;
  const stats = [
    { label: 'Total',      value: counts.total,        color: 'text-gray-900' },
    { label: 'Active',     value: counts.active,       color: 'text-blue-600' },
    { label: 'Interviews', value: counts.interviewing, color: 'text-amber-600' },
    { label: 'Offers',     value: counts.offers,       color: 'text-green-600' },
  ];

  return (
    <div className="min-h-screen bg-[#f5f3ef]">

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => navigate('/')}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                title="Back to dashboard"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Briefcase size={16} className="text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Job Tracker</span>
            </div>

            <div className="flex md:hidden gap-0.5 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setView('kanban')}
                title="Kanban view"
                className={`p-1.5 rounded-md transition-all ${view === 'kanban' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setView('list')}
                title="List view"
                className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <List size={14} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="hidden md:flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setView('kanban')}
                title="Kanban view"
                className={`p-1.5 rounded-md transition-all ${view === 'kanban' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setView('list')}
                title="List view"
                className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <List size={14} />
              </button>
            </div>

            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Export as JSON backup"
            >
              <Download size={13} /> Export JSON
            </button>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
              title="Export as spreadsheet CSV for Excel or Google Sheets"
            >
              <FileSpreadsheet size={13} className="text-emerald-600" /> Export CSV
            </button>
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <button
              onClick={() => importRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Upload size={13} /> Import
            </button>
            <button
              onClick={() => { if (confirm('Clear all jobs and start fresh?')) clearDemoData(); }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-gray-400 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
              title="Clear all job data"
            >
              <Eraser size={13} /> Clear
            </button>
            <button
              onClick={() => navigate('/jobs/new')}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm ml-auto sm:ml-0"
            >
              <Plus size={13} /> Add Job
            </button>
          </div>
        </div>
      </div>

      <JobsNotSavedAlert error={persistError} className="max-w-7xl mx-auto px-4 sm:px-6 pt-3" />
      <SyncHeldNotice name="jobs" className="max-w-7xl mx-auto px-4 sm:px-6 pt-3" />
      {recovery && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
          <RecoveryNotice what="job list" recovery={recovery} onDismiss={dismissRecovery} />
        </div>
      )}
      <ImportNotice notice={importNotice} onDismiss={() => setImportNotice(null)} className="max-w-7xl mx-auto px-4 sm:px-6 pt-3" />

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-4 sm:gap-8">
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            {stats.map(s => (
              <div key={s.label} className="flex items-baseline gap-1.5">
                <span className={`text-2xl sm:text-3xl font-bold ${s.color}`}>{s.value}</span>
                <span className="text-xs text-gray-400 font-medium">{s.label}</span>
              </div>
            ))}
          </div>
          {(rejectedCount > 0 || withdrawnCount > 0) && (
            <div className="flex items-center gap-2">
              {rejectedCount > 0 && (
                <div className="flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-100">
                  <span className="text-base sm:text-lg font-bold text-red-600">{rejectedCount}</span>
                  <span className="text-xs text-red-400 font-medium">Rejected</span>
                </div>
              )}
              {withdrawnCount > 0 && (
                <div className="flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200">
                  <span className="text-base sm:text-lg font-bold text-gray-500">{withdrawnCount}</span>
                  <span className="text-xs text-gray-400 font-medium">Withdrawn</span>
                </div>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            {filterStatus && (
              <button
                onClick={() => setFilterStatus('')}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center gap-1"
              >
                <X size={9} /> Clear
              </button>
            )}
            {JOB_STATUSES.map(s => {
              const count = jobs.filter(j => j.status === s.id).length;
              if (!count) return null;
              const active = filterStatus === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => handleFilterStatus(s.id)}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all"
                  style={{
                    color: s.text,
                    backgroundColor: active ? s.color + '30' : s.bg,
                    border: `1px solid ${active ? s.color : s.color + '40'}`,
                    outline: active ? `2px solid ${s.color}` : 'none',
                    outlineOffset: '1px',
                  }}
                >
                  {s.label} {count}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              aria-label="Search applications"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search company, role, location…"
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-gray-50"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={11} />
              </button>
            )}
          </div>
          {(search || filterStatus) && (
            <span className="text-xs text-gray-400">{filteredJobs.length} result{filteredJobs.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Main content — sidebar + board */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col lg:flex-row gap-6 items-start">

        {/* Left sidebar — career history */}
        <div className="w-full lg:w-64 shrink-0 lg:sticky lg:top-6 order-2 lg:order-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Career History</p>
          <CareerHistoryPanel
            resumes={resumes}
            activeId={appState.activeId}
            showJobTrackerLink={false}
          />
        </div>

        {/* Right — kanban / list */}
        <div className="flex-1 min-w-0 w-full overflow-hidden order-1 lg:order-2">
          {view === 'kanban' ? (
            <KanbanView
              jobs={filteredJobs}
              updateJob={updateJob}
              onNavigate={id => navigate(`/jobs/${id}`)}
              onDelete={confirmDelete}
              scrollToStatus={filterStatus}
            />
          ) : (
            <ListView
              jobs={filteredJobs}
              resumes={resumes}
              onNavigate={id => navigate(`/jobs/${id}`)}
              onDelete={confirmDelete}
            />
          )}
        </div>

      </div>
    </div>
  );
}
