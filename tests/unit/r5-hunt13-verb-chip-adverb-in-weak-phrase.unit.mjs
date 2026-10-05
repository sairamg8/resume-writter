// R5-HUNT13-VERB-CHIP-ADVERB-IN-WEAK-PHRASE: a power-verb chip on a weak opening with an adverb in it put its
// verb in front of the weak one — "Worked extensively on the billing service" read "Spearheaded Worked
// extensively on the billing service". Every weak phrase was a fixed literal ("worked on"), so
// "worked extensively on" matched nothing: no weak-phrase badge, no Auto-Fix button, "Verb Missing" only,
// the ATS score called it clean, and the chip's verb doubled the weak one. Now an adverb inside a weak phrase
// ("Helped significantly to", "Participated actively in") is part of it for the chip, Auto-Fix, the badge and
// the ATS score, one adverb before it ("Actively assisted in", "Solely responsible for", "Successfully
// delivered") stays in front of the chip's verb, a helper verb before "tasked with" / "in charge of" goes as it
// does under Auto-Fix, the present tense and gerund of the phrases are replaced by a chip, and a weak verb
// with no phrase to replace ("Worked as a lead on…") is left for a rewrite instead of getting a second verb.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeBullet, autoFixWeakPhrases, insertActionVerb, leadsWithActionVerb, opensWithAuxiliary, opensWithVerbWith,
} from '../../src/utils/bulletOptimizer.js';
import { analyzeAtsScore } from '../../src/utils/atsChecker.js';

const chip = (text, verb = 'Spearheaded') => insertActionVerb(text, verb);

/** What the ATS score makes of `bullet` as a résumé's only statement: passive language, and a leading verb. */
function atsVerdict(bullet) {
  const r = {
    id: 'hunt13', template: 'classic', settings: {}, personal: { name: 'Kim Park', hiddenFields: [] },
    sections: [{ id: 'exp', type: 'experience', title: 'Experience', visible: true, items: [
      { id: 'e1', company: 'Initech', role: 'Engineer', startDate: '2020-01', current: true, bullets: [bullet] },
    ] }],
  };
  const items = analyzeAtsScore(r).categories.experience.items;
  return { weak: items.some((i) => i.id === 'weak_phrases'), verb: items.find((i) => i.id === 'action_verbs').status === 'pass' };
}
const optimizerWeak = (bullet) => analyzeBullet(bullet).weakPhrases.length > 0;

/** Every chip result that begins with the chip's verb and then a weak verb: the defect. */
const DOUBLED = /(?:spearheaded|architected|led)\s+(?:worked|helped|assisted|participated|tried|attempted|handled|ensured|changed|working|helping|assisting|participating|trying|attempting|handling|ensuring|work|help|assist|participate|try|attempt|handle|ensure)\b/i;

test('the repro: an adverb between "worked" and "on" is part of the weak phrase, and the chip replaces it', () => {
  assert.equal(chip('Worked extensively on the billing service'), 'Spearheaded the billing service');
  assert.equal(chip('Worked extensively on the billing service', 'Architected'), 'Architected the billing service');
  assert.equal(autoFixWeakPhrases('Worked extensively on the billing service'), 'Engineered the billing service');
  const a = analyzeBullet('Worked extensively on the billing service');
  assert.equal(a.weakPhrases.length, 1, 'the badge counts it, and the Auto-Fix button shows');
  assert.equal(a.weakPhrases[0].phrase, 'Worked extensively on');
});

