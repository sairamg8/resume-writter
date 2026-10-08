import { ExternalLink, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { StatusBadge } from '@/components/job/StatusBadge';
import { Avatar, IconButton } from '@/components/ui';
import { deadlineState } from '@/utils/dates';
import { safeHref } from '@/utils/richText';
import { isOpen, linkedResume, sortJobs } from '@/utils/jobQuery';
import { useSessionState } from '@/hooks/useSessionState';

/** Last updated first: the order the list opens in, and the one a third header click returns to. */
const DEFAULT_SORT = { key: 'updatedAt', dir: 'desc' };

function SortIcon({ active, dir }) {
  if (!active) return null;
  return dir === 'asc' ? <ChevronUp size={11} className="inline ml-0.5" /> : <ChevronDown size={11} className="inline ml-0.5" />;
}

const COLS = [
  { key: 'company',     label: 'Company' },
  { key: 'role',        label: 'Role' },
  { key: 'status',      label: 'Status' },
  { key: 'location',    label: 'Location' },
  { key: 'salary',      label: 'Salary' },
  { key: 'appliedDate', label: 'Applied' },
  { key: 'deadline',    label: 'Deadline' },
  { key: 'contact',     label: 'Contact' },
];

/** A sort saved earlier in the tab is restored only while it names the default or a column still here. */
const validSort = s => Boolean(s) && (s.key === DEFAULT_SORT.key || COLS.some(c => c.key === s.key)) && (s.dir === 'asc' || s.dir === 'desc');

export function ListView({ jobs, resumes, onNavigate, onDelete }) {
  // Kept for the tab's session: opening a job and coming back put the list in its default order (J-30).
  const [sort, setSort] = useSessionState('cpwtcv_jobs_sort', DEFAULT_SORT, validSort);

  // asc → desc → the default order again, which no header click used to reach (J-18).
  function toggleSort(key) {
    setSort(s => s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : DEFAULT_SORT);
  }

  // Each column by its own kind — status in pipeline order, salary by amount, blanks last (J-18).
  const sorted = sortJobs(jobs, sort.key, sort.dir);

  return (
    <div className="overflow-x-auto rounded-cv-card border border-cv-hairline bg-cv-surface">
      <table className="w-full min-w-[60rem] text-sm">
        <thead>
          <tr className="border-b-2 border-cv-hairline">
            {COLS.map(col => (
              <th
                key={col.key}
                aria-sort={sort.key !== col.key ? 'none' : sort.dir === 'asc' ? 'ascending' : 'descending'}
                className="h-10 px-3 text-left text-[12px] font-semibold whitespace-nowrap text-ink-subtle"
              >
                {/* A button, not a click on the cell: Tab never reached a header, so the list could not be sorted from the keyboard. */}
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className="inline-flex cursor-pointer items-center rounded px-1 font-semibold select-none hover:bg-neutral-fill hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cv-brand"
                >
                  {col.label}
                  <SortIcon active={sort.key === col.key} dir={sort.dir} />
                </button>
              </th>
            ))}
            <th className="px-3 text-left text-[12px] font-semibold whitespace-nowrap text-ink-subtle">Tasks</th>
            <th className="px-3 text-right text-[12px] font-semibold whitespace-nowrap text-ink-subtle">Résumé</th>
            <th className="w-12 px-3"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(job => {
            // A link to a résumé since deleted says so, as the job page does, not '—' as if never linked (J-21).
            const link = linkedResume(job, resumes);
            return (
              <tr
                key={job.id}
                onClick={() => onNavigate(job.id)}
                className="group h-11 cursor-pointer border-b border-cv-hairline-subtle transition-colors last:border-0 hover:bg-hovered"
              >
                <td className="px-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={job.company || '?'} size="xs" shape="square" decorative />
                    {/* The row's click is the mouse's; this button is Tab's and Enter's — a row is not focusable (R2-039). */}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onNavigate(job.id); }}
                      className="rounded text-left font-medium text-ink hover:text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cv-brand"
                    >
                      {job.company || '—'}
                    </button>
                    {safeHref(job.url) && (
                      <a
                        href={safeHref(job.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        title="Open job posting"
                        aria-label={`Open the ${job.company || 'job'} posting`}
                        className="text-ink-subtlest hover:text-brand opacity-0 group-hover:opacity-100 focus-visible:opacity-100 no-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-3 text-ink">{job.role || '—'}</td>
                <td className="px-3"><StatusBadge statusId={job.status} /></td>
                <td className="px-3 text-[13px] text-ink-subtle">{job.location || '—'}</td>
                <td className="px-3 text-[13px] text-ink-subtle">{job.salary || '—'}</td>
                <td className="px-3 text-[13px] text-ink-subtle">{job.appliedDate || '—'}</td>
                <td className="px-3 text-[13px]">
                  {job.deadline ? (() => {
                    // A closed job has nothing to chase: its passed deadline is no longer late.
                    const state = isOpen(job) ? deadlineState(job.deadline) : null;
                    const past = state === 'past';
                    const soon = state === 'soon';
                    return (
                      <span className={past ? 'font-medium text-cv-bad' : soon ? 'font-medium text-cv-warn' : 'text-ink-subtle'}>
                        {job.deadline}
                      </span>
                    );
                  })() : <span className="text-ink-subtlest">—</span>}
                </td>
                <td className="px-3 text-[13px] text-ink-subtle">
                  {/* A table cell ignores max-width, so a long contact widened the column on one
                      line; a block inside the cell holds it to 140px and ends it with an ellipsis. */}
                  <div className="max-w-[140px] truncate" title={job.contact || undefined}>
                    {job.contact || <span className="text-ink-subtlest">—</span>}
                  </div>
                </td>
                <td className="px-3">
                  {(job.todos?.length > 0) && (() => {
                    const done = job.todos.filter(t => t.done).length;
                    const all = job.todos.length;
                    const pct = Math.round((done / all) * 100);
                    return (
                      <div className="flex items-center gap-1.5 min-w-[60px]">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-hovered">
                          <div
                            className={`h-full rounded-full ${done === all ? 'bg-[#22a06b]' : 'bg-brand'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] whitespace-nowrap text-ink-subtlest">{done}/{all}</span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-3 text-right">
                  {link.state === 'linked'
                    ? <span className="rounded-[3px] bg-brand-subtle px-1.5 py-0.5 text-[12px] text-brand">{link.resume.name}</span>
                    : link.state === 'deleted'
                      ? <span className="text-[12px] whitespace-nowrap text-ink-subtlest">Résumé deleted</span>
                      : <span className="text-[12px] text-ink-subtlest">—</span>
                  }
                </td>
                <td className="px-3">
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 no-hover:opacity-100 transition-opacity">
                    {/* The kit's small button, as the boards' row menus have (a hand-rolled box was 25 px). */}
                    <IconButton
                      icon={Trash2}
                      label="Delete application"
                      size="sm"
                      variant="danger"
                      tooltip={false}
                      title="Delete application"
                      onClick={e => { e.stopPropagation(); onDelete(job.id); }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}

          {sorted.length === 0 && (
            <tr>
              <td colSpan={11} className="px-4 py-16 text-center">
                <p className="mb-1 text-sm text-ink-subtle">No jobs here</p>
                <p className="text-[13px] text-ink-subtlest">Add one with “Add job” at the top, or clear the filters.</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
