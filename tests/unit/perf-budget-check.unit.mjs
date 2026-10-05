// The performance harness's pure part (R2-142, PERF-1): tests/perf/budget-check.mjs holds a run's numbers to the
// budgets in tests/perf/budgets.mjs and prints the table, and tests/perf/run.mjs exits non-zero over budget.
// Timing itself is the harness's job and runs only on request (yarn test:perf, or a dispatch with `perf`);
// this pins everything that decides whether a run passes: the statistics, the limits (a ceiling, a floor, the
// plan's target in --strict, --slack for timings only), a measurement with no budget or a budget with no
// measurement, the start-up path of a build, the options, the budgets' own shape — and that the workflow
// keeps the perf job out of the gate.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_GROUPS, GROUPS, checkBudgets, formatTable, formatValue, limitOf, loadedByHtml, median, parseArgs,
  sample, spread, startupPath, validateBudgets,
} from '../perf/budget-check.mjs';
import { BUDGETS } from '../perf/budgets.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const ceiling = { id: 'a.time', group: 'render', label: 'A time', unit: 'ms', max: 100, target: 40 };
const floor = { id: 'a.pages', group: 'keystroke', label: 'A page count', unit: 'count', min: 3 };
const size = { id: 'a.size', group: 'startup', label: 'A size', unit: 'kB', max: 1000 };

describe('statistics', () => {
  it('median is the middle value, the mean of the two middle ones, and ignores what is not a number', () => {
    assert.equal(median([9, 1, 5]), 5);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.equal(median([7, NaN, Infinity, 1, 3]), 3);
    assert.ok(Number.isNaN(median([])));
    const input = [3, 1, 2];
    median(input);
    assert.deepEqual(input, [3, 1, 2], 'the caller\'s samples keep their order');
  });

  it('sample runs the warm-ups untimed, then times each run with the clock it is given', async () => {
    let clock = 0;
    const calls = [];
    // The clock advances 10 ms per read; each run's own work adds its index, so a timed run reads as 10 + index.
    const now = () => { clock += 10; return clock; };
    const times = await sample(async (i) => { calls.push(i); clock += i < 0 ? 1000 : i; }, { runs: 3, warmups: 2, now });
    assert.deepEqual(calls, [-1, -2, 0, 1, 2], 'two warm-ups (negative indexes), then three runs');
    assert.deepEqual(times, [10, 11, 12], 'a warm-up\'s cost is not in a run\'s time');
    assert.deepEqual(await sample(() => {}, { runs: 0, warmups: 0 }), []);
  });

  it('spread names the number of samples and their extremes', () => {
    assert.equal(spread([61.24, 88, 51]), 'median of 3 (min 51 ms, max 88 ms)');
    assert.equal(spread([]), 'no samples');
  });
});

describe('limits', () => {
  it('a ceiling is max; strict mode holds a timing to the plan\'s target where the budget has one', () => {
    assert.equal(limitOf(ceiling), 100);
    assert.equal(limitOf(ceiling, { strict: true }), 40);
    assert.equal(limitOf(size, { strict: true }), 1000, 'no target: the ceiling stands');
  });

  it('--slack scales a timing\'s limit, in strict mode too, and never a size, a count or a floor', () => {
    assert.equal(limitOf(ceiling, { slack: 2.5 }), 250);
    assert.equal(limitOf(ceiling, { strict: true, slack: 2 }), 80);
    assert.equal(limitOf(size, { slack: 3 }), 1000);
    assert.equal(limitOf({ ...size, unit: 'count', max: 0 }, { slack: 3 }), 0);
    assert.equal(limitOf(floor, { slack: 3, strict: true }), 3);
  });
});

