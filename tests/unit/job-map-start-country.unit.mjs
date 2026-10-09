// The Job Map kept its country at 'IN' even when the data had no India rows (meta.counts has no 'IN'):
// the Country select showed no matching option and the list was empty until a country was picked.
// It now starts on India when the data has roles there, else on the country with the most roles; the
// page derives the country from the data (a picked one only while the data still has it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startCountry } from '../../src/utils/jobMapData.js';

test('startCountry: India when it has roles, else the country with the most roles', () => {
  assert.equal(startCountry({ IN: 5, US: 900 }), 'IN', 'India stays the start where the data has it');
  assert.equal(startCountry({ US: 900, DE: 40 }), 'US', 'no India rows: the biggest country');
  assert.equal(startCountry({ DE: 40, FR: 60 }), 'FR');
  assert.equal(startCountry({ IN: 0, DE: 3 }), 'DE', 'a zero count is no rows');
});

test('startCountry: nothing loaded or no rows at all keeps the old default, an empty list', () => {
  assert.equal(startCountry(undefined), 'IN');
  assert.equal(startCountry({}), 'IN');
  assert.equal(startCountry({ DE: 0 }), 'IN');
});

test('the page derives its country from the data, not from a fixed IN in state', () => {
  const page = readFileSync(new URL('../../src/pages/JobMap.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /useState\('IN'\)/);
  assert.match(page, /const country = picked && meta\?\.counts\?\.\[picked\] \? picked : startCountry\(meta\?\.counts\)/);
  assert.match(page, /onChange=\{\(e\) => setPicked\(e\.target\.value\)\} aria-label="Country"/);
});
