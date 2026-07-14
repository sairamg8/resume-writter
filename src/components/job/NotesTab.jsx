import RichTextEditor from '@/components/RichTextEditor';

export function NotesTab({ job, set }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Notes</p>
      <RichTextEditor
        key={job.id}
        value={job.notes || ''}
        onChange={html => set('notes', html)}
        placeholder="Interview format, recruiter details, key contacts, salary expectations, company culture impressions, next steps, gut feeling…"
        rows={18}
      />
    </div>
  );
}
