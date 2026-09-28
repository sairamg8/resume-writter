import RichTextEditor from '@/components/RichTextEditor';

export function NotesTab({ job, set }) {
  return (
    // The job page's card, as the Overview and Tasks tabs draw theirs: this one alone was rounder,
    // lighter-edged and more padded, which showed on switching tabs (R4-DPH-20).
    <div className="bg-white rounded-md border border-line p-5 shadow-sm">
      {/* The job page's card heading, as its Details box draws one (R4-DVIS-09). */}
      <p className="text-sm font-semibold text-ink mb-4">Notes</p>
      <RichTextEditor
        key={job.id}
        ariaLabel="Notes"
        value={job.notes || ''}
        onChange={html => set('notes', html)}
        placeholder="Interview format, recruiter details, key contacts, salary expectations, company culture impressions, next steps, gut feeling…"
        rows={18}
      />
    </div>
  );
}
