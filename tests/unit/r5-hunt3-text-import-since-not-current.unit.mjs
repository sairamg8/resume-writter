// R5-HUNT3-TEXT-IMPORT-SINCE-NOT-CURRENT: "Since 2019" beside a job read as a start date alone, not
// as the range still running it means, so the imported job printed a bare "2019". It is current now,
// as "2019 – Present" in the file would be. "Since 2019 - 2021" keeps its end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDateRange, resumeFromText } from '../../src/utils/importText.js';

test('"Since 2019" is a current range', () => {
  assert.deepEqual(readDateRange('Since 2019'), { start: '2019', end: '', current: true, text: 'Since 2019' });
  assert.deepEqual(readDateRange('since Mar 2021'), { start: 'Mar 2021', end: '', current: true, text: 'since Mar 2021' });
});

test('an imported job dated "Since 2019" is current', () => {
  const r = resumeFromText('Pat Lee\npat@x.com\n\nEXPERIENCE\nSenior Engineer, Acme Corp\tSince 2019\n- Built things\n');
  const [job] = r.sections.find((s) => s.type === 'experience').items;
  assert.deepEqual([job.startDate, job.endDate, job.current], ['2019', '', true]);
});

test('ranges and lone dates read as before', () => {
  assert.deepEqual(readDateRange('Since 2019 - 2021'), { start: '2019', end: '2021', current: false, text: 'Since 2019 - 2021' });
  assert.deepEqual(readDateRange('2019'), { start: '2019', end: '', current: false, text: '2019' });
  assert.deepEqual(readDateRange('2019 - Present'), { start: '2019', end: '', current: true, text: '2019 - Present' });
});
