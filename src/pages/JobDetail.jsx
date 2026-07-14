import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Trash2, Info, LayoutList, AlignLeft, Pencil } from 'lucide-react';
import { useJobStore } from '@/hooks/useJobStore';
import { useAppStore } from '@/hooks/useResumeStore';
import { STATUS_MAP } from '@/constants/jobs';
import { Pipeline } from '@/components/job/Pipeline';
import { TasksTab } from '@/components/job/TasksTab';
import { OverviewTab } from '@/components/job/OverviewTab';
import { NotesTab } from '@/components/job/NotesTab';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'tasks',    label: 'Tasks',    icon: LayoutList },
  { id: 'notes',    label: 'Notes',    icon: AlignLeft },
];

export function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { jobs, updateJob, deleteJob } = useJobStore();
  const { appState } = useAppStore();
  const resumes = appState.resumes;
  const [activeTab, setActiveTab] = useState('tasks');

  const job = jobs.find(j => j.id === id);

  if (!job) {
    return (
      <div className="min-h-screen bg-[#f5f3ef] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-3">Job not found.</p>
          <button onClick={() => navigate('/jobs')} className="text-indigo-600 text-sm font-medium hover:underline">
            ← Back to Job Tracker
          </button>
        </div>
      </div>
    );
  }

  function set(key, val) { updateJob(job.id, { [key]: val }); }

  const s = STATUS_MAP[job.status] || STATUS_MAP.saved;
  const todos = job.todos || [];
  const doneTodos = todos.filter(t => t.done).length;
  const pct = todos.length ? Math.round((doneTodos / todos.length) * 100) : 0;

  const totalApps     = jobs.length;
  const rejectedCount = jobs.filter(j => j.status === 'rejected').length;
  const withdrawnCount = jobs.filter(j => j.status === 'withdrawn').length;

  return (
    <div className="min-h-screen bg-[#f5f3ef]">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6">

          {/* Top row */}
          <div className="flex items-center gap-4 py-3 border-b border-gray-100">
            <button
              onClick={() => navigate('/jobs')}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            >
              <ArrowLeft size={16} />
            </button>

            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold text-white shrink-0 shadow-sm"
              style={{ backgroundColor: s.color }}
            >
              {(job.company || '?')[0].toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-900 text-base leading-tight truncate">
                {job.company || 'Untitled Company'}
              </h1>
              <p className="text-xs text-gray-500 truncate">{job.role || 'No role specified'}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{ color: s.text, backgroundColor: s.bg, border: `1px solid ${s.color}40` }}
              >
                {s.label}
              </span>

              {todos.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-full">
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct === 100 ? 'bg-indigo-500' : 'bg-indigo-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium whitespace-nowrap">{doneTodos}/{todos.length}</span>
                </div>
              )}

              {/* Global application counts */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm font-bold text-gray-800">{totalApps}</span>
                  <span className="text-[10px] text-gray-400 font-medium">Apps</span>
                </div>
                {withdrawnCount > 0 && (
                  <div className="flex items-baseline gap-0.5 px-1.5 py-0.5 rounded-md bg-gray-100">
                    <span className="text-sm font-bold text-gray-500">{withdrawnCount}</span>
                    <span className="text-[10px] text-gray-400 font-medium">W</span>
                  </div>
                )}
                {rejectedCount > 0 && (
                  <div className="flex items-baseline gap-0.5 px-1.5 py-0.5 rounded-md bg-red-50">
                    <span className="text-sm font-bold text-red-500">{rejectedCount}</span>
                    <span className="text-[10px] text-red-400 font-medium">R</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => navigate(`/jobs/${job.id}/edit`)}
                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Edit job"
              >
                <Pencil size={14} />
              </button>

              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Open job posting"
                >
                  <ExternalLink size={14} />
                </a>
              )}
              <button
                onClick={() => {
                  if (confirm(`Delete ${job.company || 'this job'}?`)) {
                    deleteJob(job.id);
                    navigate('/jobs');
                  }
                }}
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 py-1.5">
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    active
                      ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                  {tab.id === 'tasks' && todos.length > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                      {todos.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
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
    </div>
  );
}
