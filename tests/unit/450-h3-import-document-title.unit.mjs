// H3-450: a CV that opens with its own title ("Curriculum Vitae", "Résumé", "CV"), as most UK and European
// ones do, took that title for the person's name and the real name for the job title. The title is the
// document's, not a field: the name is the line under it, and nothing of the title is kept.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const BODY = `Oliver J. Whitfield
Audit Manager
o.whitfield@example.co.uk | 0113 496 0123 | Leeds, UK

EXPERIENCE
Audit Manager\tHargreaves & Co\t2019 - Present
- Lead a team of 8
`;

for (const title of ['CURRICULUM VITAE', 'Curriculum Vitae', 'Résumé', 'RESUME', 'CV', 'Curriculum Vitae:']) {
  test(`"${title}" over the name is not the name`, () => {
    const r = resumeFromText(`${title}\n\n${BODY}`);
    assert.equal(r.personal.name, 'Oliver J. Whitfield');
    assert.equal(r.personal.title, 'Audit Manager');
    assert.equal(r.personal.email, 'o.whitfield@example.co.uk');
    assert.equal(r.name, 'Oliver J. Whitfield Resume');
    const everything = JSON.stringify(r.sections) + JSON.stringify(r.personal);
    assert.ok(!/curriculum vitae|r[eé]sum[eé]/i.test(everything), 'the title is kept nowhere');
  });
}

test('a name that merely starts like a title word is still the name', () => {
  const r = resumeFromText('Cv Resume Smith\nEngineer\nsmith@example.com\n\nSKILLS\nGo, Rust\n');
  assert.equal(r.personal.name, 'Cv Resume Smith');
});

test('a file that is only the title keeps it as the name rather than reading nothing', () => {
  const r = resumeFromText('Curriculum Vitae');
  assert.equal(r.personal.name, 'Curriculum Vitae');
});
