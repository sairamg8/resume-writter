import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Download, Upload, LayoutGrid, List,
  Briefcase, Search, X, Eraser,
} from 'lucide-react';
import { useJobStore } from '@/hooks/useJobStore';
import { useAppStore } from '@/hooks/useResumeStore';
import { JOB_STATUSES } from '@/constants/jobs';
import { KanbanView } from '@/components/job/KanbanView';
import { ListView } from '@/components/job/ListView';
import { CareerHistoryPanel } from '@/components/CareerHistoryPanel';

export function JobTracker() {
  const navigate = useNavigate();
  const { jobs, updateJob, deleteJob, importJobs, clearDemoData } = useJobStore();
  const { appState } = useAppStore();
  const resumes = appState.resumes;

  const [view, setView] = useState('kanban');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const importRef = useRef(null);

  function handleExport() {
    const blob = new Blob([JSON.stringify(jobs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'job_applications.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const arr = Array.isArray(parsed) ? parsed : (parsed.jobs || []);
        if (arr.length) importJobs(arr);
      } catch {}
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleFilterStatus(id) {
    setFilterStatus(prev => prev === id ? '' : id);
  }

  const filteredJobs = jobs.filter(j => {
    const q = search.toLowerCase();
    const matchSearch = !q || j.company?.toLowerCase().includes(q) || j.role?.toLowerCase().includes(q) || j.location?.toLowerCase().includes(q);
    const matchStatus = !filterStatus || j.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const rejectedCount  = jobs.filter(j => j.status === 'rejected').length;
  const withdrawnCount = jobs.filter(j => j.status === 'withdrawn').length;

  const stats = [
    { label: 'Total',      value: jobs.length,                                                                                color: 'text-gray-900' },
    { label: 'Active',     value: jobs.filter(j => !['rejected', 'withdrawn', 'offer', 'on_hold'].includes(j.status)).length, color: 'text-blue-600' },
    { label: 'Interviews', value: jobs.filter(j => ['phone_screen', 'interview'].includes(j.status)).length,                  color: 'text-amber-600' },
    { label: 'Offers',     value: jobs.filter(j => j.status === 'offer').length,                                              color: 'text-green-600' },
  ];

  return (
    <div className="min-h-screen bg-[#f5f3ef]">

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            title="Back to dashboard"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Briefcase size={16} className="text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Job Tracker</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download size={13} /> Export
            </button>
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <button
              onClick={() => importRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Upload size={13} /> Import
            </button>
            <button
              onClick={() => { if (confirm('Clear all jobs and start fresh?')) clearDemoData(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-400 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
              title="Clear all job data"
            >
              <Eraser size={13} /> Clear
            </button>
            <button
              onClick={() => navigate('/jobs/new')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus size={13} /> Add Job
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-8">
          {stats.map(s => (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <span className={`text-3xl font-bold ${s.color}`}>{s.value}</span>
              <span className="text-xs text-gray-400 font-medium">{s.label}</span>
            </div>
          ))}
          {(rejectedCount > 0 || withdrawnCount > 0) && (
            <div className="flex items-center gap-2">
              {rejectedCount > 0 && (
                <div className="flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-100">
                  <span className="text-lg font-bold text-red-600">{rejectedCount}</span>
                  <span className="text-xs text-red-400 font-medium">Rejected</span>
                </div>
              )}
              {withdrawnCount > 0 && (
                <div className="flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200">
                  <span className="text-lg font-bold text-gray-500">{withdrawnCount}</span>
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
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
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
      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6 items-start">

        {/* Left sidebar — career history */}
        <div className="w-64 shrink-0 sticky top-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Career History</p>
          <CareerHistoryPanel
            resumes={resumes}
            activeId={appState.activeId}
            showJobTrackerLink={false}
          />
        </div>

        {/* Right — kanban / list */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {view === 'kanban' ? (
            <KanbanView
              jobs={filteredJobs}
              updateJob={updateJob}
              onNavigate={id => navigate(`/jobs/${id}`)}
              onDelete={deleteJob}
              scrollToStatus={filterStatus}
            />
          ) : (
            <ListView
              jobs={filteredJobs}
              resumes={resumes}
              onNavigate={id => navigate(`/jobs/${id}`)}
              onDelete={deleteJob}
            />
          )}
        </div>

      </div>
    </div>
  );
}
