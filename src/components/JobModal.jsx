import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { JOB_STATUSES } from '@/constants/jobs';

const STAGE_SUGGESTIONS = [
  'Phone Screen', 'Technical Round 1', 'Technical Round 2',
  'DSA Round', 'HR Round', 'Manager Round', 'System Design Round',
  'Final Round', 'Onsite Interview', 'Take-Home Assignment',
  'Panel Interview', 'Culture Fit Round',
];

export function JobModal({ job, resumes, onSave, onClose }) {
  const isNew = !job;
  const [form, setForm] = useState(() => ({
    company: '', role: '', status: 'applied', stage: '',
    url: '', location: '', salary: '',
    contact: '', resumeId: '', notes: '',
    appliedDate: new Date().toISOString().slice(0, 10), deadline: '',
    todos: [],
    ...(job || {}),
  }));

  const firstRef = useRef(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  useEffect(() => {
    function handle(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const canSave = form.company.trim() || form.role.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onMouseDown={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{isNew ? 'Add Job Application' : 'Edit Job Application'}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Company + Role */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Company</label>
              <input
                ref={firstRef}
                value={form.company}
                onChange={e => set('company', e.target.value)}
                placeholder="Google, Stripe, Notion…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Role / Position</label>
              <input
                value={form.role}
                onChange={e => set('role', e.target.value)}
                placeholder="Software Engineer, Product Manager…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status + Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Application Status</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {JOB_STATUSES.map((s, i) => (
                  <option key={s.id} value={s.id}>{i + 1}. {s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Interview Stage <span className="font-normal text-gray-400">(optional)</span></label>
              <input
                list="stage-suggestions"
                value={form.stage || ''}
                onChange={e => set('stage', e.target.value)}
                placeholder="e.g. DSA Round, HR Round…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <datalist id="stage-suggestions">
                {STAGE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>

          {/* Applied Date + Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Applied Date</label>
              <input
                type="date"
                value={form.appliedDate}
                onChange={e => set('appliedDate', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Deadline / Follow-up</label>
              <input
                type="date"
                value={form.deadline}
                onChange={e => set('deadline', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Job Posting URL</label>
            <input
              value={form.url}
              onChange={e => set('url', e.target.value)}
              placeholder="https://jobs.company.com/…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Location + Salary */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Location</label>
              <input
                value={form.location}
                onChange={e => set('location', e.target.value)}
                placeholder="Remote, New York…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Salary / Comp</label>
              <input
                value={form.salary}
                onChange={e => set('salary', e.target.value)}
                placeholder="$150k – $200k"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Contact + Resume */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Contact Person</label>
              <input
                value={form.contact}
                onChange={e => set('contact', e.target.value)}
                placeholder="Recruiter name, email…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Resume Used</label>
              <select
                value={form.resumeId}
                onChange={e => set('resumeId', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">— Not linked yet —</option>
                {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="Key contacts, interview format, next steps…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => canSave && onSave(form)}
            disabled={!canSave}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isNew ? 'Add Job' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