describe('checkBudgets', () => {
  const budgets = [ceiling, floor, size];

  it('passes when every measurement is within its limit — a value equal to the limit is within it', () => {
    const r = checkBudgets({ 'a.time': 100, 'a.pages': 3, 'a.size': 12.5 }, budgets);
    assert.equal(r.ok, true);
    assert.deepEqual(r.rows.map((row) => row.status), ['ok', 'ok', 'ok']);
    assert.deepEqual(r.failed, []);
  });

  it('fails over a ceiling and under a floor, naming which', () => {
    const r = checkBudgets({ 'a.time': 100.5, 'a.pages': 2, 'a.size': 1 }, budgets);
    assert.equal(r.ok, false);
    assert.deepEqual(r.rows.map((row) => row.status), ['over', 'under', 'ok']);
    assert.deepEqual(r.failed.map((row) => row.id), ['a.time', 'a.pages']);
  });

  it('reads a measurement as a number or as { value, detail }, and keeps the detail', () => {
    const r = checkBudgets({ 'a.time': { value: 50, detail: 'median of 7' }, 'a.pages': 3, 'a.size': { value: 2 } }, budgets);
    assert.equal(r.rows[0].value, 50);
    assert.equal(r.rows[0].detail, 'median of 7');
    assert.equal(r.rows[1].detail, null);
    assert.equal(r.ok, true);
  });

  it('strict mode fails what only the CI ceiling lets through', () => {
    assert.equal(checkBudgets({ 'a.time': 60, 'a.pages': 3, 'a.size': 1 }, budgets).ok, true);
    const strict = checkBudgets({ 'a.time': 60, 'a.pages': 3, 'a.size': 1 }, budgets, { strict: true });
    assert.equal(strict.ok, false);
    assert.equal(strict.rows[0].limit, 40);
    assert.equal(checkBudgets({ 'a.time': 60, 'a.pages': 3, 'a.size': 1 }, budgets, { strict: true, slack: 2 }).ok, true);
  });

  it('a group that was not run is skipped; one that was run and gave no number for a budget fails', () => {
    const skipped = checkBudgets({ 'a.time': 10 }, budgets, { groups: ['render'] });
    assert.deepEqual(skipped.rows.map((row) => row.status), ['ok', 'skipped', 'skipped']);
    assert.equal(skipped.ok, true);
    const missing = checkBudgets({ 'a.time': 10 }, budgets, { groups: ['render', 'keystroke'] });
    assert.deepEqual(missing.rows.map((row) => row.status), ['ok', 'missing', 'skipped']);
    assert.equal(missing.ok, false);
    assert.equal(checkBudgets({ 'a.time': NaN, 'a.pages': 3, 'a.size': 1 }, budgets).rows[0].status, 'missing', 'NaN is no measurement');
  });

  it('a measurement nobody wrote a budget for fails the run', () => {
    const r = checkBudgets({ 'a.time': 10, 'a.pages': 3, 'a.size': 1, 'render.stray': 5 }, budgets);
    assert.equal(r.ok, false);
    assert.deepEqual(r.failed.map((row) => [row.id, row.status]), [['render.stray', 'unbudgeted']]);
  });
});

