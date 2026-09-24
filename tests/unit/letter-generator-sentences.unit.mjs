// The Smart Cover Letter Generator's sentences and paragraphs (R2-103, R2-130, R2-043).
// R2-103: a blank or half-filled first job wrote "as  at Acme" and "In my experience at , …", and a
// résumé with no job "as Professional at prior roles". R2-130: the paragraphs were <p>s with nothing
// between them, which the PDF and Word print 2 pt apart as one block, while the modal previewed them
// spaced. R2-043: a résumé with no name or title got 'Candidate' / 'Professional' in the letter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCoverLetter } from '../../src/utils/coverLetterGenerator.js';
import { parseRichText, richTextToPlain } from '../../src/utils/richText.js';

const ARCHETYPES = ['impact', 'leadership', 'growth'];
const resume = (personal, items) => ({ personal, sections: items ? [{ type: 'experience', items }] : [] });
const plain = (letter) => richTextToPlain(letter.body);

/** Word salad the old templates wrote around a missing value. */
const BROKEN = [/ ,/, /\bat ,/, /\bas at\b/, /\bas\s+at\b/, / {2,}/, /prior roles/, /\bthe (role|position|opportunity) at\b/, /\bas an? ,/, /Candidate|Professional/, /\bthe the\b/];

const cases = {
  'a new Experience section (one blank entry)': resume({ name: 'Jane Doe', title: 'Engineer' }, [{ role: '', company: '' }]),
  'a role with no company': resume({ name: 'Jane Doe', title: 'Engineer' }, [{ role: 'Lead Dev', company: '' }]),
  'a company with no role': resume({ name: 'Jane Doe', title: 'Engineer' }, [{ role: '', company: 'Acme' }]),
  'no experience at all': resume({ name: 'Jane Doe', title: 'Engineer' }),
  'an empty résumé': resume({}),
  'a blank entry before a real one': resume({ name: 'Jane Doe' }, [{ role: ' ', company: '' }, { role: 'Lead Dev', company: 'Acme' }]),
};

for (const [label, r] of Object.entries(cases)) {
  for (const archetype of ARCHETYPES) {
    test(`generateCoverLetter (${archetype}), ${label}: every sentence reads whole`, () => {
      const letter = generateCoverLetter({ resume: r, archetype, company: 'Globex' });
      for (const text of [plain(letter), letter.subject]) {
        for (const re of BROKEN) assert.ok(!re.test(text), `${re}: ${text}`);
      }
    });
  }
}

test('generateCoverLetter: the job it cites is the first with a role or a company, in every archetype', () => {
  for (const archetype of ARCHETYPES) {
    const text = plain(generateCoverLetter({ resume: cases['a blank entry before a real one'], archetype }));
    assert.ok(/(as Lead Dev )?at Acme/.test(text), `${archetype}: ${text}`);
  }
  assert.ok(plain(generateCoverLetter({ resume: cases['a role with no company'], archetype: 'impact' })).includes('During my tenure as Lead Dev, I led'));
  assert.ok(plain(generateCoverLetter({ resume: cases['a company with no role'], archetype: 'leadership' })).includes('most notably at Acme, I have'));
  assert.ok(plain(generateCoverLetter({ resume: cases['a new Experience section (one blank entry)'], archetype: 'growth' })).includes('In my experience as Engineer, I developed'));
});

test('generateCoverLetter: a résumé with no name or title writes no placeholder and no signature', () => {
  for (const archetype of ARCHETYPES) {
    const letter = generateCoverLetter({ resume: resume({}), archetype, role: 'Analyst' });
    assert.equal(letter.subject, 'Application for Analyst');
    assert.ok(!('signatureName' in letter) && !('signatureDesignation' in letter), JSON.stringify(letter));
  }
  assert.equal(generateCoverLetter({ resume: resume({ name: 'Jane Doe', title: 'Engineer' }) }).subject, 'Application for Engineer — Jane Doe');
  assert.equal(generateCoverLetter({ resume: resume({}) }).subject, 'Application');
});

test('generateCoverLetter: the paragraphs print apart — one blank line between each two, none at the ends (R2-130)', () => {
  for (const archetype of ARCHETYPES) {
    const blocks = parseRichText(generateCoverLetter({ resume: cases['a role with no company'], archetype }).body);
    const blank = blocks.map((b) => b.runs.map((r) => r.text).join('').trim() === '');
    assert.equal(blocks.length, 9, `${archetype}: 5 paragraphs and 4 blank lines`);
    assert.deepEqual(blank, [false, true, false, true, false, true, false, true, false], archetype);
  }
});

// "as a Engineer": the opening's article did not follow the title's first sound.
test('generateCoverLetter: the opening says "an" before a title that starts with a vowel, "a" otherwise', () => {
  for (const archetype of ARCHETYPES) {
    const opening = (title) => plain(generateCoverLetter({ resume: resume({ name: 'Jane Doe', title }), archetype }));
    for (const title of ['Engineer', 'Analyst', 'engineer', 'Operations Lead', 'Illustrator', 'IT Manager', 'Underwriter', 'Urban Planner']) {
      assert.ok(opening(title).includes(`an ${title}`) && !opening(title).includes(`a ${title}`), `${archetype}: ${title}`);
    }
    // A vowel letter with a consonant sound takes "a": "a UX Designer", "a University Lecturer", "a European …".
    for (const title of ['Designer', 'Staff Engineer', 'Product Manager', 'UX Designer', 'University Lecturer', 'User Researcher', 'European Sales Lead', 'One-Person Studio Owner', 'Unity Developer']) {
      assert.ok(opening(title).includes(`as a ${title}`), `${archetype}: ${title}`);
    }
  }
});
