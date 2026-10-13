// Defect: the monthly run of .github/workflows/job-map-refresh.yml (the 1st: about an hour of discovery, then a commit of
// discovered.json, unresolved.json and jobs-agg.json) ended in a bare `git push origin HEAD:<branch>` from a checkout taken an
// hour earlier. master is pushed to several times a day, so the push would be rejected as non-fast-forward: the run went red
// after the data was uploaded and what discovery found never reached git (the next weekly run then builds from the old files).
// The step now fetches the branch tip, puts the three files on it and tries again if the push or the fetch failed; a copy of
// the files is kept as an artifact first, which can never stop the commit (continue-on-error). The schedule itself is also
// pinned here (the owner's order: it stays on), and the monthly cron string that places compare against must stay the one
// declared. The workflow is read as text (no YAML parser is installed); the checks look at order and containment, not at
// spelling, so a harmless edit (other quotes, the operands of the if in another order) does not fail them. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const yml = fs.readFileSync(new URL('../../.github/workflows/job-map-refresh.yml', import.meta.url), 'utf8');
const steps = yml.slice(yml.indexOf('\n    steps:')).split(/\n      - (?=\S)/).slice(1);
const step = (name) => {
  const found = steps.find((s) => s.startsWith(`name: ${name}`));
  assert.ok(found, `a step named "${name}"`);
  return found;
};
const QUOTE = '[\'"]';
const crons = [...yml.matchAll(new RegExp(`^\\s*-\\s*cron:\\s*${QUOTE}([^'"]+)${QUOTE}`, 'gm'))].map((m) => m[1]);
const FILES = ['tools/job-map/discovered.json', 'tools/job-map/unresolved.json', 'tools/job-map/jobs-agg.json'];
const condOf = (s) => s.match(/^\s*if:\s*(.*)$/m)?.[1];

test('the workflow keeps its weekly and its monthly schedule, can push, and can be run by hand', () => {
  assert.ok(crons.includes('17 3 * * 1'), `Mondays are scheduled: ${crons.join(' | ')}`);
  assert.equal(crons.filter((c) => c.split(' ')[2] === '1').length, 1, 'one monthly cron (day of the month 1)');
  assert.match(yml, /^on:\s*\n\s+schedule:\s*\n/m, 'the cron lines sit under on: schedule:');
  assert.match(yml, /^\s+workflow_dispatch:/m, 'Run workflow stays the catch-up for a missed run');
  assert.match(yml, /^permissions:\s*\n\s+contents:\s*write\s*$/m, 'the token may push');
});

test('every place that asks "is this the monthly run?" compares against the declared monthly cron', () => {
  const monthly = crons.find((c) => c.split(' ')[2] === '1');
  const compared = [...yml.matchAll(new RegExp(`github\\.event\\.schedule\\s*==\\s*${QUOTE}([^'"]+)${QUOTE}`, 'g'))].map((m) => m[1]);
  assert.ok(compared.length >= 2, `the discover flag and the commit step both ask: ${compared.length}`);
  assert.deepEqual([...new Set(compared)], [monthly]);
});

test('the commit step runs only after a real discovery run, as the owner and with a message that skips CI', () => {
  const s = step('Keep what discovery found');
  const cond = condOf(s);
  for (const part of ['success()', 'inputs.discover', 'github.event.schedule', '!inputs.dry']) assert.ok(cond?.includes(part), `its if has ${part}: ${cond}`);
  assert.match(s, /git config user\.name sairamgudiputi\b/);
  assert.match(s, /git config user\.email sairamgudiputi8@gmail\.com/);
  assert.match(s, /\[skip ci\]/);
  assert.doesNotMatch(s, /Co-Authored-By|Claude|Generated with/i);
  for (const f of FILES) assert.ok(s.includes(f), `${f} is committed`);
  assert.match(s, /BRANCH:\s*\$\{\{\s*github\.ref_name\s*\}\}/, 'the branch comes in through env, never spliced into the script');
  assert.match(s, /GITHUB_REF_TYPE[^\n]*branch/, 'a run started on a tag does not push a branch named like it');
});

test('the commit step puts the files on the current tip of the branch, inside a loop that pushes again', () => {
  const s = step('Keep what discovery found');
  const loop = s.search(/for attempt in /);
  const fetch = s.search(/git fetch[^\n]*origin/);
  const reset = s.search(/git reset[^\n]*--hard FETCH_HEAD/);
  const push = s.search(/git push origin "HEAD:refs\/heads\/\$BRANCH"/);
  const done = [...s.matchAll(/^\s*done\s*$/gm)].at(-1)?.index ?? -1;
  assert.ok(loop >= 0 && fetch >= 0 && reset >= 0 && push >= 0 && done >= 0, `all five parts exist: ${[loop, fetch, reset, push, done]}`);
  assert.ok(loop < fetch && fetch < reset && reset < push && push < done, `in the loop, in this order: ${[loop, fetch, reset, push, done]}`);
  assert.match(s, /if git fetch[^\n]*&&\s*git reset[^\n]*FETCH_HEAD/, 'a failed fetch is tried again, not fatal');
  assert.match(s, /exit 1\s*$/, 'and the run goes red when it still cannot push');
  assert.doesNotMatch(s, /^\s*git push origin HEAD:\$\{\{ github\.ref_name \}\}\s*$/m, 'no bare one-shot push of a stale checkout');
});

test('a copy of the found files is kept as an artifact before the commit step and can never stop it', () => {
  const keep = step('Keep a copy of what discovery found');
  const commit = step('Keep what discovery found');
  assert.ok(steps.indexOf(keep) < steps.indexOf(commit), 'the copy comes first');
  assert.match(keep, /uses:\s*actions\/upload-artifact@v4/);
  assert.match(keep, /name:\s*job-map-found/);
  for (const f of FILES) assert.ok(keep.includes(f), `${f} is in the artifact`);
  assert.equal(condOf(keep), condOf(commit), 'the same condition');
  assert.match(keep, /^\s*continue-on-error:\s*true\s*$/m, 'a failed upload leaves success() true for the commit step');
  assert.match(keep, /^\s*timeout-minutes:\s*\d+\s*$/m, 'and a stalled one cannot hold the run');
});
