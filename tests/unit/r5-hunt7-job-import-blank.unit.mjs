// R5-HUNT7-IMPORT-BLANK-JOBS: importing a file whose entries name no company and no role (another
// tracker's export with 'companyName'/'jobTitle', a list of empty objects) added one blank
// 'Untitled Company' card per entry and said 'Imported N job applications'. A single such object
// was already refused. Those entries are now left out (mergeImport, src/utils/jobMerge.js): a file
// of only them says 'No job applications found', and a mixed one imports the named jobs with the
// partial-import warning. Fictional data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobsFromText, mergeImport, importMessage } from '../../src/utils/jobImport.js';

const importText = (current, text) => {
  const { list } = jobsFromText(text);
  return mergeImport(current, list, 1000);
};

test('R5-HUNT7: a list of entries with neither company nor role adds nothing and says so', () => {
  for (const text of [
    '[{"companyName":"Acme","jobTitle":"Engineer"},{"companyName":"Globex","jobTitle":"PM"}]',
    '[{},{}]',
    '{"jobs":[{"company":"  ","role":""}]}',
  ]) {
    const r = importText([], text);
    assert.equal(r.jobs.length, 0, text);
    assert.equal(r.added, 0, text);
    assert.equal(importMessage(r).text, 'No job applications found in that file.', text);
  }
});

test('R5-HUNT7: re-importing such a file never piles up blank cards', () => {
  const text = '[{"companyName":"Acme"},{"companyName":"Globex"}]';
  const once = importText([], text);
  const twice = importText(once.jobs, text);
  assert.equal(twice.jobs.length, 0);
});

test('R5-HUNT7: a named job in the same file is imported, with the partial-import warning', () => {
  const r = importText([], '[{"company":"Initech","status":"applied"},{"companyName":"Globex"},{"role":"Designer"}]');
  assert.deepEqual(r.jobs.map((j) => j.company || j.role), ['Initech', 'Designer']);
  assert.equal(r.added, 2);
  const msg = importMessage(r);
  assert.equal(msg.kind, 'warning');
  assert.match(msg.text, /^Imported 2 job applications; what could not be read/);
});
