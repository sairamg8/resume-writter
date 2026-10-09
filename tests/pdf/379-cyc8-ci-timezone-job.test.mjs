// Defect: CI ran only in UTC (the ubuntu container), so a local-versus-UTC date bug in the app (a day off
// for a user at UTC+13 or UTC-8, a month end or a clock-change day) could not fail there. The ci workflow
// now has a `timezones` job that runs a named list of date-sensitive test files with the process clock in
// Pacific/Auckland, America/Los_Angeles and Asia/Kolkata. Pins that the job is in the full gate and on a
// push (as the suite is), that it sets the zone from its matrix, that the list names real files, and that
// none of them builds its clock from a UTC literal, which would read differently in each zone.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const ci = read('.github/workflows/ci.yml');

/** The text of job `name` (two-space indented under jobs:), up to the next job. */
function jobText(name) {
  const start = ci.search(new RegExp(`^  ${name}:$`, 'm'));
  assert.ok(start >= 0, `ci.yml has a ${name} job`);
  const rest = ci.slice(start + 1);
  const next = rest.search(/^ {2}[a-z-]+:$/m);
  return next < 0 ? rest : rest.slice(0, next);
}

const ifOf = (name) => jobText(name).match(/^ {4}if: (.*)$/m)?.[1];

/** The files the job names: the lines of its TZ_TESTS block (a folded scalar, one path per line). */
function namedFiles() {
  const block = /^ {6}TZ_TESTS: >-\n((?: {8}\S.*\n)+)/m.exec(jobText('timezones'));
  assert.ok(block, 'the job lists its test files in TZ_TESTS');
  return block[1].split('\n').map((l) => l.trim()).filter(Boolean);
}

describe('the timezones job', () => {
  it('runs in the full gate and on a push, exactly when the suite does', () => {
    assert.ok(ifOf('timezones'), 'the job has a condition');
    assert.equal(ifOf('timezones'), ifOf('suite'));
  });

  it('is one shard per zone: Auckland, Los Angeles and Kolkata, and sets the zone from its matrix', () => {
    const job = jobText('timezones');
    assert.match(job, /^ {8}tz: \[Pacific\/Auckland, America\/Los_Angeles, Asia\/Kolkata\]$/m);
    assert.match(job, /^ {10}TZ: \$\{\{ matrix\.tz \}\}$/m);
    assert.match(job, /node --test .*\$TZ_TESTS/);
    assert.match(job, /fail-fast: false/);
  });

  it('names real, distinct test files, the date-sensitive ones among them', () => {
    const files = namedFiles();
    assert.equal(new Set(files).size, files.length, 'no file twice');
    for (const f of files) {
      assert.match(f, /^tests\/unit\/[\w.-]+\.unit\.mjs$/, f);
      assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} exists`);
    }
    for (const f of ['tests/unit/dates.unit.mjs', 'tests/unit/job-query.unit.mjs', 'tests/unit/ui-format.unit.mjs', 'tests/unit/board-model.unit.mjs',
      'tests/unit/tracker-views.unit.mjs', 'tests/unit/377-cyc8-demo-deadline-dst.unit.mjs', 'tests/unit/378-cyc8-calendar-summary-zones.unit.mjs']) {
      assert.ok(files.includes(f), `${f} is in the list`);
    }
  });

  it('lists no file that builds its clock from a date-only text (UTC midnight reads as another day in another zone)', () => {
    for (const f of namedFiles()) {
      const source = read(f);
      assert.doesNotMatch(source, /new Date\(\s*['"`]\d{4}-\d{2}-\d{2}/, `${f}: new Date('YYYY-MM-DD') is UTC midnight`);
    }
  });
});
