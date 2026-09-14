// Job-tracker dates are stored as local calendar days ('YYYY-MM-DD'). `new Date('YYYY-MM-DD')`
// parses that as UTC midnight, which is the previous evening west of Greenwich and 05:30 in
// India, so these helpers keep every comparison in the user's own day.

/** Today's local date as 'YYYY-MM-DD' (toISOString() would give the UTC day). */
export function todayLocalISO(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The last millisecond of a 'YYYY-MM-DD' local day, or null for a blank/invalid value. */
export function endOfLocalDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999) : null;
}

const SOON_MS = 3 * 24 * 60 * 60 * 1000;

/** 'past' once the deadline day is over, 'soon' within 3 days of its end, otherwise null. */
export function deadlineState(iso, now = new Date()) {
  const end = endOfLocalDay(iso);
  if (!end) return null;
  if (end < now) return 'past';
  return end - now < SOON_MS ? 'soon' : null;
}
