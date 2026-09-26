// R4-LO-15: hasMetric (the optimizer's and the ATS score's one metric rule) skipped a digit right after
// a letter but not the digits after it, so "FY2021" and "v2.0" counted as quantified results. A number
// now starts only where no letter or digit comes before it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasMetric } from '../../src/utils/bulletOptimizer.js';

test('a year or version written into a name is no metric', () => {
  assert.equal(hasMetric('Owned the FY2021 budget plan'), false);
  assert.equal(hasMetric('Led the v2.0 launch of the mobile app'), false);
  assert.equal(hasMetric('Moved storage to S3 and compute to EC2'), false);
  for (const t of ['Owned the FY2021-22 plan', 'Owned the FY21-22 plan', 'Owned the FY 21 budget', 'Owned the FY-21 budget', "Owned the FY'21 budget"]) {
    assert.equal(hasMetric(t), false, t);
  }
});

test('numbers that stand as one still count', () => {
  for (const t of ['Cut FY2021 costs by 20%', 'Grew revenue 3.5x', 'Served 1,000 users', 'Saved $1.2M', 'Cut p95 to 200ms', 'Reached #1 in the store', 'Improved throughput x10', 'Raised Rs.500 crore', 'Saved EUR500k', 'Saved INR5,00,000']) {
    assert.equal(hasMetric(t), true, t);
  }
});
