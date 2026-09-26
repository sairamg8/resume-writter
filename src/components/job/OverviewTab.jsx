import { Info, Briefcase, MapPin, DollarSign, Calendar, CalendarClock, User, Link2, FileText, ExternalLink, Building2, Compass } from 'lucide-react';
import { JOB_SOURCES, WORK_MODES } from '@/constants/jobs';
import { Field } from '@/components/job/Field';
import { Pipeline } from '@/components/job/Pipeline';
import { StatusHistory } from '@/components/job/StatusHistory';
import { deadlineState } from '@/utils/dates';
import { isOpen, linkedResume, resumeChoices } from '@/utils/jobQuery';
import { editorPath } from '@/utils/letters';

/**
 * A closed (rejected / withdrawn) job stays editable here: its "read-only" lock was bypassed by the
 * Edit form and a board drag anyway, and pushed users to reopen a job — writing history — to fix a
 * typo (J-24). A status change is the same on every path: recorded, no confirm.
 */
const CLOSED = ['rejected', 'withdrawn'];

/** A labelled choice from `options` (`{ id, label }`), '' for not set: saved as soon as it is picked. */
function Choice({ label, value, options, onChange, icon: Icon }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-ink-subtlest">{label}</p>
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-transparent hover:border-line hover:bg-sunken transition-all">
        <Icon size={13} className="text-ink-subtlest shrink-0" />
        <select
          aria-label={label}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="flex-1 text-sm pointer-coarse:text-base bg-transparent focus:outline-none cursor-pointer text-ink"
        >
          <option value="">— Not set —</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}

