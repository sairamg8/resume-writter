// R5-HUNT5-JSONRESUME-ROUNDTRIP-DESCRIPTION-REORDERED-AND-FLATTENED: an entry's description went out
// to the JSON Resume file as a plain `summary` (every paragraph) and plain `highlights` (every list
// item), and the import rebuilt it as the summary first, then one flat list: a paragraph typed
// after the bullets moved above them, two paragraphs merged into one, bold, links, numbering and
// nesting were gone — for jobs, schools, projects, volunteering and the app's own custom sections.
// The export now writes the description itself beside them (descriptionHtml) when they alone would
// come back differently, and the import reads it back while they are unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';
import { sanitizeRichText } from '../../src/utils/richText.js';

const roundTrip = (resume) => jsonResumeToCpwtResume(JSON.parse(JSON.stringify(cpwtResumeToJsonResume(resume))));
const RICH = '<ul><li>Built the <strong>ingest</strong> pipeline</li></ul><p>Stack: React, Node</p><p>Second <a href="https://example.com">para</a></p>'
  + '<ol><li>First<ul><li>Nested</li></ul></li><li>Second</li></ol>';
const resume = {
  personal: { name: 'Pat Sample' }, template: 'classic', settings: {},
  sections: [
    { id: 'w', type: 'experience', title: 'Work', items: [{ id: 'i', company: 'Acme', role: 'Dev', description: RICH }] },
    { id: 'e', type: 'education', title: 'Education', items: [{ id: 'k', institution: 'MIT', degree: 'BSc', description: RICH }] },
    { id: 'p', type: 'projects', title: 'Projects', items: [{ id: 'q', name: 'Engine', description: RICH }] },
    { id: 'v', type: 'volunteering', title: 'Volunteering', items: [{ id: 'r', org: 'Red Cross', role: 'Driver', description: RICH }] },
    { id: 'c', type: 'custom', title: 'Talks', items: [{ id: 's', title: 'On engines', description: RICH }] },
  ],
};

test('round trip: every entry description comes back as it printed — order, paragraphs, marks, links, lists', () => {
  const back = roundTrip(resume);
  assert.deepEqual(back.sections.map((s) => s.type), ['experience', 'education', 'projects', 'volunteering', 'custom']);
  for (const s of back.sections) assert.equal(s.items[0].description, sanitizeRichText(RICH), s.type);
});

test('export: the plain summary and highlights stay what every other tool reads', () => {
  const out = cpwtResumeToJsonResume(resume);
  assert.deepEqual([out.work[0].summary, out.work[0].highlights], ['Stack: React, Node\nSecond para', ['Built the ingest pipeline', 'First', 'Nested', 'Second']]);
  assert.equal(out.projects[0].description, 'Stack: React, Node\nSecond para');
});

test('export: a description the summary and highlights rebuild as it was carries no copy', () => {
  const out = cpwtResumeToJsonResume({ ...resume, sections: [{ type: 'experience', items: [{ company: 'A', description: '<p>Led payments.</p><ul><li>Cut cost</li></ul>', bullets: ['Old point'] }] }] });
  assert.equal('descriptionHtml' in out.work[0], false);
  assert.deepEqual(out.work[0].highlights, ['Cut cost', 'Old point']);
});

test('import: a copy whose summary or highlights were edited since is not used — the edited text is', () => {
  const file = cpwtResumeToJsonResume(resume);
  file.work[0].highlights[0] = 'Built the new pipeline';
  const back = jsonResumeToCpwtResume(JSON.parse(JSON.stringify(file)));
  assert.match(back.sections[0].items[0].description, /Built the new pipeline/);
  assert.doesNotMatch(back.sections[0].items[0].description, /<strong>/);
});
