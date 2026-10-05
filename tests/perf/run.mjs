// The performance harness (R2-142, PERF-1): measures what an edit costs — the PDF build (N1), one keystroke's
// build-open-paint pass, the start-up path of a production build, and in Chromium the last key to the pages
// that show it (Gate A) — against the budgets written in budgets.mjs, prints a table and exits non-zero when
// one is missed. It is not part of `yarn test` and not of the CI gate: run it with `yarn test:perf`, or
// dispatch .github/workflows/ci.yml with `perf` set. docs/knowledge/08-testing.md says how to read it.
//
// Exit code: 0 every budget met, 1 a budget missed, 2 the harness itself failed (bad option, no build, no browser).
import { setup, teardown } from '../pdf/harness.mjs';
import { BUDGETS } from './budgets.mjs';
import { HELP, checkBudgets, formatTable, parseArgs, validateBudgets } from './budget-check.mjs';
import { measureBrowser, measureKeystroke, measureRender, measureStartup } from './measure.mjs';

async function main(argv, env) {
  const opts = parseArgs(argv, env);
  if (opts.help) {
    console.log(HELP);
    return 0;
  }
  const problems = validateBudgets(BUDGETS);
  if (problems.length) throw new Error(`tests/perf/budgets.mjs is malformed:\n  ${problems.join('\n  ')}`);

  const has = (group) => opts.groups.includes(group);
  const measured = {};
  // The start-up path is a build and needs none of the PDF harness; every other group builds résumés with it.
  const harness = opts.groups.some((group) => group !== 'startup');
  if (harness) await setup();
  try {
    if (has('render')) Object.assign(measured, await measureRender(opts));
    if (has('keystroke')) Object.assign(measured, await measureKeystroke(opts));
    if (has('startup')) Object.assign(measured, await measureStartup());
    if (has('browser')) Object.assign(measured, await measureBrowser(opts));
  } finally {
    if (harness) await teardown();
  }

  const result = checkBudgets(measured, BUDGETS, { strict: opts.strict, slack: opts.slack, groups: opts.groups });
  console.log(opts.json ? JSON.stringify(result, null, 2) : formatTable(result, opts));
  return result.ok ? 0 : 1;
}

main(process.argv.slice(2), process.env).then((code) => { process.exitCode = code; }, (error) => {
  console.error(`perf harness failed: ${error?.stack || error}`);
  process.exitCode = 2;
}).finally(() => {
  // A server or a browser left open by a failure must not hold the process (and the CI job) up.
  setTimeout(() => process.exit(process.exitCode ?? 0), 2000).unref();
});