test('an adverb between a weak verb and its particle: the chip, Auto-Fix and the badge agree', () => {
  const cases = [
    // [statement, chip result for "Spearheaded", Auto-Fix result, the phrase the badge quotes]
    ['Worked very closely on the SDK', 'Spearheaded the SDK', 'Engineered the SDK', 'Worked very closely on'],
    ['Helped extensively with the audit', 'Spearheaded the audit', 'Facilitated the audit', 'Helped extensively with'],
    ['Assisted heavily in the audit', 'Spearheaded the audit', 'Facilitated the audit', 'Assisted heavily in'],
    ['Assisted extensively with onboarding', 'Spearheaded onboarding', 'Facilitated onboarding', 'Assisted extensively with'],
    ['Participated actively in the hackathon', 'Spearheaded the hackathon', 'Contributed to the hackathon', 'Participated actively in'],
    ['Responsibilities primarily included QA', 'Spearheaded QA', 'Led QA', 'Responsibilities primarily included'],
    ['Duties also included QA', 'Spearheaded QA', 'Led QA', 'Duties also included'],
    ['Worked tirelessly on the checkout page for a fictional shop', 'Spearheaded the checkout page for a fictional shop', 'Engineered the checkout page for a fictional shop', 'Worked tirelessly on'],
  ];
  for (const [text, chipped, fixed, phrase] of cases) {
    assert.equal(chip(text), chipped, `chip on "${text}"`);
    assert.equal(autoFixWeakPhrases(text), fixed, `Auto-Fix on "${text}"`);
    assert.equal(analyzeBullet(text).weakPhrases[0]?.phrase, phrase, `the badge on "${text}"`);
    assert.equal(opensWithAuxiliary(text), false, `no rewrite tip on "${text}"`);
  }
});

test('"tried", "attempted" and "helped to" with an adverb keep "efforts to", as without one', () => {
  assert.equal(chip('Helped significantly to cut costs by 20%'), 'Spearheaded efforts to cut costs by 20%');
  assert.equal(chip('Tried hard to cut costs'), 'Spearheaded efforts to cut costs');
  assert.equal(chip('tried hard to cut costs'), 'Spearheaded efforts to cut costs');
  assert.equal(chip('Attempted repeatedly to cut costs', 'Architected'), 'Architected efforts to cut costs');
  assert.equal(autoFixWeakPhrases('Helped significantly to cut costs by 20%'), 'Facilitated efforts to cut costs by 20%');
  assert.equal(autoFixWeakPhrases('Tried hard to cut costs'), 'Led efforts to cut costs');
  assert.equal(autoFixWeakPhrases('Attempted repeatedly to cut costs'), 'Led efforts to cut costs');
});

test('a gerund or a noun after the phrase stays, so do the bullet mark, quotes and case', () => {
  assert.equal(chip('- Worked extensively on migrating 12 services to AWS'), '- Spearheaded migrating 12 services to AWS');
  assert.equal(chip('worked extensively on the API'), 'Spearheaded the API');
  assert.equal(chip('• Worked extensively on the API'), '• Spearheaded the API');
  assert.equal(chip('"Worked extensively on the API"'), '"Spearheaded the API"');
  assert.equal(chip('Worked extensively on\nthe API'), 'Spearheaded\nthe API', 'a line break stays');
  assert.equal(autoFixWeakPhrases('- Worked extensively on migrating 12 services to AWS'), '- Engineered migrating 12 services to AWS');
});

test('Auto-Fix inside a sentence: lowercase mid-sentence, a capital where a sentence starts', () => {
  assert.equal(autoFixWeakPhrases('Shipped v2 and worked extensively on the SDK'), 'Shipped v2 and engineered the SDK');
  assert.equal(autoFixWeakPhrases('Built 4 APIs. worked extensively on QA.'), 'Built 4 APIs. Engineered QA.');
  assert.equal(autoFixWeakPhrases('Built 4 APIs! Worked on QA'), 'Built 4 APIs! Engineered QA');
  assert.equal(autoFixWeakPhrases('Shipped v2; was solely responsible for QA and helped extensively with the audit'), 'Shipped v2; solely led QA and facilitated the audit');
});

test('a chip after Auto-Fix, and a chip after a chip, replace the verb that is there', () => {
  const fixed = autoFixWeakPhrases('Worked extensively on the billing service');
  assert.equal(chip(fixed), 'Spearheaded the billing service');
  assert.equal(chip(chip('Worked extensively on the billing service'), 'Architected'), 'Architected the billing service');
});

