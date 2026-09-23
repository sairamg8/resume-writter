import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeCsvField, jobsToCsv } from '../../src/utils/jobCsv.js';

test('escapeCsvField: handles null, undefined, quotes and special characters', () => {
  assert.equal(escapeCsvField(null), '""');
  assert.equal(escapeCsvField(undefined), '""');
  assert.equal(escapeCsvField('Google'), '"Google"');
  assert.equal(escapeCsvField('Engineer "Lead"'), '"Engineer ""Lead"""');
  assert.equal(escapeCsvField('Line 1\nLine 2'), '"Line 1\nLine 2"');
});

/** The CSV as rows of cells (no cell here holds a newline or a quote); the BOM (J-09) aside. */
const rows = (csv) => csv.replace(/^\uFEFF/, '').split('\r\n').map((line) => line.slice(1, -1).split('","'));

// A job as the tracker stores it (useJobStore.addJob, JobForm). The export read `position`,
// `appliedAt` and `source` — fields no job has — so Position and Applied Date were always empty
// (bug audit 2026-09-22); this test used that same wrong shape, so it passed.
const APPLE = {
  id: 'job_1', company: 'Apple', role: 'Senior iOS Engineer', status: 'phone_screen', stage: 'Technical Round 1',
  location: 'Cupertino, CA', salary: '$190,000 - $220,000', appliedDate: '2026-09-18', deadline: '2026-10-15',
  url: 'https://apple.com/jobs/123', contact: 'Jane Doe', notes: 'Passed recruiter screen', resumeId: 'resume_x',
  todos: [], statusHistory: [], createdAt: 1, updatedAt: 2,
};

test('jobsToCsv: every column holds the job’s own field, the status as its label', () => {
  const [header, apple] = rows(jobsToCsv([APPLE]));
  assert.deepEqual(header, ['Company', 'Position', 'Status', 'Stage', 'Location', 'Salary', 'Applied Date', 'Deadline', 'URL', 'Contact', 'Notes']);
  assert.deepEqual(apple, ['Apple', 'Senior iOS Engineer', 'Phone Screen', 'Technical Round 1', 'Cupertino, CA', '$190,000 - $220,000', '2026-09-18', '2026-10-15', 'https://apple.com/jobs/123', 'Jane Doe', 'Passed recruiter screen']);
});

test('jobsToCsv: a job with fields missing prints empty cells, and a status it does not know as stored', () => {
  const [, row] = rows(jobsToCsv([{ company: 'Meta', status: 'ghosted' }]));
  assert.deepEqual(row, ['Meta', '', 'ghosted', '', '', '', '', '', '', '', '']);
  // A list from another tool that names them position / appliedAt still reads.
  const [, other] = rows(jobsToCsv([{ company: 'X', position: 'Staff SWE', appliedAt: '2026-09-19', status: 'applied' }]));
  assert.deepEqual(other.slice(0, 3).concat(other[6]), ['X', 'Staff SWE', 'Applied', '2026-09-19']);
});

test('jobsToCsv: returns the header row when given an empty list, and skips entries that are not jobs', () => {
  assert.equal(jobsToCsv([]).split('\r\n').length, 1);
  assert.ok(jobsToCsv([]).startsWith('\uFEFF"Company","Position","Status"'));
  assert.equal(jobsToCsv([null, 'x', APPLE]).split('\r\n').length, 2);
  assert.equal(jobsToCsv(undefined).split('\r\n').length, 1);
});

// ── J-08 · J-09 · J-17 ───────────────────────────────────────────────────────────────────────

/** The CSV's rows, split the way a spreadsheet reads them (quotes, doubled quotes, newlines in a cell). */
function parseCsv(text) {
  const out = [[]];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.at(-1).push(cell); cell = ''; } else if (c === '\r' && text[i + 1] === '\n') {
      out.at(-1).push(cell); cell = ''; out.push([]); i += 1;
    } else cell += c;
  }
  out.at(-1).push(cell);
  return out;
}
const csvRows = (csv) => parseCsv(csv.replace(/^﻿/, ''));
const cellOf = (csv, column, row = 1) => {
  const rowsOf = csvRows(csv);
  return rowsOf[row][rowsOf[0].indexOf(column)];
};

test('J-08: Notes export as the text the user wrote — line breaks, no markup, no entities', () => {
  const csv = jobsToCsv([{ ...APPLE, notes: '<p>a <strong>b</strong> &amp; c</p><p>d</p>' }]);
  assert.equal(cellOf(csv, 'Notes'), 'a b & c\nd');
  // Legacy plain notes (the form's old textarea) keep their text too.
  assert.equal(cellOf(jobsToCsv([{ ...APPLE, notes: 'Salary <tbd>' }]), 'Notes'), 'Salary <tbd>');
});

test('J-09: the file starts with a UTF-8 BOM, so Excel reads – · ₹ as written', () => {
  const csv = jobsToCsv([{ ...APPLE, salary: '₹30 LPA – ₹40 LPA', contact: 'Sarah · Recruiter' }]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.equal(cellOf(csv, 'Salary'), '₹30 LPA – ₹40 LPA');
  assert.equal(jobsToCsv([]).charCodeAt(0), 0xfeff, 'the header-only file too');
});

test('J-17: a cell a spreadsheet would run as a formula is written as text', () => {
  for (const v of ['=1+1', '+SUM(1,1)', '-2+3', '@cmd', '\t=1', '\r=1']) {
    assert.equal(escapeCsvField(v), `"'${v.replace(/"/g, '""')}"`, JSON.stringify(v));
  }
  assert.equal(escapeCsvField('=HYPERLINK("http://evil.example","Click")'), '"\'=HYPERLINK(""http://evil.example"",""Click"")"');
  const csv = jobsToCsv([{ ...APPLE, company: '=HYPERLINK("http://evil.example","Click")' }]);
  assert.equal(cellOf(csv, 'Company'), '\'=HYPERLINK("http://evil.example","Click")');
  // Ordinary text is untouched.
  for (const v of ['Google', '$120k', 'a=b', 'Remote - EU']) assert.equal(escapeCsvField(v), `"${v}"`);
});
