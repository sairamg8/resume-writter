import { BellRing, Briefcase, CalendarClock, MessageSquareReply, Trophy } from 'lucide-react';
import { JOB_STATUSES } from '@/constants/jobs';
import { Avatar, DatePill } from '@/components/ui';
import { Donut } from '@/components/tracker/Charts';
import { useToday } from '@/hooks/useToday';
import { funnelCounts, isDeadlineUpcoming, isFollowUpDue, jobStats } from '@/utils/jobQuery';
import { StatusBadge } from './StatusBadge';

function Stat({ icon: Icon, tone, value, label, hint }) {
  return (
    <div className="flex items-center gap-3 rounded-cv-card border border-cv-hairline bg-cv-surface p-4">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon size={20} aria-hidden="true" /></span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{value} {label}</p>
        <p className="text-[12px] text-ink-subtlest">{hint}</p>
      </div>
    </div>
  );
}

function Card({ title, description, children, className = '' }) {
  return (
    <section className={`flex flex-col gap-4 rounded-cv-card border border-cv-hairline bg-cv-surface p-5 ${className}`}>
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="text-[13px] text-ink-subtle">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** A job as a row of a summary list: company, role, status, and a date pill; opens the job. */
function JobRow({ job, date, onOpen }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(job.id)} className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left hover:bg-hovered focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cv-brand/60">
        <Avatar name={job.company || '?'} size="sm" shape="square" decorative />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{job.company || '—'}</span>
          <span className="block truncate text-[12px] text-ink-subtlest">{job.role || '—'}</span>
        </span>
        {/* On a phone the status sits over the date, at the row's right: side by side they took
            ~175px of a ~300px row and left the company and role about nine characters. */}
        <span className="flex shrink-0 items-center gap-3 max-sm:flex-col max-sm:items-end max-sm:gap-1">
          <StatusBadge statusId={job.status} />
          {date && <DatePill value={date} size="sm" />}
        </span>
      </button>
    </li>
  );
}

/**
 * The job search at a glance: active applications, interviews, offers and the response rate;
 * the funnel from applied to offer; where every job stands; the deadlines of the next two weeks
 * and the follow-ups that are due. `onOpen(id)` opens a job.
 */
export function JobSummary({ jobs, onOpen }) {
  useToday(); // the deadlines ahead and the follow-ups due are read again when the day changes
  const s = jobStats(jobs);
  const funnel = funnelCounts(jobs);
  const top = Math.max(1, funnel[0]?.count ?? 0);
  const ahead = jobs.filter((j) => isDeadlineUpcoming(j)).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const soon = ahead.slice(0, 6);
  // The rest are counted, as the follow-ups' are: a seventh deadline was hidden without a word.
  const moreAhead = ahead.length - soon.length;
  // The most overdue first, as the deadlines are by date: in board order the six shown were
  // whichever sat first, and the rest were hidden without a word (R5-HUNT1).
  const due = jobs.filter((j) => isFollowUpDue(j)).sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
  const followUps = due.slice(0, 6);
  const moreDue = due.length - followUps.length;
  const parts = JOB_STATUSES.map((st) => ({ id: st.id, label: st.label, value: jobs.filter((j) => j.status === st.id).length, color: st.color })).filter((p) => p.value > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Both grids name their narrow column (grid-cols-1): an implicit one grows to the widest
          unwrapped line inside, and would push the cards past a phone's edge. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Briefcase} tone="bg-loz-progress text-loz-progress-ink" value={s.active} label="active" hint={`of ${s.total} tracked`} />
        <Stat icon={CalendarClock} tone="bg-[#dfd8fd] text-[#5e4db2]" value={s.interviewing} label="interviewing" hint="phone screens and interviews" />
        <Stat icon={Trophy} tone="bg-loz-done text-loz-done-ink" value={s.offers} label={s.offers === 1 ? 'offer' : 'offers'} hint="at the offer stage" />
        <Stat icon={MessageSquareReply} tone="bg-[#f8e6a0] text-[#7f5f01]" value={s.responseRate === null ? '—' : `${s.responseRate}%`} label="response rate" hint={`${s.responded} of ${s.applied} applications heard back`} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Pipeline" description="How far your applications got — each step counts the jobs that reached it.">
          <ol className="flex flex-col gap-3">
            {/* 6rem fits the longest step ("Phone Screen") and leaves the bar room even in the
                narrow two-column cards of a desktop, not only on a phone. */}
            {funnel.map((step) => (
              <li key={step.id} className="grid grid-cols-[6rem_1fr_5.5rem] items-center gap-2 text-sm" title={`${step.label}: ${step.count}`}>
                <span className="text-ink">{step.label}</span>
                <span className="h-6 rounded bg-hovered">
                  {step.count > 0 && (
                    <span className="flex h-6 items-center justify-end rounded bg-brand px-2 text-[12px] font-semibold text-white" style={{ width: `${Math.max((step.count / top) * 100, 8)}%` }}>
                      {step.count}
                    </span>
                  )}
                </span>
                <span className="text-right text-[12px] text-ink-subtle">{step.rate === null ? (step.count === 0 ? '0' : '') : `${step.rate}% of prev.`}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Status overview" description="Where every job stands.">
          {parts.length ? <Donut parts={parts} caption="jobs" /> : <p className="text-sm text-ink-subtlest">No jobs yet.</p>}
        </Card>
        <Card title="Upcoming deadlines" description="Open applications with a deadline ahead.">
          {soon.length ? (
            <>
              <ul className="-mx-2 flex flex-col">{soon.map((j) => <JobRow key={j.id} job={j} date={j.deadline} onOpen={onOpen} />)}</ul>
              {moreAhead > 0 && <p className="text-[12px] text-ink-subtlest">+{moreAhead} more {moreAhead === 1 ? 'deadline' : 'deadlines'} ahead</p>}
            </>
          ) : <p className="text-sm text-ink-subtlest">No deadlines ahead.</p>}
        </Card>
        <Card title="Follow-ups due" description="Open applications whose follow-up date has come.">
          {followUps.length ? (
            <>
              <ul className="-mx-2 flex flex-col">{followUps.map((j) => <JobRow key={j.id} job={j} date={j.followUpDate} onOpen={onOpen} />)}</ul>
              {moreDue > 0 && <p className="text-[12px] text-ink-subtlest">+{moreDue} more {moreDue === 1 ? 'follow-up' : 'follow-ups'} due</p>}
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm text-ink-subtlest"><BellRing size={16} aria-hidden="true" /> Nothing to chase today.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
