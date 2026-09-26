// The STAR Optimizer's tip and Auto-Fix got the weak phrase's words wrong (R2-078). The tip quoted the
// suggested replacement as the weak phrase — on "Engineered 4 APIs; handled QA" it said to replace
// "Resolved", a word that is not in the statement — and Auto-Fix wrote its replacement capitalised
// wherever the phrase stood: "Engineered 4 APIs; Managed QA". The tip now quotes the words it found and
// offers the replacements, and Auto-Fix capitalises only at the start of a sentence.
//
// Run: node --test tests/unit/bullet-optimizer-autofix.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBullet, autoFixWeakPhrases } from '../../src/utils/bulletOptimizer.js';

test('the tip quotes the weak phrase as written, and offers the replacements as replacements', () => {
  const tip = analyzeBullet('Engineered 4 APIs; handled QA').suggestions.find((s) => /weak/i.test(s));
  assert.ok(tip, 'a tip about the weak phrase');
  assert.match(tip, /"handled"/, tip);
  assert.match(tip, /"Managed"/, `it offers Auto-Fix's replacement: ${tip}`);
  assert.doesNotMatch(tip, /like "Resolved"/, tip);
  const lead = analyzeBullet('Was responsible for 4 APIs').suggestions.find((s) => /weak/i.test(s));
  assert.match(lead, /"Was responsible for"/, lead);
});

test('the repro: Auto-Fix mid-sentence writes the verb in lowercase', () => {
  assert.equal(autoFixWeakPhrases('Engineered 4 APIs; handled QA'), 'Engineered 4 APIs; managed QA');
  assert.equal(autoFixWeakPhrases('Built the API and worked on the SDK'), 'Built the API and engineered the SDK');
  assert.equal(autoFixWeakPhrases('Built 3 tools, participated in reviews'), 'Built 3 tools, contributed to reviews');
  assert.equal(autoFixWeakPhrases('I was responsible for 4 APIs'), 'I led 4 APIs');
});

test('at the start of a sentence, a line or a bullet, the verb is capitalised', () => {
  assert.equal(autoFixWeakPhrases('Handled QA for 4 APIs'), 'Managed QA for 4 APIs');
  assert.equal(autoFixWeakPhrases('handled QA for 4 APIs'), 'Managed QA for 4 APIs');
  assert.equal(autoFixWeakPhrases('Built 4 APIs. handled QA.'), 'Built 4 APIs. Managed QA.');
  assert.equal(autoFixWeakPhrases('Built 4 APIs!  Worked on QA'), 'Built 4 APIs!  Engineered QA');
  assert.equal(autoFixWeakPhrases('Built 4 APIs\nhandled QA'), 'Built 4 APIs\nManaged QA');
  assert.equal(autoFixWeakPhrases('• handled QA'), '• Managed QA');
  assert.equal(autoFixWeakPhrases('"Responsible for QA"'), '"Led QA"');
});

test('every weak phrase in a statement is fixed, each in its own case', () => {
  assert.equal(
    autoFixWeakPhrases('Responsible for billing; helped with onboarding. Handled refunds.'),
    'Led billing; facilitated onboarding. Managed refunds.',
  );
});

// R4-CL-05: "\b(did)\b" matched the "did" of "didn't" (the apostrophe is a word boundary), so the
// badge called it weak and Auto-Fix wrote "deliveredn't". A contraction is not its weak verb.
test('"didn\'t" is neither flagged nor rewritten, with a straight or a curly apostrophe', () => {
  for (const apostrophe of ["'", '’']) {
    const text = `Ensured releases didn${apostrophe}t slip past the sprint deadline`;
    assert.equal(autoFixWeakPhrases(text), `Guaranteed releases didn${apostrophe}t slip past the sprint deadline`);
    assert.deepEqual(analyzeBullet(text).weakPhrases.map((w) => w.phrase), ['Ensured']);
    assert.deepEqual(analyzeBullet(`It didn${apostrophe}t change`).weakPhrases, []);
  }
  // The verb itself is still weak.
  assert.equal(autoFixWeakPhrases('Did the migration'), 'Delivered the migration');
});
