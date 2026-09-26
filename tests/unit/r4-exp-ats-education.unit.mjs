// ATS text: an education entry's degree and field of study read as one phrase (R4-EXP-03).
// It printed "BSc - in Computer Science - MIT", and "in Computer Science - MIT" with no degree. It now
// prints the PDF's form, "BSc, Computer Science - MIT" (the form the text import reads back), and
// "Computer Science - MIT" with no degree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAtsPlainText } from '../../src/utils/atsChecker.js';

const text = (item) => generateAtsPlainText({ personal: { name: 'Ada Lovelace' },
  sections: [{ id: 's', type: 'education', title: 'Education', visible: true, items: [{ id: 'e', ...item }] }] });

test('degree, field of study and institution', () => {
  const out = text({ degree: 'BSc', fieldOfStudy: 'Computer Science', institution: 'MIT' });
  assert.ok(out.includes('BSc, Computer Science - MIT'), out);
  assert.ok(!/ - in |^in /m.test(out), out);
});

test('no degree: the field of study leads, with no "in"', () => {
  const out = text({ fieldOfStudy: 'Computer Science', institution: 'MIT' });
  assert.ok(/^Computer Science - MIT$/m.test(out), out);
});

test('a degree alone, and a degree with no field', () => {
  assert.ok(/^BSc - MIT$/m.test(text({ degree: 'BSc', institution: 'MIT' })));
  assert.ok(/^BSc, Physics$/m.test(text({ degree: 'BSc', fieldOfStudy: 'Physics' })));
});
