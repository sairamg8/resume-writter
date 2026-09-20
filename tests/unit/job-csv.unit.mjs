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

test('jobsToCsv: formats job applications list into RFC 4180 CSV', () => {
  const jobs = [
    {
      company: 'Apple',
      position: 'Senior iOS Engineer',
      status: 'interview',
      location: 'Cupertino, CA',
      salary: '$190,000 - $220,000',
      deadline: '2026-10-15',
      appliedAt: '2026-09-18',
      url: 'https://apple.com/jobs/123',
      source: 'Referral',
      notes: 'Passed recruiter screen, technical round next'
    },
    {
      company: 'Meta',
      position: 'Staff SWE',
      status: 'applied',
      location: 'Remote',
      salary: '$240k',
      deadline: '',
      appliedAt: '2026-09-19',
      url: 'https://meta.com/careers',
      source: 'LinkedIn',
      notes: ''
    }
  ];

  const csv = jobsToCsv(jobs);
  assert.ok(csv.includes('"Company","Position","Status"'));
  assert.ok(csv.includes('"Apple","Senior iOS Engineer","interview"'));
  assert.ok(csv.includes('"Meta","Staff SWE","applied"'));
  assert.ok(csv.includes('"$190,000 - $220,000"'));
});

test('jobsToCsv: returns headers when given empty list', () => {
  const csv = jobsToCsv([]);
  assert.ok(csv.includes('Company,Position,Status'));
});
