// R4-DUX-23: the generated letter's copy reads as natural English in every archetype. The default
// 'impact' letter opened "With over several years of hands-on experience…" — "over" before
// "several" is not English, in a letter users send to employers. It now says "With several years…".
// The same scan checks every archetype for a doubled word or a space before punctuation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCoverLetter } from '../../src/utils/coverLetterGenerator.js';
import { richTextToPlain } from '../../src/utils/richText.js';

const ARCHETYPES = ['impact', 'leadership', 'growth'];
const resume = (personal, items) => ({ personal, sections: items ? [{ type: 'experience', items }] : [] });
const letters = [
  resume({ name: 'Jane Doe', title: 'Staff Engineer' }, [{ role: 'Lead Dev', company: 'Acme' }]),
  resume({ name: 'Jane Doe', title: 'Engineer' }),
  resume({}),
];

test('the impact letter says "With several years of hands-on experience", never "over several"', () => {
  for (const r of letters) {
    const text = richTextToPlain(generateCoverLetter({ resume: r, company: 'Globex' }).body);
    assert.ok(!/\bover several\b/i.test(text), text);
    assert.ok(text.includes('With several years of hands-on experience'), text);
  }
});

test('no archetype writes a doubled word or a space before punctuation', () => {
  for (const archetype of ARCHETYPES) {
    for (const r of letters) {
      for (const role of ['', 'Analyst']) {
        const text = richTextToPlain(generateCoverLetter({ resume: r, archetype, role, company: 'Globex' }).body);
        assert.ok(!/\bover several\b/i.test(text), `${archetype}: ${text}`);
        assert.ok(!/\b(\w+)\s+\1\b/i.test(text), `${archetype} doubled word: ${text}`);
        assert.ok(!/\s[,.;:!?]/.test(text), `${archetype} space before punctuation: ${text}`);
      }
    }
  }
});