export function OverviewTab({ job, set, resumes, navigate }) {
  const isTerminal = CLOSED.includes(job.status);
  const isOnHold = job.status === 'on_hold';
  const resumeLink = linkedResume(job, resumes);
  // A closed job (on hold, rejected, withdrawn) has nothing to chase: no 'Deadline has passed'.
  const deadline = isOpen(job) ? deadlineState(job.deadline) : null;
  const isDeadlinePast = deadline === 'past';
  const isDeadlineSoon = deadline === 'soon';

  return (
    // One column on a phone, two from sm up: two fixed columns squeezed every card to half a phone's
    // width (J-12). The cards that span the row span it only where there are two columns.
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

      {/* Pipeline — always interactive so user can reopen */}
      <div className="sm:col-span-2 bg-white rounded-md border border-line p-5 shadow-sm">
        <p className="text-[10px] font-bold text-ink-subtlest uppercase tracking-widest mb-5">Application Stage</p>
        <Pipeline status={job.status} onChange={val => set('status', val)} />
      </div>

      {isTerminal && (
        <div className="sm:col-span-2 flex items-center gap-3 px-4 py-3 bg-sunken border border-line rounded-md">
          <Info size={14} className="text-ink-subtlest shrink-0" />
          <p className="text-sm text-ink-subtle">
            This application is <span className="font-semibold text-ink">{job.status === 'rejected' ? 'Rejected' : 'Withdrawn'}</span>. Restart it from the pipeline above if it reopens.
          </p>
        </div>
      )}
      {isOnHold && (
        <div className="sm:col-span-2 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-md">
          <Info size={14} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">Application is <span className="font-semibold">On Hold</span> — resume or close it from the pipeline above.</p>
        </div>
      )}

      {/* Left col — Role Info */}
      <div className="space-y-4">
        <div className="bg-white rounded-md border border-line p-5 shadow-sm space-y-4">
          <p className="text-[10px] font-bold text-ink-subtlest uppercase tracking-widest">Role Info</p>
          <Field label="Company"          value={job.company}   onChange={v => set('company', v)}  icon={Briefcase} placeholder="Company name" />
          <Field label="Role / Position"  value={job.role}      onChange={v => set('role', v)}     icon={FileText}  placeholder="Job title" />
          {job.stage && (
            <div className="flex items-center gap-2 px-3 py-2">
              <Briefcase size={13} className="text-ink-subtlest shrink-0" />
              <span className="text-[10px] font-bold text-ink-subtlest uppercase tracking-widest mr-2">Stage</span>
              <span className="text-xs font-semibold text-brand bg-brand-subtle px-2.5 py-0.5 rounded-full border border-brand-subtle-hover">{job.stage}</span>
            </div>
          )}
          <Field label="Location"         value={job.location}  onChange={v => set('location', v)} icon={MapPin}    placeholder="City / Remote" />
          <Field label="Salary / Comp"    value={job.salary}    onChange={v => set('salary', v)}   icon={DollarSign} placeholder="$120k – $160k" />
          <Field label="Job Posting URL"  value={job.url}       onChange={v => set('url', v)}      icon={Link2}     placeholder="https://…" />
          {/* The Details box shows both: nothing could set them but an imported file (R4-JOB-02). */}
          <Choice label="Work Mode" value={job.workMode} options={WORK_MODES} onChange={v => set('workMode', v)} icon={Building2} />
          <Choice label="Source"    value={job.source}   options={JOB_SOURCES} onChange={v => set('source', v)}  icon={Compass} />
        </div>
      </div>

      {/* Right col — Timeline & Contact */}
      <div className="space-y-4">
        <div className="bg-white rounded-md border border-line p-5 shadow-sm space-y-4">
          <p className="text-[10px] font-bold text-ink-subtlest uppercase tracking-widest">Timeline & Contact</p>

          <Field label="Applied Date"   value={job.appliedDate} onChange={v => set('appliedDate', v)} type="date" icon={Calendar} />

          {/* Deadline */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-ink-subtlest">
              Deadline
            </p>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-transparent hover:border-line hover:bg-sunken transition-all">
              <Calendar size={13} className={`shrink-0 ${isDeadlinePast ? 'text-red-400' : isDeadlineSoon ? 'text-amber-400' : 'text-ink-subtlest'}`} />
              <input
                type="date"
                aria-label="Deadline"
                value={job.deadline || ''}
                onChange={e => set('deadline', e.target.value)}
                // 16 px on touch screens: iOS Safari zooms the page into any smaller field it focuses (J-38).
                className={`flex-1 text-sm pointer-coarse:text-base bg-transparent focus:outline-none ${
                  isDeadlinePast ? 'text-red-600 font-medium' : isDeadlineSoon ? 'text-amber-600 font-medium' : 'text-ink'
                }`}
              />
            </div>
            {(isDeadlinePast || isDeadlineSoon) && (
              <p className={`text-[10px] px-3 mt-1 font-semibold ${isDeadlinePast ? 'text-red-500' : 'text-amber-500'}`}>
                {isDeadlinePast ? 'Deadline has passed' : 'Coming up soon!'}
              </p>
            )}
          </div>

          {/* Its own day: the deadline was labelled 'Deadline / Follow-up', so a follow-up set there
              never reached 'Follow-ups due' (R4-JOB-02). */}
          <Field label="Follow-up Date" value={job.followUpDate} onChange={v => set('followUpDate', v)} type="date" icon={CalendarClock} />

          <Field label="Contact Person" value={job.contact} onChange={v => set('contact', v)} icon={User} placeholder="Recruiter name · email" />

          {/* Resume */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-ink-subtlest">
              Resume Used
            </p>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-transparent hover:border-line hover:bg-sunken transition-all">
              <FileText size={13} className="text-ink-subtlest shrink-0" />
              <select
                aria-label="Resume used"
                value={job.resumeId || ''}
                onChange={e => set('resumeId', e.target.value)}
                className="flex-1 text-sm pointer-coarse:text-base bg-transparent focus:outline-none cursor-pointer text-ink"
              >
                <option value="">— Not linked yet —</option>
                {/* A linked résumé deleted since: said so, not 'Not linked yet' (J-21). */}
                {resumeLink.state === 'deleted' && <option value={job.resumeId}>Résumé deleted</option>}
                {/* Résumés only: a cover letter is no résumé to have applied with (R2-135). */}
                {resumeChoices(job, resumes).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {/* A job still linked to a letter opens it on its letter's tab, as the letter's own card does. */}
              {resumeLink.state === 'linked' && (
                <button
                  onClick={() => navigate(editorPath(job.resumeId, resumeLink.resume))}
                  className="text-brand hover:text-brand shrink-0"
                  title="Open resume"
                >
                  <ExternalLink size={11} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status history — full width, shown when there's meaningful history */}
      {job.statusHistory?.length > 0 && (
        <div className="sm:col-span-2">
          <StatusHistory history={job.statusHistory || []} />
        </div>
      )}
    </div>
  );
}