test('an adverb before the weak phrase stays in front of the chip\'s verb, as Auto-Fix keeps it', () => {
  const cases = [
    ['Actively assisted in the audit', 'Actively spearheaded the audit', 'Actively facilitated the audit'],
    ['Also worked on the API', 'Also spearheaded the API', 'Also engineered the API'],
    ['Successfully worked on the API', 'Successfully spearheaded the API', 'Successfully engineered the API'],
    ['Successfully handled 40 tickets a day', 'Successfully spearheaded 40 tickets a day', 'Successfully managed 40 tickets a day'],
    ['Consistently ensured uptime', 'Consistently spearheaded uptime', 'Consistently guaranteed uptime'],
    ['Solely responsible for the billing service', 'Solely spearheaded the billing service', 'Solely led the billing service'],
    ['Primarily responsible for the budget', 'Primarily spearheaded the budget', 'Primarily led the budget'],
    ['Fully responsible for payroll', 'Fully spearheaded payroll', 'Fully led payroll'],
    ['Primarily in charge of QA', 'Primarily spearheaded QA', 'Primarily oversaw QA'],
  ];
  for (const [text, chipped, fixed] of cases) {
    assert.equal(chip(text), chipped, `chip on "${text}"`);
    assert.equal(autoFixWeakPhrases(text), fixed, `Auto-Fix on "${text}"`);
  }
  assert.equal(chip('- also worked on the API'), '- Also spearheaded the API', 'capitalised, the mark kept');
  assert.equal(chip('Later became solely responsible for payroll'), 'Later solely spearheaded payroll');
  assert.equal(chip('Later became responsible for payroll'), 'Later spearheaded payroll');
});

test('an adverb before a strong verb, a verb phrase or "took part" stays in front of the verb too', () => {
  assert.equal(chip('Successfully delivered 12 projects'), 'Successfully spearheaded 12 projects');
  assert.equal(chip('Actively built the ledger'), 'Actively spearheaded the ledger');
  assert.equal(chip('Actively set up the on-call practice'), 'Actively spearheaded the on-call practice');
  assert.equal(chip('Actively led efforts to cut costs'), 'Actively spearheaded efforts to cut costs');
  assert.equal(chip('Previously contributed to the SDK'), 'Previously spearheaded the SDK');
  assert.equal(chip('Also worked with PMs', 'Partnered'), 'Also partnered with PMs');
  assert.equal(chip('Also worked with PMs'), 'Also worked with PMs', 'a verb that does not take "with" leaves it');
  assert.equal(opensWithAuxiliary('Also worked with PMs'), true);
  assert.equal(chip('Now manage a team of 8'), 'Now spearheaded a team of 8');
});

test('a statement that opens with a noun or adjective ending in -ly is no adverb', () => {
  assert.equal(chip('Family support program for 4 clinics'), 'Spearheaded Family support program for 4 clinics');
  assert.equal(chip('Daily support rotation for 4 teams'), 'Spearheaded Daily support rotation for 4 teams');
  assert.equal(chip('Currently Senior engineer at Acme'), 'Spearheaded Currently Senior engineer at Acme');
});

test('a helper verb, with an adverb or not, goes with "tasked with", "in charge of", "responsible for"', () => {
  const cases = [
    ['Was tasked with rebuilding the billing API', 'Spearheaded rebuilding the billing API'],
    ['Was in charge of QA', 'Spearheaded QA'],
    ['Was solely responsible for the budget', 'Solely spearheaded the budget'],
    ['Was primarily tasked with QA', 'Primarily spearheaded QA'],
    ['Was later tasked with rebuilding the API', 'Later spearheaded rebuilding the API'],
    ['Were responsible for payroll', 'Spearheaded payroll'],
    ['Is responsible for the billing service', 'Spearheaded the billing service'],
    ['Are responsible for the budget', 'Spearheaded the budget'],
    ['Am responsible for payroll', 'Spearheaded payroll'],
    ['Were involved in hiring', 'Spearheaded hiring'],
    ['- Was in charge of QA', '- Spearheaded QA'],
    ['Was responsible for the payments team of 5', 'Spearheaded the payments team of 5'],
  ];
  for (const [text, chipped] of cases) {
    assert.equal(chip(text), chipped, `chip on "${text}"`);
    assert.equal(opensWithAuxiliary(text), false, `no rewrite tip on "${text}"`);
  }
  assert.equal(chip('Was in charge of QA', 'Architected'), 'Architected QA');
  assert.equal(chip('Was involved in hiring'), 'Spearheaded hiring', 'as before');
  assert.equal(chip('Got heavily involved in hiring'), 'Heavily spearheaded hiring', 'as before');
});

