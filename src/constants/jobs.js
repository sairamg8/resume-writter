// The job tracker's vocabulary: statuses and the optional fields' choices. Plain data, no imports,
// so the pure job utilities and their node tests load it as it is.

export const JOB_STATUSES = [
  { id: 'saved',        label: 'Saved',        color: '#64748b', bg: '#f1f5f9', text: '#334155' },
  { id: 'applied',      label: 'Applied',      color: '#2563eb', bg: '#eff6ff', text: '#1d4ed8' },
  { id: 'phone_screen', label: 'Phone Screen', color: '#7c3aed', bg: '#f5f3ff', text: '#6d28d9' },
  { id: 'interview',    label: 'Interview',    color: '#d97706', bg: '#fffbeb', text: '#b45309' },
  { id: 'offer',        label: 'Offer',        color: '#16a34a', bg: '#f0fdf4', text: '#15803d' },
  { id: 'on_hold',      label: 'On Hold',      color: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
  { id: 'rejected',     label: 'Rejected',     color: '#dc2626', bg: '#fef2f2', text: '#b91c1c' },
  { id: 'withdrawn',    label: 'Withdrawn',    color: '#9ca3af', bg: '#f9fafb', text: '#6b7280' },
];

export const STATUS_MAP = Object.fromEntries(JOB_STATUSES.map(s => [s.id, s]));

/** The pipeline, in order: the board's open columns, the stepper, and "open" for follow-ups. */
export const PIPELINE_STATUSES = ['saved', 'applied', 'phone_screen', 'interview', 'offer'];

/** The closed statuses: the board's collapsed rails. */
export const CLOSED_STATUSES = ['on_hold', 'rejected', 'withdrawn'];

/** Still moving, as the "Active" stat counts it: not offer, on hold, rejected or withdrawn. */
export const ACTIVE_STATUSES = ['saved', 'applied', 'phone_screen', 'interview'];

/** In interviews, as the "Interviewing" stat counts it. */
export const INTERVIEWING_STATUSES = ['phone_screen', 'interview'];

/** Where the job was found (`job.source`); '' is not set. */
export const JOB_SOURCES = [
  { id: 'linkedin',  label: 'LinkedIn' },
  { id: 'company',   label: 'Company site' },
  { id: 'referral',  label: 'Referral' },
  { id: 'recruiter', label: 'Recruiter' },
  { id: 'board',     label: 'Job board' },
  { id: 'other',     label: 'Other' },
];

/** Where the work happens (`job.workMode`); '' is not set. */
export const WORK_MODES = [
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'onsite', label: 'On-site' },
];

/** `job.excitement` runs 0 (not rated) to this. */
export const EXCITEMENT_MAX = 5;
