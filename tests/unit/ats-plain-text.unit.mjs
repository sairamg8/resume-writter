// The ATS plain-text export (Export → ATS Text, and the ATS tab's Copy / Download) prints what the
// PDF and Word print, section by section (R2-001). It used to print a section's heading over
// nothing, or over half its entry: Interests printed an empty rule (item.interests was never read);
// Awards, References and Custom went through a generic branch that read only the title; a
// certificate lost its expiry, ID and link and a project its dates; and a description holding a
// bullet list lost every paragraph around the list, as a one-line description lost itself to an
// entry's legacy bullets. Each test names the fields its section's PDF renderer prints.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAtsPlainText } from '../../src/utils/atsChecker.js';

const text = (...sections) => generateAtsPlainText({ personal: { name: 'Ada Lovelace' }, sections });
/** The lines under a section's heading (after its rule), up to the next blank-blank break. */
const under = (out, heading) => {
  const lines = out.split('\n');
  const at = lines.indexOf(heading);
  assert.ok(at >= 0, `no ${heading} heading in:\n${out}`);
  const rest = lines.slice(at + 2);
  const end = rest.findIndex((l, i) => /^[A-Z][A-Z &]+$/.test(l) && /^-+$/.test(rest[i + 1] || ''));
  return (end < 0 ? rest : rest.slice(0, end)).filter(Boolean);
};

test('Interests print every interest, as the PDF prints each chip', () => {
  const out = text({ type: 'interests', title: 'Interests', items: [{ interests: 'Chess, Running' }, { interests: ' Photography ,' }] });
  assert.deepEqual(under(out, 'INTERESTS'), ['Chess, Running, Photography']);
});

test('Awards print the issuer and the date under the title, then the description', () => {
  const out = text({ type: 'awards', title: 'Awards', items: [{ title: 'Best Paper', issuer: 'ACMorg', date: '05/2021', description: '<p>For the parser.</p>' }] });
  assert.deepEqual(under(out, 'AWARDS'), ['Best Paper - ACMorg', '05/2021', 'For the parser.']);
});

test('References print the job title, company, relationship, e-mail and phone', () => {
  const out = text({ type: 'references', title: 'References', items: [{ name: 'Bob Stone', jobTitle: 'CTOx', company: 'RefCo', relationship: 'Manager', email: 'bob@refco.com', phone: '555 1234' }] });
  assert.deepEqual(under(out, 'REFERENCES'), ['Bob Stone', 'CTOx, RefCo', 'Manager', 'bob@refco.com | 555 1234']);
});

test('A custom section prints the subtitle, the date and the location', () => {
  const out = text({ type: 'custom', title: 'Talks', items: [{ title: 'Speakerx', subtitle: 'JSConf', location: 'Berlin', date: '06/2023', description: '<p>Keynote.</p>' }] });
  assert.deepEqual(under(out, 'TALKS'), ['Speakerx - JSConf', '06/2023 | Berlin', 'Keynote.']);
});

test('A certificate prints its expiry, credential ID and link; its first line is as before', () => {
  const out = text({ type: 'certifications', title: 'Certifications', items: [
    { name: 'AWS SA', issuer: 'Amazon', date: '01/2023', expiry: '01/2026', credentialId: 'ABC-123', url: 'https://cred.example/abc', urlLabel: 'View' },
    { title: 'CKA', issuer: 'CNCF', date: '2022' },
  ] });
  assert.deepEqual(under(out, 'CERTIFICATIONS'), [
    'AWS SA - Amazon - 01/2023', 'Expires: 01/2026 | ID: ABC-123', 'Link: https://cred.example/abc',
    'CKA - CNCF - 2022',
  ]);
});

test('A project prints its dates under its name', () => {
  const out = text({ type: 'projects', title: 'Projects', items: [{ name: 'Proj', technologies: 'React', startDate: '01/2022', endDate: '02/2023', url: 'https://p.dev', description: 'Built it.' }] });
  assert.deepEqual(under(out, 'PROJECTS'), ['Proj (React)', '01/2022 - 02/2023', 'Link: https://p.dev', 'Built it.']);
});

