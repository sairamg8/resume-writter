// The scanner's keyword extraction read a job description as ASCII (R2-023). Its patterns ([^\w\s+#.-]
// and [^\w+#]) took every accented letter for punctuation, so "München" became the keyword "nchen" and
// "Zürich" "rich"; dotted abbreviations kept their inner dot, so "e.g." became the keyword "e.g". Each
// was then listed as a missing keyword, and "+" wrote it into Skills. The matcher's word boundaries
// were ASCII too, so a keyword "rich" was found inside a résumé's "Zürich". Words are now read as
// Unicode letters, and an abbreviation made of single letters and dots is no keyword.
//
// Run: node --test tests/unit/ats-job-keywords.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJobKeywords, matchResumeWithJob } from '../../src/utils/atsChecker.js';

const keywords = (jd) => extractJobKeywords(jd).map((k) => k.keyword);

test('accented words are whole keywords, not the letters after the accent', () => {
  const got = keywords('Hybrid role in München or Zürich. München office, Zürich office. Kraków team; São Paulo hub.');
  for (const word of ['München', 'Zürich', 'Kraków', 'São', 'Paulo']) assert.ok(got.includes(word), `${word} in ${got.join(', ')}`);
  for (const junk of ['nchen', 'rich', 'Krak', 'M', 'Z', 'S', 'o']) assert.ok(!got.includes(junk), `"${junk}" in ${got.join(', ')}`);
});

test('abbreviations such as e.g., i.e., etc. and U.S. are not keywords', () => {
  const got = keywords('Cloud tools (e.g. Terraform, Pulumi), i.e. infrastructure as code, CI etc. U.S. based. Python vs. Go.');
  for (const junk of ['e.g', 'e.g.', 'i.e', 'i.e.', 'etc', 'U.S', 'U.S.', 'vs']) assert.ok(!got.includes(junk), `"${junk}" in ${got.join(', ')}`);
  for (const word of ['Terraform', 'Pulumi', 'Python', 'Go']) assert.ok(got.includes(word), `${word} in ${got.join(', ')}`);
});

test('dotted and symbol tech names keep their shape (the guard)', () => {
  const got = keywords('Node.js and ASP.NET with C++, C# and Vue.js. Node.js again.');
  for (const word of ['Node.js', 'ASP.NET', 'C++', 'C#', 'Vue.js']) assert.ok(got.includes(word), `${word} in ${got.join(', ')}`);
});

const resumeIn = (location) => ({
  id: 'kw', template: 'classic', settings: {},
  personal: { name: 'Anna Weber', title: 'Engineer', location, summary: '', hiddenFields: [] },
  sections: [{ id: 'sk', type: 'skills', title: 'Skills', visible: true, items: [{ id: 's1', category: 'Tools', skills: 'Go, Terraform' }] }],
});

test('the matcher finds an accented keyword the résumé prints, and none inside another word', () => {
  const inMunich = matchResumeWithJob(resumeIn('München, Germany'), 'München München München. Terraform.');
  assert.ok(inMunich.matchedKeywords.includes('München'), JSON.stringify(inMunich));
  const inZurich = matchResumeWithJob(resumeIn('Zürich, Switzerland'), 'Rich rich rich experience with Terraform.');
  assert.ok(inZurich.missingKeywords.some((k) => k.toLowerCase() === 'rich'), `"rich" is not in "Zürich": ${JSON.stringify(inZurich)}`);
  const elsewhere = matchResumeWithJob(resumeIn('Austin, TX'), 'München München München. Terraform.');
  assert.ok(elsewhere.missingKeywords.includes('München'), JSON.stringify(elsewhere));
  assert.ok(!elsewhere.missingKeywords.includes('nchen'));
});
