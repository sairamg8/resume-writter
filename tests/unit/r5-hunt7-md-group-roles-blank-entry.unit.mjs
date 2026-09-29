// R5-HUNT7-MD-GROUP-ROLES-SPLIT-BY-BLANK-ENTRY: with "Group roles by company" on, a blank entry (or one
// whose fields are all hidden with their eyes) between two roles at one company split them in two
// groups in the Markdown export — the company printed twice, an empty gap between — while the PDF
// (printedEntries) and Word (shown) leave such an entry out and group the roles under one company.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const ALL = ['company', 'role', 'location', 'startDate', 'endDate', 'description'];
const md = (middle) => generateMarkdownResume({
  template: 'classic',
  personal: { name: 'Pat Sample' },
  settings: {},
  sections: [{
    id: 's1', type: 'experience', title: 'Experience', visible: true, settings: { groupRoles: true },
    items: [
      { id: 'a', company: 'Acme', role: 'Senior', startDate: '2022-01', current: true, description: '' },
      middle,
      { id: 'c', company: 'Acme', role: 'Junior', startDate: '2020-01', endDate: '2021-12', description: '' },
    ],
  }],
});

const count = (text, needle) => text.split(needle).length - 1;

test('an entry with every field hidden does not split the company\'s roles', () => {
  const out = md({ id: 'b', company: 'Old Co', role: 'Intern', location: 'Leeds', startDate: '2018-01', endDate: '2019-01', description: '<p>Old</p>', hiddenFields: ALL });
  assert.equal(count(out, 'Acme'), 1, out);
  assert.ok(out.includes('Senior') && out.includes('Junior'), out);
  assert.ok(!out.includes('Old Co') && !out.includes('Intern'), out);
});

test('a blank entry does not split them', () => {
  const out = md({ id: 'b', company: '', role: '', location: '', startDate: '', endDate: '', description: '' });
  assert.equal(count(out, 'Acme'), 1, out);
  assert.ok(out.includes('Senior') && out.includes('Junior'), out);
});
