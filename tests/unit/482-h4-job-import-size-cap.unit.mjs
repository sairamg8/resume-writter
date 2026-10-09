// Defect: the Job Tracker's Import read whatever .json it was given whole (FileReader.readAsText), so a
// huge file picked by mistake stalled the tab; the résumé imports already refuse a file over 20 MB
// (MAX_IMPORT_BYTES). readImportFile now refuses one over the same size before reading it, with a message.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readImportFile, JOB_FILE_TOO_BIG, MAX_JOB_FILE_BYTES } from '../../src/utils/jobImport.js';

/** A FileReader stand-in that counts the files it is asked to read. */
function counting() {
  const box = { reads: 0 };
  box.Reader = class {
    readAsText() {
      box.reads += 1;
      queueMicrotask(() => { this.result = '[]'; this.onload?.({ target: this }); });
    }
  };
  return box;
}
const run = (file, Reader) => new Promise((resolve) => {
  readImportFile(file, { onText: (t) => resolve(['text', t]), onError: (e) => resolve(['error', e]) }, Reader);
});

test('a job file over 20 MB is refused with a message, and never read', async () => {
  const box = counting();
  assert.deepEqual(await run({ size: MAX_JOB_FILE_BYTES + 1 }, box.Reader), ['error', JOB_FILE_TOO_BIG]);
  assert.equal(box.reads, 0, 'before: the whole file was read');
  assert.match(JOB_FILE_TOO_BIG, /too large/);
});

test('a file at the limit, or one that reports no size, is read as before', async () => {
  const box = counting();
  assert.deepEqual(await run({ size: MAX_JOB_FILE_BYTES }, box.Reader), ['text', '[]']);
  assert.deepEqual(await run({}, box.Reader), ['text', '[]']);
  assert.equal(box.reads, 2);
});
