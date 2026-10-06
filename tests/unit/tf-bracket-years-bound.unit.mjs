// A-5: bracketYears (importText.js) reads a line of 1000 characters or fewer and leaves a longer one as it is, because
// testing each separator of a paragraph against the rest of it took time squared (12 000 commas, half a second).
// The bound stays, on purpose: an award or a certificate's line is a title and its years, and a line past a thousand
// characters is a paragraph, whose commas and years are not an award's dates. This pins both sides of it, and that an
// ordinary line is read as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const awardsOf = (line) => JSON.stringify(resumeFromText(`Jane Doe\njane@x.com\n\nAWARDS\n${line}\nHackathon Winner\t2019`).sections.find((s) => s.type === 'awards')?.items || []);
const lineOf = (length) => {
  const years = '\t2014, 2015';
  return `Dean’s List ${'x'.repeat(length - 'Dean’s List '.length - years.length)}${years}`;
};

test('a line of 1000 characters has its years put in brackets, one of 1001 is left as typed', () => {
  assert.equal(lineOf(1000).length, 1000);
  assert.ok(awardsOf(lineOf(1000)).includes('(2014, 2015)'), 'at the bound');
  assert.ok(!awardsOf(lineOf(1001)).includes('(2014, 2015)'), 'one past the bound');
  assert.ok(awardsOf('Dean’s List\t2014, 2015').includes('(2014, 2015)'), 'an ordinary line');
});

test('a line of 12 000 commas comes back at once, as typed', () => {
  const start = performance.now();
  const out = awardsOf(`Dean’s List${', 2014'.repeat(2400)}`);
  const ms = performance.now() - start;
  assert.ok(!out.includes('(2014, 2014'), 'not bracketed');
  assert.ok(ms < 2000, `${ms.toFixed(0)} ms`);
});
