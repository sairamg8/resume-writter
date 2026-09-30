// R5-HUNT10-VERB-CHIP-DROPS-NOUN-OF-PHRASE: a power-verb chip swapped every phrase of more than one word
// among Auto-Fix's alternatives for its verb, noun and all: "Maintained compliance with HIPAA" read
// "Streamlined HIPAA", "Supported delivery of the payments platform" read "Architected the payments
// platform", and "Active member of the ACM chapter" read "Spearheaded the ACM chapter" — a member made
// its leader. The chip now replaces only the verb, and leaves "Member of…" for the user to rewrite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertActionVerb, opensWithAuxiliary } from '../../src/utils/bulletOptimizer.js';

test('the chip replaces only the verb of a phrase with a noun in it', () => {
  assert.equal(insertActionVerb('Maintained compliance with HIPAA across 3 clinics', 'Streamlined'), 'Streamlined compliance with HIPAA across 3 clinics');
  assert.equal(insertActionVerb('Supported delivery of the payments platform', 'Architected'), 'Architected delivery of the payments platform');
  assert.equal(insertActionVerb('- Supported delivery of the payments platform', 'Architected'), '- Architected delivery of the payments platform');
});

test('"Member of" and "Active member of" are left for a rewrite, as a helper verb is', () => {
  for (const t of ['Active member of the ACM student chapter', 'Member of the ACM chapter', '• Active member of IEEE']) {
    assert.equal(insertActionVerb(t, 'Spearheaded'), t, t);
    assert.equal(opensWithAuxiliary(t), true, t);
  }
});

test('a verb and its preposition still go whole', () => {
  assert.equal(insertActionVerb('Contributed to the SOC 2 audit', 'Spearheaded'), 'Spearheaded the SOC 2 audit');
  assert.equal(insertActionVerb('Collaborated on the SDK', 'Spearheaded'), 'Spearheaded the SDK');
  assert.equal(insertActionVerb('Supported efforts to cut costs', 'Spearheaded'), 'Spearheaded efforts to cut costs');
  assert.equal(insertActionVerb('Took part in the hackathon', 'Spearheaded'), 'Spearheaded the hackathon');
});
