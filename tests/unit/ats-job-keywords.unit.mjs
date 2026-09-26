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

// A posting pasted from a PDF or a Mac often spells "ü" decomposed, "u" + U+0308, and a Hindi or
// Tamil word holds vowel signs (combining marks) that no composed letter replaces: a mark is part of
// its word, or "München" was "Mu" and "nchen" again (review of R2-023).
test('decomposed accents and combining vowel signs stay inside their word', () => {
  const got = keywords('Hybrid role in München or Zürich. Café team.'.normalize('NFD'));
  for (const word of ['München', 'Zürich', 'Café']) assert.ok(got.includes(word), `${word} in ${got.join(', ')}`);
  for (const junk of ['Mu', 'nchen', 'Zu', 'rich', 'Cafe']) assert.ok(!got.includes(junk), `"${junk}" in ${got.join(', ')}`);
  const indic = keywords('Fluent हिन्दी and தமிழ் required.');
  for (const word of ['हिन्दी', 'தமிழ்']) assert.ok(indic.includes(word), `${word} in ${indic.join(', ')}`);
  // Composed or not on either side, the résumé's word is matched.
  const decomposedResume = matchResumeWithJob(resumeIn('München, Germany'.normalize('NFD')), 'München München. Terraform.');
  assert.ok(decomposedResume.matchedKeywords.includes('München'), JSON.stringify(decomposedResume));
  const decomposedPosting = matchResumeWithJob(resumeIn('München, Germany'), 'München München. Terraform.'.normalize('NFD'));
  assert.ok(decomposedPosting.matchedKeywords.includes('München'), JSON.stringify(decomposedPosting));
});

// R4-CL-02: the apostrophe was read as a space before the stop list ran, so "You'll", "we're",
// "We've", "Don't" and "haven't" became the keywords "ll", "re", "ve", "Don" and "haven", listed as
// missing and written into Skills by "+". A contraction is its stop word now, straight or curly, and
// a possessive is its name.
test('contractions are not keywords, typed with a straight or a curly apostrophe', () => {
  const jd = "You'll join a team where we're shipping fast. We've got Kubernetes. Don't worry if you haven't used Go. It'll be fun, isn't it? I'm sure they'd agree.";
  for (const text of [jd, jd.replace(/'/g, '’')]) {
    const got = keywords(text);
    for (const junk of ['ll', 're', 've', 'Don', 'haven', 'isn', 'It', 'd', 'm', 't', "You'll", "we're", "Don't", "It'll", "isn't", "they'd", "I'm"]) {
      assert.ok(!got.some((k) => k.toLowerCase() === junk.toLowerCase()), `"${junk}" in ${got.join(', ')}`);
    }
    for (const word of ['Kubernetes', 'Go', 'shipping']) assert.ok(got.includes(word), `${word} in ${got.join(', ')}`);
  }
});

test('a possessive reads as its name, and a name with an apostrophe stays whole', () => {
  const got = keywords("Stripe's payments team. Stripe’s API. Work with O'Reilly authors. The company's goals.");
  assert.ok(got.includes('Stripe'), got.join(', '));
  assert.ok(!got.some((k) => /^stripe['’]s$/i.test(k) || k === 's'), got.join(', '));
  assert.ok(got.includes("O'Reilly"), got.join(', '));
  assert.ok(!got.some((k) => /^(o|reilly|company|company's)$/i.test(k)), got.join(', '));
});

test('a contraction in the posting is never a missing keyword the "+" could add', () => {
  const r = resumeIn('Austin, TX');
  const m = matchResumeWithJob(r, "We’re hiring. You'll use Terraform. We've shipped Go.");
  assert.deepEqual(m.missingKeywords.filter((k) => /^(ll|re|ve)$/i.test(k)), []);
  assert.ok(m.matchedKeywords.includes('Terraform') && m.matchedKeywords.includes('Go'), JSON.stringify(m));
});