test('The paragraph before (and after) a bullet list prints, in the order the PDF prints it', () => {
  const description = '<p>Owned the billing platform for 40 enterprise customers.</p><ul><li>Cut costs 30%</li><li>Led <b>5</b> engineers</li></ul><p>Then &amp; after.</p>';
  for (const [type, fields] of [
    ['experience', { role: 'Engineer', company: 'Acme' }],
    ['volunteering', { role: 'Mentor', org: 'Code Club' }],
    ['education', { degree: 'BSc', institution: 'MIT' }],
    ['projects', { name: 'Proj' }],
    ['awards', { title: 'Prize' }],
    ['custom', { title: 'Thing' }],
  ]) {
    const lines = under(text({ type, title: 'Part', items: [{ ...fields, description }] }), 'PART');
    assert.deepEqual(lines.slice(-4), [
      'Owned the billing platform for 40 enterprise customers.', '* Cut costs 30%', '* Led 5 engineers', 'Then & after.',
    ], type);
  }
});

test('A one-line description prints above the entry\'s legacy bullets, as in the PDF', () => {
  const out = text({ type: 'experience', title: 'Experience', items: [{ role: 'Dev', company: 'Beta', description: 'Led the core team.', bullets: ['Legacy one', ' ', 'Legacy two'] }] });
  assert.deepEqual(under(out, 'EXPERIENCE'), ['Dev - Beta', 'Led the core team.', '* Legacy one', '* Legacy two']);
});

test('Numbered lists keep their numbers, typed bullets and nested items read as list items', () => {
  const description = '<ol start="3"><li>Third</li><li>Fourth<ul><li>Inner</li></ul></li></ol><p>• Typed bullet</p><p>-5% churn</p>';
  const lines = under(text({ type: 'experience', title: 'Experience', items: [{ role: 'Dev', description }] }), 'EXPERIENCE');
  assert.deepEqual(lines, ['Dev', '3. Third', '4. Fourth', '  * Inner', '* Typed bullet', '-5% churn']);
});

test('The summary prints its paragraphs and its list', () => {
  const out = generateAtsPlainText({ personal: { name: 'Ada', summary: '<p>Engineer.</p><ul><li>Go</li><li>Rust</li></ul>' }, sections: [] });
  assert.deepEqual(under(out, 'PROFESSIONAL SUMMARY'), ['Engineer.', '* Go', '* Rust']);
});

test('A field or description the user hid stays out of every new line', () => {
  const out = text(
    { type: 'awards', title: 'Awards', items: [{ title: 'Prize', issuer: 'Org', date: '2020', hiddenFields: ['issuer', 'date'] }] },
    { type: 'certifications', title: 'Certs', items: [{ name: 'C1', expiry: '2030', credentialId: 'SECRET-ID', url: 'https://x.dev', hiddenFields: ['credentialId', 'url'] }] },
    { type: 'references', title: 'References', items: [{ name: 'Bob', email: 'bob@x.dev', phone: '555', hiddenFields: ['phone'] }] },
    { type: 'interests', title: 'Interests', items: [{ interests: 'Chess' }, { interests: 'Poker', hiddenFields: ['interests'] }, { interests: 'Go', visible: false }] },
    { type: 'experience', title: 'Experience', items: [{ role: 'Dev', description: '<p>Hidden para</p><ul><li>Hidden li</li></ul>', hiddenFields: ['description'] }] },
  );
  assert.deepEqual(under(out, 'AWARDS'), ['Prize']);
  assert.deepEqual(under(out, 'CERTS'), ['C1', 'Expires: 2030']);
  assert.deepEqual(under(out, 'REFERENCES'), ['Bob', 'bob@x.dev']);
  assert.deepEqual(under(out, 'INTERESTS'), ['Chess']);
  assert.deepEqual(under(out, 'EXPERIENCE'), ['Dev']);
});

test('A section whose interests are all empty prints no heading over nothing', () => {
  const out = text({ type: 'interests', title: 'Interests', items: [{ interests: ' , ' }] });
  assert.ok(!out.includes('INTERESTS'), out);
});
