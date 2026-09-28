import { useEffect, useState, useId } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useJobStore } from '@/hooks/useJobStore';
import { useJobStages } from '@/hooks/useJobStages';
import { FORM_FIELDS, formPatch, jobFormValues, withFormStatus } from '@/utils/jobEdits';
import { linkedResume, resumeChoices } from '@/utils/jobQuery';
import { JOB_SOURCES, JOB_STATUSES, WORK_MODES } from '@/constants/jobs';
import { InterviewStageSelector } from '@/components/job/InterviewStageSelector';
import { JobsNotSavedAlert } from '@/components/job/JobsNotSavedAlert';
import RichTextEditor from '@/components/RichTextEditor';
import { Button, Select, TextField, useConfirmOptional } from '@/components/ui';
import { PageHeader } from '@/components/shell';

// The form's unsaved values in this tab's sessionStorage, so the browser's Back or an in-app link —
// which the app's plain HashRouter cannot hold (no useBlocker) — no longer loses them (R4-DUX-06).
// Storage can throw (private mode, blocked site data): then there is simply no draft.
const draftKey = (id) => `jobform:${id || 'new'}`;
function readDraft(key) {
  try {
    const raw = sessionStorage.getItem(key);
    const draft = raw ? JSON.parse(raw) : null;
    return draft && typeof draft === 'object' ? draft : null;
  } catch { return null; }
}
function writeDraft(key, form) {
  try { sessionStorage.setItem(key, JSON.stringify(form)); } catch { /* no draft, as without storage */ }
}
function clearDraft(key) {
  try { sessionStorage.removeItem(key); } catch { /* nothing stored */ }
}

