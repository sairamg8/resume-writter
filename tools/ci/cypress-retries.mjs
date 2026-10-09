// Which Cypress specs only passed on a retry. cypress.config.js sets retries { runMode: 1 } so one flaky
// first attempt does not redden the gate, but that also hides a real race that fails once and passes
// again. The ci workflow keeps the run's log and hands it to this script after the Cypress step: each
// spec that needed a second attempt becomes a ::warning annotation and a line on the step summary. It
// only reads and reports: it exits 0 whatever it finds, so the job's pass or fail is Cypress's own.
//
// Two markers count, either is enough: the line cypress.config.js prints from its after:spec hook
// ("RETRIED-TEST <spec> :: <title>", the reliable one: it reads the result object) and the attempt
// counter Cypress prints itself ("(Attempt 2 of 2)", or "(attempt 2)" in a screenshot file name),
// attributed to the "Running:  <spec>" line above it.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;
const RUNNING = /^\s*Running:\s+(.+?)(?:\s+\(\d+ of \d+\))?\s*$/;
const OWN = /RETRIED-TEST (\S+) :: (.+?)\s*$/;
const BUILT_IN = /\(Attempt [2-9] of \d+\)|\(attempt [2-9]\)/;

/** [{ spec, notes }] in the order first seen: one entry per spec, `notes` the lines that showed it retried. */
export function retriedSpecs(log) {
  const found = new Map();
  let current = 'unknown spec';
  const note = (spec, text) => {
    if (!found.has(spec)) found.set(spec, []);
    const notes = found.get(spec);
    if (!notes.includes(text)) notes.push(text);
  };
  for (const raw of String(log).replace(ANSI, '').split(/\r?\n/)) {
    const running = RUNNING.exec(raw);
    if (running) { current = running[1]; continue; }
    const own = OWN.exec(raw);
    if (own) { note(own[1], own[2]); continue; }
    if (BUILT_IN.test(raw)) note(current, raw.trim());
  }
  return [...found].map(([spec, notes]) => ({ spec, notes }));
}

/** The annotation line GitHub turns into a warning on the run: %, CR and LF are escaped as the runner asks. */
export function annotation(specs, label) {
  const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  const body = specs.map((s) => `${s.spec}: ${s.notes.join('; ')}`).join('\n');
  return `::warning title=${esc(`Cypress passed only on a retry (${label})`)}::${esc(body)}`;
}

/** Markdown for the job's step summary. */
export function summary(specs, label) {
  const rows = specs.map((s) => `- \`${s.spec}\`: ${s.notes.join('; ')}`);
  return [`### Cypress retries (${label})`, '', 'Green, but each of these failed its first attempt: a race that fails once is a real finding.', '', ...rows, ''].join('\n');
}

function main(file, label) {
  let log = '';
  try { log = fs.readFileSync(file, 'utf8'); } catch { return; }
  const specs = retriedSpecs(log);
  if (!specs.length) { console.log('no Cypress spec needed a retry'); return; }
  console.log(annotation(specs, label));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary(specs, label)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv[2] || 'cypress-run.log', process.argv[3] || 'shard'); } catch (e) { console.log(`retry report skipped: ${e.message}`); }
}
