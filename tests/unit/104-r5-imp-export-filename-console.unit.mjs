// R4-SW-I-06: CONIN$ and CONOUT$ are Windows device names (the console's), as CON and NUL are, and
// CLOCK$ is one on Chrome's download list: a résumé named one exported as "CONIN$.pdf", which Windows
// cannot save. It now saves as "CONIN$_resume", as "Con" saves as "Con_resume"; '$' stays a file-name
// character everywhere else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExportFilename } from '../../src/utils/exportFilename.js';

const name = (personal) => buildExportFilename({ personal });

test('CONIN$, CONOUT$ and CLOCK$ alone get "_resume" after them', () => {
  for (const device of ['CONIN$', 'conin$', 'CONOUT$', 'conout$', 'Clock$']) {
    assert.equal(name({ name: device }), `${device}_resume`, device);
  }
});

test('before a dot they are device names too: "CONIN$.x" → "CONIN$_resume.x"', () => {
  assert.equal(name({ name: 'CONIN$.x' }), 'CONIN$_resume.x');
  assert.equal(name({ name: 'conout$.' }), 'conout$_resume');
});

test('a name that only starts like one, or has a title, keeps its "$" and is unchanged', () => {
  assert.equal(name({ name: 'Conin' }), 'Conin');
  assert.equal(name({ name: 'CONIN$X' }), 'CONIN$X');
  assert.equal(name({ name: 'Coninx$' }), 'Coninx$');
  assert.equal(name({ name: 'CONOUT$', title: 'Engineer' }), 'CONOUT$_Engineer');
  assert.equal(name({ name: 'Con' }), 'Con_resume');
});
