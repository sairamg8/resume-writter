import { useState, useId } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useJobStore } from '@/hooks/useJobStore';
import { useJobStages } from '@/hooks/useJobStages';
import { formPatch, jobFormValues, withFormStatus } from '@/utils/jobEdits';
import { linkedResume } from '@/utils/jobQuery';
import { JOB_STATUSES } from '@/constants/jobs';
import { InterviewStageSelector } from '@/components/job/InterviewStageSelector';
import { JobsNotSavedAlert } from '@/components/job/JobsNotSavedAlert';
import RichTextEditor from '@/components/RichTextEditor';

/** A labelled control: `id` is the control's, so the label names it (M8). */
function Field({ id, label, required, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-ink-subtle mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT = 'w-full px-3 py-2.5 text-sm border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-colors';

export function JobForm({ store }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { jobs, persistError, addJob, updateJob } = useJobStore();
  const { appState } = store;
  const resumes = appState.resumes;
  const { customStages, addCustomStage, removeCustomStage } = useJobStages();
  const uid = useId();

  const isEdit = !!id;
  const existing = isEdit ? jobs.find(j => j.id === id) : null;
  // The job and the form's values as it opened: a save writes only what changed since (J-02).
  const [opened] = useState(() => existing ?? null);
  const [start] = useState(() => jobFormValues(existing));
  const [form, setForm] = useState(start);
  // Deleted in another tab while this form was open: keep the input, offer it as a new job (J-16).
  const gone = isEdit && Boolean(opened) && !existing;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  // A new job's untouched applied date follows the status: none for Saved (J-10).
  const setStatus = v => setForm(f => withFormStatus(f, v, { isNew: !isEdit }));
  const canSave = Boolean((form.company || '').trim() || (form.role || '').trim());
  const backPath = isEdit && existing ? `/jobs/${id}` : '/jobs';

  function handleSave() {
    if (!canSave) return;
    if (!isEdit) { navigate(`/jobs/${addJob(form)}`); return; }
    // The whole form wrote its stale to-dos, history and status over another tab's (J-02).
    if (updateJob(id, formPatch(start, form))) navigate(`/jobs/${id}`);
  }

  function saveAsNew() {
    if (canSave) navigate(`/jobs/${addJob(form)}`);
  }

  // An unknown id is not a blank form whose Save throws the input away (J-16).
  if (isEdit && !opened) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-ink-subtle mb-3">Job not found.</p>
          <button onClick={() => navigate('/jobs')} className="text-brand text-sm font-medium hover:underline">
            ← Back to Job Tracker
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white">
      <div className="bg-white border-b border-line sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate(backPath)} className="p-1.5 text-ink-subtlest hover:text-ink hover:bg-neutral-fill rounded-lg transition-colors shrink-0">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-base font-bold text-ink">{isEdit ? 'Edit Job Application' : 'Add Job Application'}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => navigate(backPath)} className="px-4 py-2 text-sm font-medium text-ink-subtle hover:bg-neutral-fill rounded-lg transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={!canSave || gone} className="px-5 py-2 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
              {isEdit ? 'Save Changes' : 'Add Job'}
            </button>
          </div>
        </div>
      </div>

      <JobsNotSavedAlert error={persistError} className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6" />
      {gone && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
          <p role="alert" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">
            <span className="flex-1">This job was deleted in another tab. What you typed is still here.</span>
            <button type="button" onClick={saveAsNew} disabled={!canSave} className="font-semibold underline hover:text-amber-900 disabled:opacity-40">Save as a new job</button>
          </p>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">

        <section className="bg-white rounded-md border border-line p-4 sm:p-6 space-y-4">
          <h2 className="text-[11px] font-bold text-ink-subtlest uppercase tracking-widest">Basic Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field id={uid + 'company'} label="Company" required>
              <input id={uid + 'company'} autoFocus value={form.company} onChange={e => set('company', e.target.value)} placeholder="Google, Stripe, Notion…" className={INPUT} />
            </Field>
            <Field id={uid + 'role'} label="Role / Position" required>
              <input id={uid + 'role'} value={form.role} onChange={e => set('role', e.target.value)} placeholder="Software Engineer, Product Manager…" className={INPUT} />
            </Field>
            <Field id={uid + 'location'} label="Location">
              <input id={uid + 'location'} value={form.location} onChange={e => set('location', e.target.value)} placeholder="Remote, New York…" className={INPUT} />
            </Field>
            <Field id={uid + 'salary'} label="Salary / Comp">
              <input id={uid + 'salary'} value={form.salary} onChange={e => set('salary', e.target.value)} placeholder="$150k – $200k" className={INPUT} />
            </Field>
            <div className="col-span-1 sm:col-span-2">
              <Field id={uid + 'url'} label="Job Posting URL">
                <input id={uid + 'url'} value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://jobs.company.com/…" className={INPUT} />
              </Field>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-md border border-line p-4 sm:p-6 space-y-4">
          <h2 className="text-[11px] font-bold text-ink-subtlest uppercase tracking-widest">Status & Dates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field id={uid + 'status'} label="Application Status">
              <select id={uid + 'status'} value={form.status} onChange={e => setStatus(e.target.value)} className={INPUT + ' bg-white cursor-pointer'}>
                {JOB_STATUSES.map((s, i) => (
                  <option key={s.id} value={s.id}>{i + 1}. {s.label}</option>
                ))}
              </select>
            </Field>
            <Field id={uid + 'appliedDate'} label="Applied Date">
              <input id={uid + 'appliedDate'} type="date" value={form.appliedDate} onChange={e => set('appliedDate', e.target.value)} className={INPUT} />
            </Field>
            <Field id={uid + 'deadline'} label="Deadline / Follow-up">
              <input id={uid + 'deadline'} type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} className={INPUT} />
            </Field>
          </div>
        </section>

        <InterviewStageSelector
          stage={form.stage}
          onStageChange={v => set('stage', v)}
          customStages={customStages}
          addCustomStage={addCustomStage}
          removeCustomStage={removeCustomStage}
        />

        <section className="bg-white rounded-md border border-line p-4 sm:p-6 space-y-4">
          <h2 className="text-[11px] font-bold text-ink-subtlest uppercase tracking-widest">Contact & Resume</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field id={uid + 'contact'} label="Contact Person">
              <input id={uid + 'contact'} value={form.contact} onChange={e => set('contact', e.target.value)} placeholder="Recruiter name, email…" className={INPUT} />
            </Field>
            <Field id={uid + 'resumeId'} label="Resume Used">
              <select id={uid + 'resumeId'} value={form.resumeId} onChange={e => set('resumeId', e.target.value)} className={INPUT + ' bg-white cursor-pointer'}>
                <option value="">— Not linked yet —</option>
                {linkedResume(form, resumes).state === 'deleted' && <option value={form.resumeId}>Résumé deleted</option>}
                {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-md border border-line p-6 space-y-4">
          <h2 className="text-[11px] font-bold text-ink-subtlest uppercase tracking-widest">Notes</h2>
          {/* The Notes tab's editor and format: plain text here was stripped there (J-03). */}
          <RichTextEditor ariaLabel="Notes" value={form.notes} onChange={html => set('notes', html)} rows={4} placeholder="Key contacts, interview format, compensation details, next steps…" />
        </section>

        <div className="flex justify-end gap-3 pb-8">
          <button onClick={() => navigate(backPath)} className="px-5 py-2.5 text-sm font-medium text-ink-subtle bg-white border border-line rounded-md hover:bg-sunken transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!canSave || gone} className="px-6 py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            {isEdit ? 'Save Changes' : 'Add Job'}
          </button>
        </div>
      </div>
    </div>
  );
}