describe('the table', () => {
  it('formats numbers: whole above 100, one decimal below, thousands grouped, a count without a unit', () => {
    assert.equal(formatValue(1234.56, 'ms'), '1,235 ms');
    assert.equal(formatValue(61.24, 'ms'), '61.2 ms');
    assert.equal(formatValue(1048576, 'kB'), '1,048,576 kB');
    assert.equal(formatValue(3, 'count'), '3');
    assert.equal(formatValue(NaN, 'ms'), '-');
  });

  it('prints one line per budget with its measurement, limit and status, then whether the run passed', () => {
    const budgets = [ceiling, floor, size];
    const passing = formatTable(checkBudgets({ 'a.time': { value: 61.2, detail: 'median of 7 (min 50 ms, max 80 ms)' }, 'a.pages': 3, 'a.size': 900 }, budgets));
    assert.match(passing, /A time\s+61\.2 ms\s+<= 100 ms\s+ok/);
    assert.match(passing, /A page count\s+3\s+>= 3\s+ok/);
    assert.match(passing, /A size\s+900 kB\s+<= 1,000 kB\s+ok/);
    assert.match(passing, /A time: median of 7 \(min 50 ms, max 80 ms\)/, 'the note is printed under the table');
    assert.match(passing, /^PASS: 3 of 3 budgets met/m);

    const failing = formatTable(checkBudgets({ 'a.time': 250, 'a.pages': 3, 'a.size': 900 }, budgets));
    assert.match(failing, /A time\s+250 ms\s+<= 100 ms\s+OVER/);
    assert.match(failing, /^FAIL: 1 of 3 budgets not met .*: a\.time\./m);
  });

  it('shows a skipped budget without a measurement, and says which mode held the run', () => {
    const text = formatTable(checkBudgets({ 'a.time': 10 }, [ceiling, size], { groups: ['render'], strict: true, slack: 2 }), { strict: true, slack: 2 });
    assert.match(text, /A size\s+<= 1,000 kB\s+skipped/);
    assert.match(text, /^PASS: 1 of 1 budgets met \(strict \(the plan's targets\), timings x2\)\./m);
  });
});

describe('options', () => {
  it('defaults to the render, keystroke and startup groups, CI ceilings, 7 runs after 2 warm-ups', () => {
    const o = parseArgs([], {});
    assert.deepEqual(o.groups, DEFAULT_GROUPS);
    assert.equal(o.groups.includes('browser'), false, 'the browser group needs a build and Chromium: it is asked for');
    assert.deepEqual([o.strict, o.slack, o.runs, o.warmups, o.dist, o.json], [false, 1, 7, 2, 'dist', false]);
  });

  it('--only names the groups (in the order a run prints them), or all', () => {
    assert.deepEqual(parseArgs(['--only=browser,render']).groups, ['render', 'browser']);
    assert.deepEqual(parseArgs(['--only=all']).groups, GROUPS);
    assert.throws(() => parseArgs(['--only=render,paint']), /--only needs some of/);
    assert.throws(() => parseArgs(['--only=']), /--only needs some of/);
  });

  it('reads --strict, --slack, --runs, --warmups, --dist and --json, and PERF_STRICT and PERF_SLACK from the environment', () => {
    const o = parseArgs(['--strict', '--slack=2.5', '--runs=3', '--warmups=0', '--dist=out/dist', '--json']);
    assert.deepEqual([o.strict, o.slack, o.runs, o.warmups, o.dist, o.json], [true, 2.5, 3, 0, 'out/dist', true]);
    const env = parseArgs([], { PERF_STRICT: '1', PERF_SLACK: '3' });
    assert.deepEqual([env.strict, env.slack], [true, 3]);
    assert.equal(parseArgs(['--slack=2'], { PERF_SLACK: '3' }).slack, 2, 'the flag beats the environment');
    assert.equal(parseArgs([], { PERF_STRICT: '0', PERF_SLACK: '' }).strict, false);
  });

  it('refuses what it does not understand, so a typo never runs the wrong budgets', () => {
    assert.throws(() => parseArgs(['--strcit']), /Unknown option "--strcit"/);
    assert.throws(() => parseArgs(['--runs=0']), /--runs needs a whole number from 1 to 99/);
    assert.throws(() => parseArgs(['--runs=2.5']), /--runs needs a whole number/);
    assert.throws(() => parseArgs(['--slack=fast']), /--slack needs a number/);
    assert.throws(() => parseArgs(['--slack=']), /--slack needs a number/);
    assert.throws(() => parseArgs([], { PERF_SLACK: '0' }), /PERF_SLACK needs a number/);
    assert.throws(() => parseArgs(['--dist=']), /--dist needs a folder/);
    assert.equal(parseArgs(['--help']).help, true);
  });
});

describe('the start-up path of a build', () => {
  // entry → shell → firebase; index.html also preloads react. `editor` is a lazy chunk (a dynamic import: not in `imports`).
  const chunk = (fileName, imports = [], extra = {}) => ({ fileName, isEntry: false, imports, moduleIds: [], ...extra });
  const chunks = [
    chunk('index.js', ['shell.js'], { isEntry: true, moduleIds: ['/src/main.jsx'] }),
    chunk('shell.js', ['firebase.js']),
    chunk('firebase.js'),
    chunk('react.js'),
    chunk('editor.js', ['react-pdf.js'], { moduleIds: ['/src/pages/Editor.jsx'] }),
    chunk('react-pdf.js', [], { moduleIds: ['/x/node_modules/@react-pdf/layout/index.js', '/x/node_modules/fontkit/index.js'] }),
  ];
  const bytes = { 'index.js': 100 * 1024, 'shell.js': 200 * 1024, 'firebase.js': 300 * 1024, 'react.js': 400 * 1024, 'editor.js': 1, 'react-pdf.js': 5000 * 1024 };
  const sizes = { size: (c) => bytes[c.fileName], gzipSize: (c) => bytes[c.fileName] / 4 };

  it('walks the entry\'s static imports and index.html\'s preloads, never a lazy chunk', () => {
    const html = '<script type="module" crossorigin src="/assets/index.js"></script><link rel="modulepreload" crossorigin href="/react.js">';
    const p = startupPath(chunks, { html, ...sizes });
    assert.deepEqual(p.names, ['firebase.js', 'index.js', 'react.js', 'shell.js']);
    assert.equal(p.rawKb, 1000);
    assert.equal(p.gzipKb, 250);
    assert.equal(p.largestKb, 400);
    assert.equal(p.lazyModules, 0);
  });

  it('with no html only the entry\'s closure counts', () => {
    assert.deepEqual(startupPath(chunks, sizes).names, ['firebase.js', 'index.js', 'shell.js']);
  });

  it('counts the PDF and Word library modules a start-up chunk holds — the number 71-startup-chunks holds at zero', () => {
    const leaky = chunks.map((c) => (c.fileName === 'shell.js'
      ? { ...c, moduleIds: ['/x/node_modules/docx/build/index.js', '/x/node_modules/pdfjs-dist/build/pdf.mjs', '/x/node_modules/react/index.js'] }
      : c));
    assert.equal(startupPath(leaky, sizes).lazyModules, 2);
  });

  it('survives an import cycle and a chunk name the build does not list', () => {
    const looped = [chunk('a.js', ['b.js', 'gone.js'], { isEntry: true }), chunk('b.js', ['a.js'])];
    assert.deepEqual(startupPath(looped, { size: () => 1024, gzipSize: () => 512 }).names, ['a.js', 'b.js']);
  });

  it('reads the .js files index.html loads, with or without the leading slash', () => {
    assert.deepEqual(loadedByHtml('<script type="module" src="/assets/a.js"></script><link rel="modulepreload" href="assets/b.js"><link rel="stylesheet" href="/assets/c.css">'), ['assets/a.js', 'assets/b.js']);
  });
});

describe('the budgets', () => {
  it('are well formed: unique ids, known groups and units, one limit each, a target no higher than its ceiling', () => {
    assert.deepEqual(validateBudgets(BUDGETS), []);
    for (const group of GROUPS) assert.ok(BUDGETS.some((b) => b.group === group), `${group} has budgets`);
  });

  it('what validateBudgets refuses', () => {
    const problems = validateBudgets([
      ceiling, { ...ceiling },
      { id: 'b.group', group: 'paint', label: 'x', unit: 'ms', max: 1 },
      { id: 'b.unit', group: 'render', label: 'x', unit: 'seconds', max: 1 },
      { id: 'b.both', group: 'render', label: 'x', unit: 'ms', max: 1, min: 1 },
      { id: 'b.none', group: 'render', label: 'x', unit: 'ms' },
      { id: 'b.target', group: 'render', label: 'x', unit: 'ms', max: 10, target: 20 },
      { id: 'b.floor-target', group: 'render', label: 'x', unit: 'count', min: 1, target: 1 },
      { id: 'b.negative', group: 'render', label: 'x', unit: 'ms', max: -1 },
      { id: 'b.label', group: 'render', label: '', unit: 'ms', max: 1 },
      {},
    ]);
    const about = (id, pattern) => assert.ok(problems.some((p) => p.includes(`"${id}"`) && pattern.test(p)), `${id}: ${pattern}\n${problems.join('\n')}`);
    about('a.time', /used twice/);
    about('b.group', /group "paint"/);
    about('b.unit', /unit "seconds"/);
    about('b.both', /exactly one of max or min/);
    about('b.none', /exactly one of max or min/);
    about('b.target', /target needs a max, and is not above it/);
    about('b.floor-target', /target needs a max/);
    about('b.negative', /max must be a number/);
    about('b.label', /needs a label/);
    assert.ok(problems.some((p) => /needs an id/.test(p)));
  });

  it('every budget is measured by tests/perf/measure.mjs, and every number it measures has a budget', () => {
    const measured = new Set([...read('tests/perf/measure.mjs').matchAll(/'((?:render|keystroke|startup|browser)\.[A-Za-z0-9]+)'/g)].map((m) => m[1]));
    assert.deepEqual([...measured].sort(), BUDGETS.map((b) => b.id).sort());
  });

  it('the start-up ceilings are the caps 71-startup-chunks holds (1.1 MB in all, 500 kB a chunk, no PDF or Word library)', () => {
    const budget = (id) => BUDGETS.find((b) => b.id === id);
    assert.equal(budget('startup.raw').max, 1100);
    assert.equal(budget('startup.largest').max, 500);
    assert.equal(budget('startup.lazy').max, 0);
  });
});

describe('the workflow keeps the perf job out of the gate', () => {
  const ci = read('.github/workflows/ci.yml');
  /** The `if:` line of job `name` (two-space indented under jobs:). */
  const jobIf = (name) => {
    const start = ci.search(new RegExp(`^  ${name}:$`, 'm'));
    assert.ok(start >= 0, `ci.yml has a ${name} job`);
    const rest = ci.slice(start + 1);
    const next = rest.search(/^ {2}[a-z-]+:$/m);
    return (next < 0 ? rest : rest.slice(0, next)).match(/^ {4}if: (.*)$/m)?.[1];
  };

  it('perf is a dispatch input, and its job runs only on a dispatch that sets it, never on a push', () => {
    assert.match(ci, /^ {6}perf:$/m, 'workflow_dispatch takes a perf input');
    const condition = jobIf('perf');
    assert.ok(condition, 'the perf job has a condition');
    assert.match(condition, /github\.event_name == 'workflow_dispatch'/);
    assert.match(condition, /inputs\.perf != ''/);
    assert.doesNotMatch(condition, /push/);
  });

  it('a dispatch that sets perf runs only the perf job: the suite, build, Playwright and Cypress jobs step aside', () => {
    for (const job of ['suite', 'build', 'playwright', 'cypress']) {
      assert.match(jobIf(job) ?? '', /inputs\.perf == ''/, `${job} does not run for a perf dispatch`);
      assert.match(jobIf(job), /github\.event_name == 'push'/, `${job} still runs on every push`);
    }
  });

  it('the job runs the harness with the groups the input names', () => {
    assert.match(ci, /node tests\/perf\/run\.mjs --only="\$ONLY"/);
    assert.match(ci, /browser\) echo "only=browser"/);
    assert.match(ci, /all\) echo "only=render,keystroke,startup,browser"/);
    assert.match(ci, /\*\) echo "only=render,keystroke,startup"/);
  });

  it('package.json has the yarn test:perf script, and yarn test does not run the harness', () => {
    const { scripts } = JSON.parse(read('package.json'));
    assert.equal(scripts['test:perf'], 'node tests/perf/run.mjs');
    assert.doesNotMatch(scripts.test, /perf/);
  });
});
