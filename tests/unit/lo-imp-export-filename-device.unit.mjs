// R4-LO-09: an export's file name that is a Windows device name — a résumé named "Con", "NUL" or
// "COM1" with no job title — gave "Con.pdf", which Windows cannot save at all (R4-EXP-07 left it out).
// Such a name now saves as "Con_resume"; any other name is as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExportFilename } from '../../src/utils/exportFilename.js';

const name = (personal) => buildExportFilename({ personal });

test('a device name alone gets "_resume" after it', () => {
  for (const device of ['CON', 'con', 'Prn', 'AUX', 'NUL', 'COM1', 'com9', 'LPT1', 'lpt3', 'COM¹']) {
    assert.equal(name({ name: device }), `${device}_resume`, device);
  }
});

test('a device name before a dot is one too: "Nul.x" → "Nul_resume.x"', () => {
  assert.equal(name({ name: 'Nul.x' }), 'Nul_resume.x');
  assert.equal(name({ name: 'aux.', title: '' }), 'aux_resume');
});

test('a name that only starts like one, or has a title, is unchanged', () => {
  assert.equal(name({ name: 'Con', title: 'Engineer' }), 'Con_Engineer');
  assert.equal(name({ name: 'Connor' }), 'Connor');
  assert.equal(name({ name: 'COM10' }), 'COM10');
  assert.equal(name({ name: 'Auxiliary Nurse' }), 'Auxiliary_Nurse');
  assert.equal(name({}), 'resume');
});
