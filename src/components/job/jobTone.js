// A job status as the tracker's lozenges colour it: waiting to apply grey, moving through the
// pipeline blue, an offer green, on hold amber, rejected red, withdrawn grey. No imports, so the
// node tests load it as it is.

export const JOB_TONE = {
  saved: 'todo',
  applied: 'inprogress',
  phone_screen: 'inprogress',
  interview: 'inprogress',
  offer: 'done',
  on_hold: 'warning',
  rejected: 'danger',
  withdrawn: 'todo',
};

/** The tone of status `id` ('todo' for one this build does not know). */
export const jobTone = (id) => JOB_TONE[id] ?? 'todo';
