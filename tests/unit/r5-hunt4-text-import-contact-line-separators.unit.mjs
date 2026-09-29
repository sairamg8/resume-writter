// R5-HUNT4-TEXT-IMPORT-CONTACT-LINE-DASH-COMMA-SLASH: a header's contact line set apart at " — ",
// " / " or ", " ("alex@kim.dev — (206) 555-0100 — Seattle, WA"). Before, it was split only at | • ·
// and tabs, so it gave no email, phone or location, and printed whole as "Additional Information";
// a Markdown line led by the job title went to the summary. Each contact now goes to the header.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText, markdownLines } from '../../src/utils/importText.js';

const header = (r) => [r.personal.title, r.personal.email, r.personal.phone, r.personal.location];

test('a contact line set apart at dashes, slashes or commas gives each contact', () => {
  for (const sep of [' — ', ' – ', ' - ', ' / ', ', ']) {
    const r = resumeFromText(`Alex Kim\nBackend Engineer\nalex@kim.dev${sep}(206) 555-0100${sep}Seattle, WA\n\nEXPERIENCE\nStripe\tMar 2021 - Present\nEngineer`);
    assert.deepEqual(header(r), ['Backend Engineer', 'alex@kim.dev', '(206) 555-0100', 'Seattle, WA'], sep);
    assert.deepEqual(r.sections.map((s) => s.type), ['experience'], sep);
  }
});

test('with no job title line, the contact line is not taken for one', () => {
  const r = resumeFromText('Alex Kim\nalex@kim.dev — (206) 555-0100 — Seattle, WA\n\nEXPERIENCE\nStripe\tMar 2021 - Present\nEngineer');
  assert.deepEqual(header(r), ['', 'alex@kim.dev', '(206) 555-0100', 'Seattle, WA']);
  assert.deepEqual(r.sections.map((s) => s.type), ['experience']);
});

test('a Markdown line led by the job title gives the title and every contact', () => {
  const r = resumeFromText(markdownLines('# Alex Kim\n\nBackend Engineer — alex@kim.dev — [GitHub](https://github.com/alexkim) — Seattle, WA\n\n## Experience\n\n### Stripe\n\nMar 2021 - Present'));
  assert.deepEqual(header(r), ['Backend Engineer', 'alex@kim.dev', '', 'Seattle, WA']);
  assert.equal(r.personal.github, 'https://github.com/alexkim');
  assert.equal(r.personal.summary, '');
});

test('a summary line with a dash, and a title with one, stay whole', () => {
  const r = resumeFromText('Alex Kim\nSenior Engineer — Payments\nalex@kim.dev | Seattle, WA\nBuilt payment systems at scale — from ledgers to APIs.\n\nEXPERIENCE\nStripe\tMar 2021 - Present\nEngineer');
  assert.deepEqual(header(r), ['Senior Engineer — Payments', 'alex@kim.dev', '', 'Seattle, WA']);
  assert.equal(r.personal.summary, '<p>Built payment systems at scale — from ledgers to APIs.</p>');
});
