// Defect: cypress.config.js retries a failed spec once (retries { runMode: 1 }), so a spec that failed its
// first attempt and passed the second was green in the gate and a real race passed CI unseen. Pins the
// report that makes it visible without changing the result: tools/ci/cypress-retries.mjs names each such
// spec from the run's log (the RETRIED-TEST line cypress.config.js prints from after:spec, or Cypress's own
// "(Attempt 2 of 2)"), the workflow keeps the log with the Cypress exit status intact and runs the report
// in a step that can never fail the job.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { annotation, retriedSpecs, summary } from '../../tools/ci/cypress-retries.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('retriedSpecs: reads the markers out of a Cypress log', () => {
  it('a clean run has no retried spec', () => {
    const log = '  Running:  cypress/e2e/a.cy.js                                   (1 of 2)\n    ✓ works (120ms)\n';
    assert.deepEqual(retriedSpecs(log), []);
    assert.deepEqual(retriedSpecs(''), []);
  });

  it('the line the config prints names the spec and the test', () => {
    const log = [
      '  Running:  cypress/e2e/a.cy.js                                   (1 of 2)',
      'RETRIED-TEST cypress/e2e/a.cy.js :: Tracker > moves a card (2 attempts, passed)',
      '  Running:  cypress/e2e/b.cy.js                                   (2 of 2)',
    ].join('\n');
    assert.deepEqual(retriedSpecs(log), [
      { spec: 'cypress/e2e/a.cy.js', notes: ['Tracker > moves a card (2 attempts, passed)'] },
    ]);
  });

  it('Cypress own attempt counter is attributed to the spec running above it, colours and all', () => {
    const log = [
      '  Running:  cypress/e2e/a.cy.js                                   (1 of 2)',
      '  Running:  \u001b[4mcypress/e2e/b.cy.js\u001b[0m                   (2 of 2)',
      '  \u001b[31m(Attempt 1 of 2)\u001b[0m is not a retry yet',
      '  (Attempt 2 of 2) moves a card',
      '  - /w/cypress/screenshots/b.cy.js/moves a card (failed) (attempt 2).png',
    ].join('\n');
    const found = retriedSpecs(log);
    assert.equal(found.length, 1, 'only the second attempt counts');
    assert.equal(found[0].spec, 'cypress/e2e/b.cy.js');
    assert.equal(found[0].notes.length, 2);
  });

  it('one spec seen by both markers is one entry', () => {
    const log = [
      '  Running:  cypress/e2e/a.cy.js                                   (1 of 1)',
      '  (Attempt 2 of 2) moves a card',
      'RETRIED-TEST cypress/e2e/a.cy.js :: moves a card (2 attempts, passed)',
    ].join('\n');
    assert.equal(retriedSpecs(log).length, 1);
    assert.equal(retriedSpecs(log)[0].notes.length, 2);
  });
});

describe('the warning and the summary', () => {
  const specs = [{ spec: 'cypress/e2e/a.cy.js', notes: ['moves 100% of cards'] }, { spec: 'cypress/e2e/b.cy.js', notes: ['x'] }];

  it('annotation is one ::warning line naming every spec, with the runner\'s escapes', () => {
    const line = annotation(specs, 'shard 2/4');
    assert.ok(line.startsWith('::warning title=Cypress passed only on a retry (shard 2/4)::'));
    assert.ok(!line.includes('\n'), 'one line');
    assert.ok(line.includes('cypress/e2e/a.cy.js: moves 100%25 of cards%0Acypress/e2e/b.cy.js: x'));
  });

  it('summary lists each spec under a heading naming the shard', () => {
    const md = summary(specs, 'shard 2/4');
    assert.ok(md.includes('### Cypress retries (shard 2/4)'));
    assert.ok(md.includes('- `cypress/e2e/a.cy.js`: moves 100% of cards'));
    assert.ok(md.includes('- `cypress/e2e/b.cy.js`: x'));
  });
});

describe('the wiring', () => {
  const ci = read('.github/workflows/ci.yml');
  const config = read('cypress.config.js');

  it('the retry stays, and the config prints a line for every test that needed a second attempt', () => {
    assert.match(config, /retries: \{ runMode: 1, openMode: 0 \}/);
    assert.match(config, /on\('after:spec'/);
    assert.match(config, /RETRIED-TEST \$\{spec\.relative\} :: /);
  });

  it('the Cypress step keeps its log without hiding its exit status', () => {
    const step = ci.slice(ci.indexOf('- name: Cypress (shard'), ci.indexOf('- name: Cypress retries'));
    assert.match(step, /set -o pipefail/);
    assert.match(step, /cypress run --e2e --spec \$SPECS" 2>&1 \| tee cypress-run\.log/);
  });

  it('the report step runs after a failure too and can never fail the job', () => {
    const at = ci.indexOf('- name: Cypress retries (warning only)');
    assert.ok(at > 0);
    const step = ci.slice(at, ci.indexOf('- uses: actions/upload-artifact@v4', at));
    assert.match(step, /if: always\(\)/);
    assert.match(step, /continue-on-error: true/);
    assert.match(step, /node tools\/ci\/cypress-retries\.mjs cypress-run\.log .*\|\| true/);
  });
});