test('a negated opening, "involved in" with an adverb and a perfect tense stay as they are, with the tip', () => {
  for (const text of [
    'Was not responsible for billing',
    "Wasn't in charge of QA",
    'Was never tasked with QA',
    'Was not directly responsible for the audit',
    'Was not made solely responsible for billing',
    'Was directly involved in hiring',
    'Was actively involved in hiring',
    'Has been responsible for payroll',
    'Have worked on the API',
    'Had worked on the API',
    'Previously was promoted to lead',
  ]) {
    assert.equal(chip(text), text, text);
    assert.equal(opensWithAuxiliary(text), true, `"${text}" gets the rewrite tip`);
  }
  // Auto-Fix leaves the negated and the "involved in" ones, and still fixes a perfect tense.
  assert.equal(autoFixWeakPhrases('Was directly involved in hiring'), 'Was directly involved in hiring');
  assert.equal(autoFixWeakPhrases('Was not directly responsible for the audit'), 'Was not directly responsible for the audit');
  assert.equal(autoFixWeakPhrases('Has been responsible for payroll'), 'Has led payroll');
  assert.equal(autoFixWeakPhrases('Have worked on the API'), 'Have engineered the API');
});

test('a chip alone replaces the present tense and gerund of a weak phrase, never a noun that opens the same way', () => {
  const cases = [
    ['Work on the billing service', 'Spearheaded the billing service'],
    ['Working on the billing service', 'Spearheaded the billing service'],
    ['Works on the billing service', 'Spearheaded the billing service'],
    ['Working extensively on the API', 'Spearheaded the API'],
    ['Help with the audit', 'Spearheaded the audit'],
    ['Helping with the audit', 'Spearheaded the audit'],
    ['Assist in the audit', 'Spearheaded the audit'],
    ['Assisting heavily with the audit', 'Spearheaded the audit'],
    ['Participate in the audit', 'Spearheaded the audit'],
    ['Participating in hiring', 'Spearheaded hiring'],
    ['Handle the billing', 'Spearheaded the billing'],
    ['Handling the billing', 'Spearheaded the billing'],
    ['Handles 40 tickets a day', 'Spearheaded 40 tickets a day'],
    ['Ensure uptime', 'Spearheaded uptime'],
    ['Ensuring uptime', 'Spearheaded uptime'],
    ['Try to cut costs', 'Spearheaded efforts to cut costs'],
    ['Trying to cut costs', 'Spearheaded efforts to cut costs'],
    ['Helping to cut costs', 'Spearheaded efforts to cut costs'],
    ['Worked to improve uptime', 'Spearheaded efforts to improve uptime'],
    ['Worked hard to ship v2', 'Spearheaded efforts to ship v2'],
    ['Worked tirelessly to ship v2', 'Spearheaded efforts to ship v2'],
  ];
  for (const [text, chipped] of cases) assert.equal(chip(text), chipped, `chip on "${text}"`);
  // Present tense is a chip's alone: the weak list, Auto-Fix and the score stay in the past tense.
  assert.equal(autoFixWeakPhrases('Work on the billing service'), 'Work on the billing service');
  // A noun is none of them: the verb goes in front, as before.
  for (const text of ['Work experience at Acme', 'Help desk for 40 agents', 'Handling fees for 4 regions', 'Change management for 4 teams', 'Handler for 40 tickets']) {
    assert.equal(chip(text), `Spearheaded ${text}`, text);
  }
  // "Ensure that" has a clause after it: not handled here, as "Ensured that" has its own gap.
  assert.equal(chip('Ensure that uptime stays high'), 'Spearheaded Ensure that uptime stays high');
});

