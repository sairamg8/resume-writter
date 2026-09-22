/**
 * Job Tracker CSV Export Utility
 * Formats job applications into RFC 4180 compliant CSV for Excel / Google Sheets / Notion.
 * No React and no path aliases: Node's test runner loads it as it is (tests/unit/job-csv.unit.mjs).
 */
import { STATUS_MAP } from '../constants/jobs.js';

export function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

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
  ['Notes', (j) => j.notes],
];

export function jobsToCsv(jobs) {
  const header = COLUMNS.map(([name]) => escapeCsvField(name)).join(',');
  const lines = [header];
  for (const j of Array.isArray(jobs) ? jobs : []) {
    if (!j || typeof j !== 'object') continue;
    lines.push(COLUMNS.map(([, read]) => escapeCsvField(read(j) || '')).join(','));
  }
  return lines.join('\r\n');
}