export function JobForm({ store }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { jobs, persistError, addJob, updateJob } = useJobStore();
  const { appState } = store;
  const resumes = appState.resumes;
  const { customStages, addCustomStage, removeCustomStage } = useJobStages();
  const uid = useId();
  const formId = uid + 'form';

  const isEdit = !!id;
  const existing = isEdit ? jobs.find(j => j.id === id) : null;
  // The job and the form's values as it opened: a save writes only what changed since (J-02).
  const [opened] = useState(() => existing ?? null);
  const [start] = useState(() => jobFormValues(existing));
  const key = draftKey(id);
  // A draft left by a Back or a link away, restored when it differs from the job as it is now.
  const [draft] = useState(() => {
    const stored = readDraft(key);
    if (!stored) return null;
    const values = { ...start };
    for (const k of FORM_FIELDS) if (k in stored && typeof stored[k] === typeof start[k]) values[k] = stored[k];
    return Object.keys(formPatch(start, values)).length ? values : null;
  });
  const [form, setForm] = useState(draft ?? start);
  const [restored, setRestored] = useState(Boolean(draft));
  // Deleted in another tab while this form was open: keep the input, offer it as a new job (J-16).
  const gone = isEdit && Boolean(opened) && !existing;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  // A new job's untouched applied date follows the status: none for Saved (J-10).
  const setStatus = v => setForm(f => withFormStatus(f, v, { isNew: !isEdit }));
  const canSave = Boolean((form.company || '').trim() || (form.role || '').trim());
  const backPath = isEdit && existing ? `/jobs/${id}` : '/jobs';
  const confirm = useConfirmOptional();
  // Typed something the job does not hold yet: the same test the save writes by (formPatch).
  const dirty = Object.keys(formPatch(start, form)).length > 0;

  // Cancel and the back arrow left at once and dropped everything typed (R4-DUX-06): with changes,
  // ask first. The app's HashRouter is no data router, so useBlocker cannot hold the browser's Back
  // or an in-app link; closing or reloading the tab is guarded below.
  async function leave() {
    if (dirty && !(await confirm({
      title: 'Discard your changes?',
      body: 'What you typed on this form has not been saved.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      tone: 'danger',
    }))) return;
    clearDraft(key);
    navigate(backPath);
  }

  // Keep the draft while the form differs from its start; none once it is back there.
  useEffect(() => {
    if (dirty) writeDraft(key, form);
    else clearDraft(key);
  }, [dirty, form, key]);

  function discardRestored() {
    clearDraft(key);
    setForm(start);
    setRestored(false);
  }

  // Closing or reloading the tab with changes: the browser's own "Leave site?" question.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function handleSave() {
    if (!canSave || gone) return;
    if (!isEdit) { clearDraft(key); navigate(`/jobs/${addJob(form)}`); return; }
    // The whole form wrote its stale to-dos, history and status over another tab's (J-02).
    if (updateJob(id, formPatch(start, form))) { clearDraft(key); navigate(`/jobs/${id}`); }
  }

  // Enter in a field saves, as in any form: the page had no <form>, so Enter did nothing (J-36).
  function handleSubmit(e) {
    e.preventDefault();
    handleSave();
  }

  function saveAsNew() {
    if (canSave) { clearDraft(key); navigate(`/jobs/${addJob(form)}`); }
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

  const title = isEdit ? 'Edit job application' : 'Add job application';
  const company = existing ? existing.company || 'Untitled Company' : '';

  // The workspace's page header, as the job page's (R4-DVIS-01): its own bar here was a centred
  // 16 px title, so Edit and the job page jumped in size and place. Its row wraps on a phone —
  // the title truncates and the buttons go under it — where arrow, title and both buttons were
  // squeezed into one row and wrapped mid-label at 375 px (R4-DPH-16). The body sits at the header's
  // padding, left-aligned, as the job page's. The breadcrumbs are plain links that do not ask
  // leave()'s question; what was typed is kept by the draft (R4-DUX-06) and comes back on return.
  return (
    <div className="flex-1 bg-white">
      <PageHeader
        className="border-b border-line"
        breadcrumbs={[
          { label: 'Job Tracker', to: '/jobs' },
          // A crumb before the last does not shrink: a long company name ran the row off a phone's
          // screen and hid this page's crumb, so it truncates at a width of its own.
          ...(isEdit && existing ? [{
            label: <span title={company} className="block max-w-40 truncate md:max-w-xs">{company}</span>,
            to: `/jobs/${id}`,
          }] : []),
          { label: title },
        ]}
        icon={(
          <button type="button" onClick={leave} className="p-1.5 text-ink-subtlest hover:text-ink hover:bg-neutral-fill rounded-lg transition-colors shrink-0">
            <ArrowLeft size={16} />
          </button>
        )}
        title={title}
        actions={(
          // The kit's buttons, the same pair as the footer's: the four were each their own height and corner (R4-DVIS-02).
          <>
            <Button variant="ghost" onClick={leave}>Cancel</Button>
            <Button variant="primary" type="submit" form={formId} disabled={!canSave || gone}>
              {isEdit ? 'Save Changes' : 'Add Job'}
            </Button>
          </>
        )}
      />

      <JobsNotSavedAlert error={persistError} className="max-w-3xl px-4 md:px-8 pt-4 sm:pt-6" />
      {restored && (
        <div className="max-w-3xl px-4 md:px-8 pt-4 sm:pt-6">
          <p className="text-xs text-ink-subtle bg-sunken border border-line rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">
            <span className="flex-1">Restored your unsaved changes</span>
            <button type="button" onClick={discardRestored} className="font-semibold underline hover:text-ink">Discard</button>
          </p>
        </div>
      )}
      {gone && (
        <div className="max-w-3xl px-4 md:px-8 pt-4 sm:pt-6">
          <p role="alert" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">
            <span className="flex-1">This job was deleted in another tab. What you typed is still here.</span>
            <button type="button" onClick={saveAsNew} disabled={!canSave} className="font-semibold underline hover:text-amber-900 disabled:opacity-40">Save as a new job</button>
          </p>
        </div>
      )}

      <div className="max-w-3xl px-4 md:px-8 py-6 sm:py-8 space-y-5">

        {/* The fields are a <form>, and the header's and the footer's Save buttons submit it through
            form=, so Enter in a field saves (J-36). The notes stay outside it: the STAR Optimizer the
            notes editor opens has buttons with no type, which would submit the job instead. */}
        <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
          <section className="bg-white rounded-md border border-line p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="text-[11px] font-bold text-ink-subtlest uppercase tracking-widest">Basic Info</h2>
              {/* Either one is enough (canSave): a star on both said both were needed (J-36). */}
              <p className="text-xs text-ink-subtlest mt-1">A company or a role is enough to save the job.</p>
            </div>
            {/* The kit's fields and labels, as the job page's and the other workspace forms': 36 px
                (44 px and 16 px text on a touch screen, so iOS does not zoom in, J-38), and each id is the
                control's, so its label names it (M8). The empty choices are <option>s, not a placeholder,
                so a work mode, a source or a résumé can be unset again. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField id={uid + 'company'} label="Company" autoFocus value={form.company} onChange={e => set('company', e.target.value)} placeholder="Google, Stripe, Notion…" />
              <TextField id={uid + 'role'} label="Role / Position" value={form.role} onChange={e => set('role', e.target.value)} placeholder="Software Engineer, Product Manager…" />
              <TextField id={uid + 'location'} label="Location" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Remote, New York…" />
              <TextField id={uid + 'salary'} label="Salary / Comp" value={form.salary} onChange={e => set('salary', e.target.value)} placeholder="$150k – $200k" />
              {/* The page's Details box shows both: nothing could set them but an imported file (R4-JOB-02). */}
              <Select id={uid + 'workMode'} label="Work Mode" value={form.workMode} onChange={e => set('workMode', e.target.value)}>
                <option value="">— Not set —</option>
                {WORK_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </Select>
              <Select id={uid + 'source'} label="Source" value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="">— Not set —</option>
                {JOB_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
              <TextField id={uid + 'url'} label="Job Posting URL" className="sm:col-span-2" value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://jobs.company.com/…" />
            </div>
          </section>

          <section className="bg-white rounded-md border border-line p-4 sm:p-6 space-y-4">
            <h2 className="text-[11px] font-bold text-ink-subtlest uppercase tracking-widest">Status & Dates</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select id={uid + 'status'} label="Application Status" value={form.status} onChange={e => setStatus(e.target.value)}>
                {JOB_STATUSES.map((s, i) => (
                  <option key={s.id} value={s.id}>{i + 1}. {s.label}</option>
                ))}
              </Select>
              <TextField id={uid + 'appliedDate'} label="Applied Date" type="date" value={form.appliedDate} onChange={e => set('appliedDate', e.target.value)} />
              <TextField id={uid + 'deadline'} label="Deadline" type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
              {/* Its own day: the one date labelled 'Deadline / Follow-up' wrote the deadline, so a
                  follow-up set there never reached 'Follow-ups due' (R4-JOB-02). */}
              <TextField id={uid + 'followUpDate'} label="Follow-up Date" type="date" value={form.followUpDate} onChange={e => set('followUpDate', e.target.value)} />
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
              <TextField id={uid + 'contact'} label="Contact Person" value={form.contact} onChange={e => set('contact', e.target.value)} placeholder="Recruiter name, email…" />
              <Select id={uid + 'resumeId'} label="Resume Used" value={form.resumeId} onChange={e => set('resumeId', e.target.value)}>
                <option value="">— Not linked yet —</option>
                {linkedResume(form, resumes).state === 'deleted' && <option value={form.resumeId}>Résumé deleted</option>}
                {/* Résumés only: a cover letter is no résumé to have applied with (R2-135). */}
                {resumeChoices(form, resumes).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </div>
          </section>
        </form>

        {/* The other cards' padding: a bare p-6 made a phone's notes editor 16 px narrower than the fields (R4-DPH-20). */}
        <section className="bg-white rounded-md border border-line p-4 sm:p-6 space-y-4">
          <h2 className="text-[11px] font-bold text-ink-subtlest uppercase tracking-widest">Notes</h2>
          {/* The Notes tab's editor and format: plain text here was stripped there (J-03). */}
          <RichTextEditor ariaLabel="Notes" value={form.notes} onChange={html => set('notes', html)} rows={4} placeholder="Key contacts, interview format, compensation details, next steps…" />
        </section>

        <div className="flex justify-end gap-2 pb-8">
          <Button variant="ghost" onClick={leave}>Cancel</Button>
          <Button variant="primary" type="submit" form={formId} disabled={!canSave || gone}>
            {isEdit ? 'Save Changes' : 'Add Job'}
          </Button>
        </div>
      </div>
    </div>
  );
}