test('"Worked with" and its adverbs: only a verb that takes "with" replaces it, and keeps what is before "with"', () => {
  const withs = [
    'Worked hand in hand with PMs',
    'Worked hand-in-hand with PMs',
    'Worked side by side with designers',
    'Worked in tandem with finance',
    'Worked very closely with PMs',
    'Working with PMs',
    'Works with PMs',
  ];
  for (const text of withs) {
    assert.equal(chip(text), text, `a verb that does not take "with" leaves "${text}"`);
    assert.equal(opensWithAuxiliary(text), true, `"${text}" gets the tip`);
    assert.equal(opensWithVerbWith(text), true, text);
    assert.equal(opensWithAuxiliary(text, 'Partnered'), false, `Partnered is fine on "${text}"`);
  }
  assert.equal(chip('Worked hand in hand with PMs', 'Partnered'), 'Partnered hand in hand with PMs');
  assert.equal(chip('Worked hand-in-hand with PMs', 'Liaised'), 'Liaised hand-in-hand with PMs');
  assert.equal(chip('Worked side by side with designers', 'Coordinated'), 'Coordinated side by side with designers');
  assert.equal(chip('Worked in tandem with finance', 'Aligned'), 'Aligned in tandem with finance');
  assert.equal(chip('Worked very closely with PMs', 'Partnered'), 'Partnered very closely with PMs');
  assert.equal(chip('Working with PMs', 'Partnered'), 'Partnered with PMs');
  assert.equal(chip('Works with PMs', 'Negotiated'), 'Negotiated with PMs');
});

test('a weak verb with no phrase to replace is left as it is, with the tip: no second verb', () => {
  for (const text of [
    'Worked as a backend engineer on the API',
    'Worked at Acme on the API',
    'Worked for Acme on the API',
    'Worked in a team of 5 on the API',
    'Worked across 4 teams to ship v2',
    'Worked towards 99.9% uptime',
    'Worked overtime on the launch',
    'Worked early on in the project',
    'Helped the team ship v2',
    'Helped out',
    'Assisted customers with returns',
    'Participated as a speaker in 4 panels',
    'Helped Emily with the audit',
    'Assisted Kelly in the audit',
    'Helped Sally to ship v2',
  ]) {
    assert.equal(chip(text), text, text);
    assert.equal(opensWithAuxiliary(text), true, `"${text}" gets the rewrite tip`);
    assert.equal(autoFixWeakPhrases(text), text, `Auto-Fix does not drop a word of "${text}"`);
  }
});

test('"Contributed extensively to", "Collaborated closely on" and "Took active part in" go whole', () => {
  assert.equal(chip('Contributed extensively to the SDK'), 'Spearheaded the SDK');
  assert.equal(chip('Collaborated closely on the SDK'), 'Spearheaded the SDK');
  assert.equal(chip('Contributed heavily to open source'), 'Spearheaded open source');
  assert.equal(chip('Contribute extensively to the SDK'), 'Spearheaded the SDK');
  assert.equal(chip('Contributed significantly to the SDK', 'Architected'), 'Architected the SDK');
  assert.equal(chip('Took active part in the audit'), 'Spearheaded the audit');
  assert.equal(chip('Took a key part in the audit'), 'Spearheaded the audit');
  assert.equal(chip('Take a major part in the audit'), 'Spearheaded the audit');
  assert.equal(chip('Took active part in 3 audits'), 'Spearheaded 3 audits');
  // "Took active part" opens no action, as "Took part" does.
  assert.equal(leadsWithActionVerb('Took active part in the audit'), false);
  assert.equal(leadsWithActionVerb('Took part in the audit'), false);
  assert.equal(leadsWithActionVerb('Took over the platform'), true);
  assert.equal(leadsWithActionVerb('Took on the role'), true);
});

