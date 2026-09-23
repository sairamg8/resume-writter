// A job's optional fields — source, work mode, excitement, interviews — as a saved list or an
// imported file holds them, read the way readJob reads the rest (normalizeJob.js calls in here).
// Every job saved before these existed has none of them: missing stays missing, and the pages read
// it as empty. No React and no path aliases: Node's test runner loads this file as it is
// (tests/unit/normalize-job.unit.mjs).
import { JOB_SOURCES, WORK_MODES, EXCITEMENT_MAX } from '../constants/jobs.js';

/** A choice's name compared as its letters: case, spaces and dashes aside ('On-site' = 'onsite'). */
const letters = (v) => v.toLowerCase().replace(/[^a-z]/g, '');

const choices = (list, extra) => new Map([...list.flatMap((c) => [[letters(c.id), c.id], [letters(c.label), c.id]]), ...extra]);
const SOURCES = choices(JOB_SOURCES, [['careers', 'company'], ['careerpage', 'company'], ['companywebsite', 'company']]);
const WORK_MODE_IDS = choices(WORK_MODES, [['office', 'onsite'], ['inoffice', 'onsite'], ['inperson', 'onsite'], ['wfh', 'remote']]);

/** The id of the choice `value` names in `ids`; '' for blank text; null for anything else. */
function choiceId(ids, value) {
  if (typeof value !== 'string') return null;
  const key = letters(value);
  return key ? ids.get(key) ?? null : '';
}

/** The source `value` names — its id or its label in any case ('LinkedIn', 'Job board') — '' for blank, else null. */
export const sourceId = (value) => choiceId(SOURCES, value);

/** The work mode `value` names ('Remote', 'On-site', 'office') — '' for blank, else null. */
export const workModeId = (value) => choiceId(WORK_MODE_IDS, value);

const INTERVIEW_TEXT = ['date', 'time', 'kind', 'notes'];

/**
 * The interviews the job page can show, as `{ list, lost }` — the same array when every one is
 * readable. An entry must be an object; its date, time, kind and notes are text (a number → its
 * digits, which loses nothing; anything else → '', a loss).
 */
function readableInterviews(interviews) {
  let lost = false;
  const list = [];
  for (const iv of interviews) {
    if (!iv || typeof iv !== 'object' || Array.isArray(iv)) { lost = true; continue; }
    let out = iv;
    for (const key of INTERVIEW_TEXT) {
      const v = iv[key];
      if (typeof v === 'string' || v == null) continue;
      const number = typeof v === 'number' && Number.isFinite(v);
      if (!number) lost = true;
      if (out === iv) out = { ...iv };
      out[key] = number ? String(v) : '';
    }
    list.push(out);
  }
  const same = list.length === interviews.length && list.every((iv, i) => iv === interviews[i]);
  return { list: same ? interviews : list, lost };
}

/**
 * readJob's part for the optional fields: each repair goes through `set(key, value, loses)`
 * (undefined removes the key). followUpDate is one of readJob's text fields.
 *   source naming no choice      → 'other' when it was a word ('Indeed': the word is lost); '' else
 *   workMode naming no choice    → ''
 *   excitement                   → a whole number 0–5: '4' → 4 (no loss); 7 → 5, 3.6 → 4 (a loss);
 *                                  not a number at all → removed (a loss)
 *   interviews not a list        → removed (a loss); entries as readableInterviews
 * A choice named in other words ('LinkedIn') is kept here; completeJob makes it the id.
 */
export function readOptionalFields(job, set) {
  if (job.source != null && sourceId(job.source) === null) set('source', typeof job.source === 'string' ? 'other' : '', true);
  if (job.workMode != null && workModeId(job.workMode) === null) set('workMode', '', true);
  if (job.excitement != null) {
    const raw = job.excitement;
    const n = typeof raw === 'string' && raw.trim() ? Number(raw) : raw;
    if (typeof n !== 'number' || !Number.isFinite(n)) set('excitement', undefined, true);
    else {
      const v = Math.min(EXCITEMENT_MAX, Math.max(0, Math.round(n)));
      if (v !== raw) set('excitement', v, v !== n);
    }
  }
  if (job.interviews != null) {
    if (!Array.isArray(job.interviews)) set('interviews', undefined, true);
    else {
      const { list, lost } = readableInterviews(job.interviews);
      if (list !== job.interviews) set('interviews', list, lost);
    }
  }
}
