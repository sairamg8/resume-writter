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

/**
 * A from–to range as the exports print it: "05/2023 – 05/2026", "05/2023" alone, "– 05/2026"
 * when only the end is known (a certificate's expiry), '' when neither is. One helper for the
 * PDF's two columns and Word, which each built it slightly differently (R2-7).
 */
export function dateRange(start, end) {
  const [a, b] = [start, end].map((v) => (typeof v === 'string' ? v.trim() : ''));
  if (a && b) return `${a} – ${b}`;
  return a || (b ? `– ${b}` : '');
}
