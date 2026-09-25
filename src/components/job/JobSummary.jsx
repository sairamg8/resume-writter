import { BellRing, Briefcase, CalendarClock, MessageSquareReply, Trophy } from 'lucide-react';
import { JOB_STATUSES } from '@/constants/jobs';
import { Avatar, DatePill } from '@/components/ui';
import { Donut } from '@/components/tracker/Charts';
import { funnelCounts, isFollowUpDue, isOpen, jobStats } from '@/utils/jobQuery';
import { todayLocalISO } from '@/utils/dates';
import { StatusBadge } from './StatusBadge';

function Stat({ icon: Icon, tone, value, label, hint }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-white p-4">
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
    <section className={`flex flex-col gap-4 rounded-md border border-line bg-white p-5 ${className}`}>
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
      <button type="button" onClick={() => onOpen(job.id)} className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left hover:bg-hovered focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60">
        <Avatar name={job.company || '?'} size="sm" shape="square" decorative />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{job.company || '—'}</span>
          <span className="block truncate text-[12px] text-ink-subtlest">{job.role || '—'}</span>
        </span>
        <StatusBadge statusId={job.status} />
        {date && <DatePill value={date} size="sm" />}
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
  const s = jobStats(jobs);
  const funnel = funnelCounts(jobs);
  const top = Math.max(1, funnel[0]?.count ?? 0);
  const today = todayLocalISO();
  const soon = jobs.filter((j) => isOpen(j) && j.deadline && j.deadline >= today).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 6);
  const followUps = jobs.filter((j) => isFollowUpDue(j)).slice(0, 6);
  const parts = JOB_STATUSES.map((st) => ({ id: st.id, label: st.label, value: jobs.filter((j) => j.status === st.id).length, color: st.color })).filter((p) => p.value > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Briefcase} tone="bg-loz-progress text-loz-progress-ink" value={s.active} label="active" hint={`of ${s.total} tracked`} />
        <Stat icon={CalendarClock} tone="bg-[#dfd8fd] text-[#5e4db2]" value={s.interviewing} label="interviewing" hint="phone screens and interviews" />
        <Stat icon={Trophy} tone="bg-loz-done text-loz-done-ink" value={s.offers} label={s.offers === 1 ? 'offer' : 'offers'} hint="at the offer stage" />
        <Stat icon={MessageSquareReply} tone="bg-[#f8e6a0] text-[#7f5f01]" value={s.responseRate === null ? '—' : `${s.responseRate}%`} label="response rate" hint={`${s.responded} of ${s.applied} applications heard back`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Pipeline" description="How far your applications got — each step counts the jobs that reached it.">
          <ol className="flex flex-col gap-3">
            {funnel.map((step) => (
              <li key={step.id} className="grid grid-cols-[7.5rem_1fr_5.5rem] items-center gap-3 text-sm" title={`${step.label}: ${step.count}`}>
                <span className="text-ink">{step.label}</span>
                <span className="h-6 rounded bg-hovered">
                  <span className="flex h-6 items-center justify-end rounded bg-brand px-2 text-[12px] font-semibold text-white" style={{ width: `${Math.max((step.count / top) * 100, step.count ? 8 : 0)}%` }}>
                    {step.count > 0 && step.count}
                  </span>
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
          {soon.length ? <ul className="-mx-2 flex flex-col">{soon.map((j) => <JobRow key={j.id} job={j} date={j.deadline} onOpen={onOpen} />)}</ul> : <p className="text-sm text-ink-subtlest">No deadlines ahead.</p>}
        </Card>
        <Card title="Follow-ups due" description="Open applications whose follow-up date has come.">
          {followUps.length ? <ul className="-mx-2 flex flex-col">{followUps.map((j) => <JobRow key={j.id} job={j} date={j.followUpDate} onOpen={onOpen} />)}</ul> : (
            <p className="flex items-center gap-2 text-sm text-ink-subtlest"><BellRing size={16} aria-hidden="true" /> Nothing to chase today.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
