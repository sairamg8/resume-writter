// Export file names hold no character a file system reserves (R4-EXP-07). A title "UI/UX Designer"
// gave the download link "Jane_Doe_UI/UX_Designer.pdf", and each browser then swapped or dropped the
// "/" (or ":", "?", "|") its own way, so one résumé saved under different names on different browsers.
// The name is now one predictable, valid name everywhere: "Jane_Doe_UI-UX_Designer".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExportFilename } from '../../src/utils/exportFilename.js';

const name = (personal) => buildExportFilename({ personal });

test('reserved characters become a dash', () => {
  assert.equal(name({ name: 'Jane Doe', title: 'UI/UX Designer' }), 'Jane_Doe_UI-UX_Designer');
  assert.equal(name({ name: 'Jane Doe', title: 'Engineer: Payments' }), 'Jane_Doe_Engineer-Payments');
  assert.equal(name({ name: 'Jane Doe', title: 'C#/.NET Dev?' }), 'Jane_Doe_C#-.NET_Dev');
  assert.equal(name({ name: 'A\\B|C "D" <E>*', title: '' }), 'A-B-C-D-E');
  assert.equal(name({ name: 'x\u0000y', title: 'a\u001fb\u007f' }), 'x-y_a-b');
});

test('no leading dot, no trailing separator, and a bounded length', () => {
  assert.equal(name({ name: '..Jane', title: 'Dev.' }), 'Jane_Dev');
  assert.equal(name({ name: '???', title: '' }), 'resume');
  const long = name({ name: 'N'.repeat(300), title: 'T'.repeat(300) });
  assert.ok(long.length <= 121, String(long.length));
});

test('ordinary names are unchanged', () => {
  assert.equal(name({ name: '  Jane   Doe ', title: 'Data Engineer' }), 'Jane_Doe_Data_Engineer');
  assert.equal(name({ name: 'José Núñez' }), 'José_Núñez');
  assert.equal(name({}), 'resume');
});
