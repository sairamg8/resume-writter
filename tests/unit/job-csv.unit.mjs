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

/** The CSV as rows of cells (no cell here holds a newline or a quote). */
const rows = (csv) => csv.split('\r\n').map((line) => line.slice(1, -1).split('","'));

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
  assert.ok(jobsToCsv([]).startsWith('"Company","Position","Status"'));
  assert.equal(jobsToCsv([null, 'x', APPLE]).split('\r\n').length, 2);
  assert.equal(jobsToCsv(undefined).split('\r\n').length, 1);
});
