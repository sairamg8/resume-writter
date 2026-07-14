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
