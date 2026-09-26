// R4-IMP-13: a PDF that needs a password to open failed with pdf.js's own words, "Could not import
// cv.pdf: No password given". It now says what is wrong and what to do. pdf.js is stood in for by a
// loader whose document is locked, as pdf.js rejects one (a PasswordException).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfLines } from '../../src/utils/importFile.js';

/** pdf.js, as far as pdfLines uses it, for a document that needs a password. */
const lockedPdfjs = () => {
  const lib = { destroyed: false };
  lib.getDocument = () => {
    const err = new Error('No password given');
    err.name = 'PasswordException';
    err.code = 1;
    const promise = Promise.reject(err);
    promise.catch(() => {});
    return { promise, destroy: async () => { lib.destroyed = true; } };
  };
  return lib;
};

test('a password-protected PDF says so, in words, and the loading task is still cleaned up', async () => {
  const lib = lockedPdfjs();
  await assert.rejects(pdfLines(new Uint8Array([37, 80, 68, 70]), lib), (e) => {
    assert.match(e.message, /password-protected/);
    assert.match(e.message, /without a password/);
    assert.doesNotMatch(e.message, /No password given/);
    return true;
  });
  assert.equal(lib.destroyed, true);
});

test('any other pdf.js failure keeps its own message', async () => {
  const lib = { getDocument: () => { const promise = Promise.reject(new Error('Invalid PDF structure.')); promise.catch(() => {}); return { promise, destroy: async () => {} }; } };
  await assert.rejects(pdfLines(new Uint8Array([1]), lib), /Invalid PDF structure/);
});

