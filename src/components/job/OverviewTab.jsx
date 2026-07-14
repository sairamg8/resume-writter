import { Lock, Briefcase, MapPin, DollarSign, Calendar, User, Link2, FileText, ExternalLink } from 'lucide-react';
import { Field } from '@/components/job/Field';
import { Pipeline } from '@/components/job/Pipeline';
import { StatusHistory } from '@/components/job/StatusHistory';

const TERMINAL_READONLY = ['rejected', 'withdrawn'];

export function OverviewTab({ job, set, resumes, navigate }) {
  const isTerminal = TERMINAL_READONLY.includes(job.status);
  const isOnHold = job.status === 'on_hold';
  const isDeadlinePast = job.deadline && new Date(job.deadline) < new Date();
  const isDeadlineSoon = job.deadline && !isDeadlinePast && (new Date(job.deadline) - new Date()) < 3 * 24 * 60 * 60 * 1000;

  return (
    <div className="grid grid-cols-2 gap-5">

      {/* Pipeline — always interactive so user can reopen */}
      <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-5">Application Stage</p>
        <Pipeline status={job.status} onChange={val => set('status', val)} />
      </div>

      {/* Locked banner */}
      {isTerminal && (
        <div className="col-span-2 flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl">
          <Lock size={14} className="text-gray-400 shrink-0" />
          <p className="text-sm text-gray-500">
            This application is <span className="font-semibold text-gray-700">{job.status === 'rejected' ? 'Rejected' : 'Withdrawn'}</span> — fields are read-only.
            Restart from the pipeline above.
          </p>
        </div>
      )}
      {isOnHold && (
        <div className="col-span-2 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
          <Lock size={14} className="text-amber-400 shrink-0" />
          <p className="text-sm text-amber-700">Application is <span className="font-semibold">On Hold</span> — resume or close it from the pipeline above.</p>
        </div>
      )}

      {/* Left col — Role Info */}
      <div className="space-y-4">
        <div className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 ${isTerminal ? 'border-gray-100 opacity-80' : 'border-gray-100'}`}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role Info</p>
          <Field label="Company"          value={job.company}   onChange={v => set('company', v)}  icon={Briefcase} placeholder="Company name"    readOnly={isTerminal} />
          <Field label="Role / Position"  value={job.role}      onChange={v => set('role', v)}     icon={FileText}  placeholder="Job title"        readOnly={isTerminal} />
          {job.stage && (
            <div className="flex items-center gap-2 px-3 py-2">
              <Briefcase size={13} className="text-gray-300 shrink-0" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-2">Stage</span>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">{job.stage}</span>
            </div>
          )}
          <Field label="Location"         value={job.location}  onChange={v => set('location', v)} icon={MapPin}    placeholder="City / Remote"    readOnly={isTerminal} />
          <Field label="Salary / Comp"    value={job.salary}    onChange={v => set('salary', v)}   icon={DollarSign} placeholder="$120k – $160k"  readOnly={isTerminal} />
          <Field label="Job Posting URL"  value={job.url}       onChange={v => set('url', v)}      icon={Link2}     placeholder="https://…"        readOnly={isTerminal} />
        </div>
      </div>

      {/* Right col — Timeline & Contact */}
      <div className="space-y-4">
        <div className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 ${isTerminal ? 'border-gray-100 opacity-80' : 'border-gray-100'}`}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Timeline & Contact</p>

          <Field label="Applied Date"   value={job.appliedDate} onChange={v => set('appliedDate', v)} type="date" icon={Calendar} readOnly={isTerminal} />

          {/* Deadline */}
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isTerminal ? 'text-gray-300' : 'text-gray-400'}`}>
              Deadline / Follow-up
            </p>
            {isTerminal ? (
              <div className="flex items-center gap-2 px-3 py-2">
                <Calendar size={13} className="text-gray-300 shrink-0" />
                <span className="text-sm text-gray-500">{job.deadline || '—'}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all">
                  <Calendar size={13} className={`shrink-0 ${isDeadlinePast ? 'text-red-400' : isDeadlineSoon ? 'text-amber-400' : 'text-gray-400'}`} />
                  <input
                    type="date"
                    value={job.deadline || ''}
                    onChange={e => set('deadline', e.target.value)}
                    className={`flex-1 text-sm bg-transparent focus:outline-none ${
                      isDeadlinePast ? 'text-red-600 font-medium' : isDeadlineSoon ? 'text-amber-600 font-medium' : 'text-gray-800'
                    }`}
                  />
                </div>
                {(isDeadlinePast || isDeadlineSoon) && (
                  <p className={`text-[10px] px-3 mt-1 font-semibold ${isDeadlinePast ? 'text-red-500' : 'text-amber-500'}`}>
                    {isDeadlinePast ? 'Deadline has passed' : 'Coming up soon!'}
                  </p>
                )}
              </>
            )}
          </div>

          <Field label="Contact Person" value={job.contact} onChange={v => set('contact', v)} icon={User} placeholder="Recruiter name · email" readOnly={isTerminal} />

          {/* Resume */}
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isTerminal ? 'text-gray-300' : 'text-gray-400'}`}>
              Resume Used
            </p>
            {isTerminal ? (
              <div className="flex items-center gap-2 px-3 py-2">
                <FileText size={13} className="text-gray-300 shrink-0" />
                <span className="text-sm text-gray-500">
                  {resumes.find(r => r.id === job.resumeId)?.name || '—'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all">
                <FileText size={13} className="text-gray-400 shrink-0" />
                <select
                  value={job.resumeId || ''}
                  onChange={e => set('resumeId', e.target.value)}
                  className="flex-1 text-sm bg-transparent focus:outline-none cursor-pointer text-gray-700"
                >
                  <option value="">— Not linked yet —</option>
                  {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                {job.resumeId && (
                  <button
                    onClick={() => navigate(`/resume/${job.resumeId}`)}
                    className="text-indigo-500 hover:text-indigo-700 shrink-0"
                    title="Open resume"
                  >
                    <ExternalLink size={11} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status history — full width, shown when there's meaningful history */}
      {job.statusHistory?.length > 0 && (
        <div className="col-span-2">
          <StatusHistory history={job.statusHistory || []} />
        </div>
      )}
    </div>
  );
}
