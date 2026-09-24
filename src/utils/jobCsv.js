/**
 * Job Tracker CSV Export Utility
 * Formats job applications into RFC 4180 compliant CSV for Excel / Google Sheets / Notion.
 * No React and no path aliases: Node's test runner loads it as it is (tests/unit/job-csv.unit.mjs).
 */
import { STATUS_MAP, JOB_SOURCES, WORK_MODES } from '../constants/jobs.js';
import { richTextToPlain } from './richText.js';
import { notesToHtml } from './normalizeJob.js';

/**
 * Excel and Sheets run a cell that starts with = + - @ (or a tab / carriage return before one) as a
 * formula, so a company named '=HYPERLINK(…)' became a live link (J-17). Such a cell gets a
 * leading apostrophe, the spreadsheet's own "this is text" mark (OWASP's CSV-injection advice).
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  const text = FORMULA_START.test(str) ? `'${str}` : str;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * A byte-order mark first: Excel opens a CSV without one as the system code page, and every
 * non-ASCII character — the demo salary's '–', a '·', '₹' — turned into mojibake (J-09).
 */
const BOM = '\uFEFF';

/** A choice's label; a value that is not one of them, as stored. */
const labelOf = (list, id) => list.find((c) => c.id === id)?.label || id;

/** One line per interview: its date, time and kind ('2026-09-24 10:00 HR Round'); empty ones left out. */
const interviewLines = (interviews) => (Array.isArray(interviews) ? interviews : [])
  .map((iv) => [iv?.date, iv?.time, iv?.kind].filter(Boolean).join(' '))
  .filter(Boolean)
  .join('\n');

/**
 * The columns, each read from the job as the tracker stores it (useJobStore, JobForm): its `role`,
 * `appliedDate`, `contact` and `stage`, the status as its label. The export read `position`,
 * `appliedAt` and `source`, which no job has, so Position and Applied Date were always empty
 * (bug audit 2026-09-22). `position` / `appliedAt` still read, for a list imported from elsewhere.
 */
const COLUMNS = [
  ['Company', (j) => j.company],
  ['Position', (j) => j.role || j.position],
  ['Status', (j) => STATUS_MAP[j.status]?.label || j.status],
  ['Stage', (j) => j.stage],
  ['Location', (j) => j.location],
  ['Salary', (j) => j.salary],
  ['Applied Date', (j) => j.appliedDate || j.appliedAt],
  ['Deadline', (j) => j.deadline],
  ['URL', (j) => j.url],
  ['Contact', (j) => j.contact],
  // The optional fields, before Notes, so every older column keeps its place.
  ['Follow-up Date', (j) => j.followUpDate],
  ['Work Mode', (j) => labelOf(WORK_MODES, j.workMode)],
  ['Source', (j) => labelOf(JOB_SOURCES, j.source)],
  ['Excitement', (j) => (j.excitement > 0 ? String(j.excitement) : '')],
  ['Interviews', (j) => interviewLines(j.interviews)],
  // The text the user wrote, with its line breaks: the cell held the editor's HTML (J-08).
  ['Notes', (j) => richTextToPlain(notesToHtml(j.notes))],
];

export function jobsToCsv(jobs) {
  const header = COLUMNS.map(([name]) => escapeCsvField(name)).join(',');
  const lines = [header];
  for (const j of Array.isArray(jobs) ? jobs : []) {
    if (!j || typeof j !== 'object') continue;
    lines.push(COLUMNS.map(([, read]) => escapeCsvField(read(j) || '')).join(','));
  }
  return BOM + lines.join('\r\n');
}
