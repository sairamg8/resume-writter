// Defect: the monthly run of .github/workflows/job-map-refresh.yml (the 1st: about an hour of discovery, then a commit of
// discovered.json, unresolved.json and jobs-agg.json) ended in a bare `git push origin HEAD:<branch>` from a checkout taken an
// hour earlier. master is pushed to several times a day, so the push would be rejected as non-fast-forward: the run went red
// after the data was uploaded and what discovery found never reached git (the next weekly run then builds from the old files).
// The step now fetches the branch tip, puts the three files on it and pushes again if the branch moved; a copy of the files is
// kept as an artifact first. The schedule itself is also pinned here (the owner's order: it stays on), and the monthly cron
// string that three places compare against must stay the one declared. The workflow is read as text (no YAML parser is
// installed). Run: yarn test:unit
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
const crons = [...yml.matchAll(/^\s*-\s*cron:\s*'([^']+)'/gm)].map((m) => m[1]);
const FILES = ['tools/job-map/discovered.json', 'tools/job-map/unresolved.json', 'tools/job-map/jobs-agg.json'];

test('the workflow keeps its weekly and its monthly schedule', () => {
  assert.ok(crons.includes('17 3 * * 1'), `Mondays are scheduled: ${crons.join(' | ')}`);
  assert.equal(crons.filter((c) => c.split(' ')[2] === '1').length, 1, 'one monthly cron (day of the month 1)');
});

test('every place that asks "is this the monthly run?" compares against the declared monthly cron', () => {
  const monthly = crons.find((c) => c.split(' ')[2] === '1');
  const compared = [...yml.matchAll(/github\.event\.schedule\s*==\s*'([^']+)'/g)].map((m) => m[1]);
  assert.ok(compared.length >= 2, `the discover flag and the commit step both ask: ${compared.length}`);
  assert.deepEqual([...new Set(compared)], [monthly]);
});

test('the commit step runs only after a real discovery run, as the owner and with a message that skips CI', () => {
  const s = step('Keep what discovery found');
  assert.match(s, /if:\s*\$\{\{[^\n]*success\(\)[^\n]*inputs\.discover[^\n]*github\.event\.schedule[^\n]*!inputs\.dry/);
  assert.match(s, /git config user\.name sairamgudiputi\b/);
  assert.match(s, /git config user\.email sairamgudiputi8@gmail\.com/);
  assert.match(s, /\[skip ci\]/);
  assert.doesNotMatch(s, /Co-Authored-By|Claude|Generated with/i);
  for (const f of FILES) assert.ok(s.includes(f), `${f} is committed`);
});

test('the commit step puts the files on the current tip of the branch and pushes again if the branch moved', () => {
  const s = step('Keep what discovery found');
  assert.match(s, /git fetch[^\n]*origin/, 'it fetches the branch tip');
  assert.match(s, /git reset[^\n]*--hard FETCH_HEAD/, 'it moves onto that tip');
  assert.match(s, /for attempt in /, 'it retries');
  assert.match(s, /exit 1/, 'and fails the run loudly when it still cannot push');
  assert.doesNotMatch(s, /^\s*git push origin HEAD:\$\{\{ github\.ref_name \}\}\s*$/m, 'no bare one-shot push of a stale checkout');
});

test('a copy of the found files is kept as an artifact before the commit step, under the same condition', () => {
  const keep = step('Keep a copy of what discovery found');
  const commit = step('Keep what discovery found');
  assert.ok(steps.indexOf(keep) < steps.indexOf(commit), 'the copy comes first');
  assert.match(keep, /uses:\s*actions\/upload-artifact@v4/);
  for (const f of FILES) assert.ok(keep.includes(f), `${f} is in the artifact`);
  const cond = (s) => s.match(/if:\s*(\$\{\{[^\n]*\}\})/)?.[1];
  assert.equal(cond(keep), cond(commit));
});