test('a hyphenated word after "on" is no "worked on": "Worked on-call rotations" is not "Spearheaded-call"', () => {
  for (const text of ['Worked on-call rotations for 3 teams', 'Worked on-site at 4 clients']) {
    assert.equal(optimizerWeak(text), false, `the badge: "${text}"`);
    assert.equal(atsVerdict(text).weak, false, `the ATS score: "${text}"`);
    assert.equal(autoFixWeakPhrases(text), text, `Auto-Fix: "${text}"`);
    assert.doesNotMatch(chip(text), /Spearheaded-/, text);
    assert.equal(chip(text), text, text);
    assert.equal(opensWithAuxiliary(text), true, `"${text}" gets the rewrite tip`);
  }
  // A hyphen or a comma after a space is punctuation: nothing changes there.
  assert.equal(chip('Worked on, the API'), 'Spearheaded, the API');
});

test('the optimizer and the ATS score agree on an adverb inside a weak phrase, and on what Auto-Fix writes', () => {
  for (const text of [
    'Worked extensively on the billing service for 3 teams',
    'Helped significantly to cut hosting costs by 20%',
    'Participated actively in the hackathon of 40 teams',
    'Responsibilities primarily included QA for 4 APIs',
    'Shipped 4 releases and worked extensively on the SDK',
  ]) {
    assert.equal(optimizerWeak(text), true, `optimizer: "${text}"`);
    assert.equal(atsVerdict(text).weak, true, `ATS: "${text}"`);
    const fixed = autoFixWeakPhrases(text);
    assert.equal(optimizerWeak(fixed), false, `optimizer after Auto-Fix: "${fixed}"`);
    assert.equal(atsVerdict(fixed).weak, false, `ATS after Auto-Fix: "${fixed}"`);
  }
  for (const text of ['Worked extensively on the billing service for 3 teams', 'Participated actively in the hackathon of 40 teams']) {
    const fixed = autoFixWeakPhrases(text);
    assert.equal(analyzeBullet(fixed).hasActionVerb, true, `optimizer: "${fixed}" has a strong verb`);
    assert.equal(atsVerdict(fixed).verb, true, `ATS: "${fixed}" has a strong verb`);
  }
  // A weak verb is not a strong verb, with an adverb in it either.
  assert.equal(analyzeBullet('Worked extensively on the billing service').hasActionVerb, false);
});

test('near-misses keep their behaviour: "Worked on", "Worked with", names, whole words', () => {
  assert.equal(chip('Worked on the billing service'), 'Spearheaded the billing service');
  assert.equal(autoFixWeakPhrases('Worked on the billing service'), 'Engineered the billing service');
  assert.equal(chip('Worked on the checkout page for a fictional shop'), 'Spearheaded the checkout page for a fictional shop');
  // "Worked with" is the people's, and is not "worked on" with a gap.
  assert.equal(chip('Worked with product managers to ship v2'), 'Worked with product managers to ship v2');
  assert.equal(chip('Worked closely with PMs to ship v2'), 'Worked closely with PMs to ship v2');
  assert.equal(chip('Worked alongside designers'), 'Worked alongside designers');
  assert.equal(chip('Teamed up with sales', 'Partnered'), 'Partnered with sales');
  assert.equal(chip('Worked cross-functionally with legal'), 'Worked cross-functionally with legal');
  assert.equal(autoFixWeakPhrases('Worked with product managers to ship v2'), 'Collaborated with product managers to ship v2');
  for (const text of ['Worked with Alice on the API', 'Worked closely with PMs on the SDK']) {
    assert.equal(chip(text), text, text);
    assert.equal(analyzeBullet(text).weakPhrases.some((w) => /\bon$/i.test(w.phrase)), false, `"${text}" is no "worked … on"`);
  }
  // A name or "early on" in the gap is not an adverb, and Auto-Fix never drops it.
  assert.equal(autoFixWeakPhrases('Helped Emily with the audit'), 'Helped Emily with the audit');
  assert.equal(autoFixWeakPhrases('Worked early on in the project'), 'Worked early on in the project');
  // A phrase inside a longer word is none (R4-LO-11).
  for (const text of ['Networked extensively on LinkedIn', 'Reworked extensively on the API', 'Fixed 120 unhandled exceptions', 'Did not miss a deadline in 3 years']) {
    assert.equal(optimizerWeak(text), false, `optimizer: "${text}"`);
    assert.equal(atsVerdict(text).weak, false, `ATS: "${text}"`);
    assert.equal(autoFixWeakPhrases(text), text, text);
  }
  assert.equal(chip('Workflow tooling with 12 teams', 'Built'), 'Built Workflow tooling with 12 teams');
});

