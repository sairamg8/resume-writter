import { useState, useId } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useJobStore } from '@/hooks/useJobStore';
import { useJobStages } from '@/hooks/useJobStages';
import { todayLocalISO } from '@/utils/dates';
import { JOB_STATUSES } from '@/constants/jobs';
import { InterviewStageSelector } from '@/components/job/InterviewStageSelector';
import { JobsNotSavedAlert } from '@/components/job/JobsNotSavedAlert';
import RichTextEditor from '@/components/RichTextEditor';

/** A labelled control: `id` is the control's, so the label names it (M8). */
function Field({ id, label, required, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-500 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors';

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

  const [form, setForm] = useState(() => {
    const base = {
      company: '', role: '', status: 'applied', stage: '',
      url: '', location: '', salary: '',
      contact: '', resumeId: '', notes: '',
      appliedDate: todayLocalISO(), deadline: '',
      ...existing,
    };
    for (const key of ['company', 'role', 'status', 'stage', 'url', 'location', 'salary', 'contact', 'resumeId', 'notes', 'appliedDate', 'deadline']) {
      if (base[key] == null) base[key] = '';
    }
    return base;
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const canSave = Boolean((form.company || '').trim() || (form.role || '').trim());
  const backPath = isEdit ? `/jobs/${id}` : '/jobs';

  function handleSave() {
    if (!canSave) return;
    if (isEdit) { updateJob(id, form); navigate(`/jobs/${id}`); }
    else { const newId = addJob(form); navigate(`/jobs/${newId}`); }
  }

  return (
    <div className="min-h-screen bg-[#f5f3ef]">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate(backPath)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-base font-bold text-gray-900">{isEdit ? 'Edit Job Application' : 'Add Job Application'}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => navigate(backPath)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={!canSave} className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
              {isEdit ? 'Save Changes' : 'Add Job'}
            </button>
          </div>
        </div>
      </div>

      <JobsNotSavedAlert error={persistError} className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">

        <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 space-y-4">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Basic Info</h2>
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

        <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 space-y-4">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Status & Dates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field id={uid + 'status'} label="Application Status">
              <select id={uid + 'status'} value={form.status} onChange={e => set('status', e.target.value)} className={INPUT + ' bg-white cursor-pointer'}>
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

        <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 space-y-4">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Contact & Resume</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field id={uid + 'contact'} label="Contact Person">
              <input id={uid + 'contact'} value={form.contact} onChange={e => set('contact', e.target.value)} placeholder="Recruiter name, email…" className={INPUT} />
            </Field>
            <Field id={uid + 'resumeId'} label="Resume Used">
              <select id={uid + 'resumeId'} value={form.resumeId} onChange={e => set('resumeId', e.target.value)} className={INPUT + ' bg-white cursor-pointer'}>
                <option value="">— Not linked yet —</option>
                {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Notes</h2>
          {/* The Notes tab's editor and format: plain text here was stripped there (J-03). */}
          <RichTextEditor ariaLabel="Notes" value={form.notes} onChange={html => set('notes', html)} rows={4} placeholder="Key contacts, interview format, compensation details, next steps…" />
        </section>

        <div className="flex justify-end gap-3 pb-8">
          <button onClick={() => navigate(backPath)} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!canSave} className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            {isEdit ? 'Save Changes' : 'Add Job'}
          </button>
        </div>
      </div>
    </div>
  );
}
