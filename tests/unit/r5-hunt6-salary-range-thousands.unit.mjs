// R5-HUNT6-SALARY-RANGE-SHARED-THOUSANDS: a salary range that writes its thousands only on the second
// number ('$90-120,000', '€40-50.000') sorts by its first amount in thousands, not as 90 or 40, so
// the list view's Salary sort puts it among the real salaries (src/utils/jobQuery.js salaryValue).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { salaryValue, sortJobs } from '../../src/utils/jobQuery.js';

test('a range whose second number carries the thousands scales the first one too', () => {
  assert.equal(salaryValue('$90-120,000'), 90000);
  assert.equal(salaryValue('$40-50,000'), 40000);
  assert.equal(salaryValue('€40-50.000'), 40000);
  assert.equal(salaryValue('40 – 55 000 €'), 40000);
  assert.equal(salaryValue('$1-1,500,000'), 1000000);
});

test('a first number written in full, or a range with a unit, reads as before', () => {
  assert.equal(salaryValue('90000-120,000'), 90000);
  assert.equal(salaryValue('$90,000-120,000'), 90000);
  assert.equal(salaryValue('$120-150k'), 120000);
  assert.equal(salaryValue('90-120'), 90);
  assert.equal(salaryValue('$50,000'), 50000);
  assert.equal(salaryValue('10-15 LPA'), 1000000);
});

test('the Salary sort puts "$90-120,000" above "$50,000", not below it', () => {
  const jobs = [
    { id: 'a', company: 'Range', salary: '$90-120,000' },
    { id: 'b', company: 'Flat', salary: '$50,000' },
  ];
  assert.deepEqual(sortJobs(jobs, 'salary', 'asc').map((j) => j.company), ['Flat', 'Range']);
  assert.deepEqual(sortJobs(jobs, 'salary', 'desc').map((j) => j.company), ['Range', 'Flat']);
});