test('a strong first word, and the helper and negative openers, keep their behaviour', () => {
  assert.equal(chip('Built the ledger service'), 'Spearheaded the ledger service');
  assert.equal(chip('Led the migration'), 'Spearheaded the migration');
  assert.equal(chip('Spearheaded the migration', 'Led'), 'Led the migration');
  assert.equal(chip('Coordinated the launch of 3 products'), 'Spearheaded the launch of 3 products');
  assert.equal(chip('Led efforts to cut costs'), 'Spearheaded efforts to cut costs');
  assert.equal(chip('Contributed to the SOC 2 audit'), 'Spearheaded the SOC 2 audit');
  assert.equal(chip('Collaborated on the SDK'), 'Spearheaded the SDK');
  assert.equal(chip('Took part in the hackathon'), 'Spearheaded the hackathon');
  assert.equal(chip('Managed extensively the API'), 'Spearheaded extensively the API');
  assert.equal(analyzeBullet('Built the ledger service').hasActionVerb, true);
  // The first word is strong, the weak phrase later: only the first verb is replaced, Auto-Fix fixes the rest.
  assert.equal(chip('Spearheaded worked extensively on the API', 'Led'), 'Led worked extensively on the API');
  assert.equal(autoFixWeakPhrases('Spearheaded worked extensively on the API'), 'Spearheaded engineered the API');
  assert.equal(autoFixWeakPhrases('Handled QA for 4 APIs'), 'Managed QA for 4 APIs');
  for (const text of ['Did not miss a deadline', 'Was promoted to lead', 'Has shipped 4 apps', 'Never missed a release', '• Were ranked first in the region', 'Could not reproduce the bug', 'No customer data was lost']) {
    assert.equal(chip(text), text, text);
    assert.equal(opensWithAuxiliary(text), true, text);
  }
});

test('whatever the weak opener, its adverb and its particle, no chip puts a verb in front of a weak one', () => {
  const adverbs = ['', 'extensively', 'heavily', 'very closely', 'actively', 'directly', 'primarily', 'jointly', 'tirelessly', 'also', 'always',
    'significantly', 'repeatedly', 'successfully', 'effectively', 'proactively', 'fully', 'hard', 'together', 'only', 'very heavily'];
  // The past tense is a verb whatever follows it; the present tense and the gerund only with their own
  // particle ("Work experience", "Help desk" are nouns, and keep the verb in front).
  const openers = [
    ...['Worked', 'Helped', 'Assisted', 'Participated', 'Tried', 'Attempted', 'Handled', 'Ensured', 'Changed', 'Did']
      .map((lead) => [lead, ['on', 'with', 'in', 'to', 'for', 'as', 'the']]),
    ...['Work', 'Working', 'Works'].map((lead) => [lead, ['on', 'to']]),
    ...['Help', 'Helping', 'Helps'].map((lead) => [lead, ['with', 'to']]),
    ...['Assist', 'Assisting', 'Assists'].map((lead) => [lead, ['with', 'in']]),
    ...['Participate', 'Participating', 'Participates'].map((lead) => [lead, ['in']]),
    ...['Try', 'Trying', 'Tries', 'Attempt', 'Attempting', 'Attempts'].map((lead) => [lead, ['to']]),
  ];
  let checked = 0;
  for (const [lead, particles] of openers) {
    for (const particle of particles) {
      for (const adverb of adverbs) {
        for (const before of ['', 'Actively ', 'Also ', 'Later ']) {
          const text = `${before}${lead}${adverb && ` ${adverb}`} ${particle} the checkout page for 3 teams`;
          for (const verb of ['Spearheaded', 'Architected', 'Led']) {
            const out = chip(text, verb);
            assert.doesNotMatch(out, DOUBLED, `"${text}" became "${out}"`);
            checked++;
          }
        }
      }
    }
  }
  assert.ok(checked > 3000, `${checked} openings checked`);
});
