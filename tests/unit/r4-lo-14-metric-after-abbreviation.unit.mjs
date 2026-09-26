// R4-LO-14: a metric chip goes before the statement's closing full stop (R4-CL-08), but when that dot
// was an abbreviation's ("etc.", "U.S.") it was taken away from its word: "…SDKs, etc." read "…SDKs,
// etc by 35%.". The abbreviation keeps its dot; the sentence still ends with one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertMetric } from '../../src/utils/bulletOptimizer.js';

test('an abbreviation at the end keeps its dot', () => {
  assert.equal(insertMetric('Cut build times for APIs, SDKs, etc.', 'by 35%'), 'Cut build times for APIs, SDKs, etc. by 35%.');
  assert.equal(insertMetric('Grew sales in the U.S.', 'by 35%'), 'Grew sales in the U.S. by 35%.');
  assert.equal(insertMetric('Won a contract with Initech Inc.', 'worth $2M'), 'Won a contract with Initech Inc. worth $2M.');
});

test('an ordinary sentence end still moves after the metric', () => {
  assert.equal(insertMetric('Reduced API latency for the checkout service.', 'by 35%'), 'Reduced API latency for the checkout service by 35%.');
  assert.equal(insertMetric('Cut costs for the sales co-op.', 'by 35%'), 'Cut costs for the sales co-op by 35%.');
});
