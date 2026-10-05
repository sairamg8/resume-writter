// R2-147 — a per-skill level. A skill group's skills are one comma-separated text, so a level rides on the
// group as `skillLevels` ({ 'React': 4 }, by the skill as typed): one scale, 1–5 (src/constants/skillLevels.js),
// used by the editor's list, the PDF's Bars (a bar filled to level / 5), Word's glyphs and the JSON Resume
// words. No level set is what a group always was: Bars' 80 % (a 4 of 5) and nothing anywhere else. This
// file: the scale, the normaliser, the group as printed, the editor's writes, and the JSON Resume trip.
//
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SKILL_LEVELS, SKILL_LEVEL_STEPS, SKILL_BAR_UNSET, skillBarWidth, skillLevelFromText, skillLevelLabel, skillLevelValue,
} from '../../src/constants/skillLevels.js';
import { skillGroup, skillLevelOf, skillNames, withSkillLevel, withSkillLevels } from '../../src/utils/skills.js';
import { cpwtResumeToJsonResume, jsonResumeToCpwtResume } from '../../src/utils/jsonResume.js';

test('the scale is one to five, lowest first, each with its word', () => {
  assert.deepEqual(SKILL_LEVELS.map((l) => [l.value, l.label]), [[1, 'Beginner'], [2, 'Basic'], [3, 'Intermediate'], [4, 'Advanced'], [5, 'Expert']]);
  assert.equal(SKILL_LEVEL_STEPS, 5);
  assert.deepEqual([1, 2, 3, 4, 5].map(skillLevelLabel), SKILL_LEVELS.map((l) => l.label));
  assert.equal(skillLevelLabel(null), '');
  assert.equal(skillLevelLabel(9), '');
});

test('a level is a whole number 1-5 (or its digits); anything else is no level', () => {
  for (const good of [1, 2, 3, 4, 5, '1', '5', ' 3 ']) assert.equal(skillLevelValue(good), Number(good), String(good));
  for (const bad of [0, 6, -1, 2.5, '2.5', '0', '6', 'high', '', null, undefined, NaN, Infinity, true, [], {}, [3]]) assert.equal(skillLevelValue(bad), null, JSON.stringify(bad));
});

test('a Bars skill fills level / 5 of its track; no level fills the 80 % it always did', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(skillBarWidth), ['20%', '40%', '60%', '80%', '100%']);
  for (const none of [undefined, null, 0, 7, 'x']) assert.equal(skillBarWidth(none), '80%', String(none));
  assert.equal(SKILL_BAR_UNSET, '80%');
  // The default is a level of the scale, not a special width: a 4 draws what unset draws.
  assert.equal(skillBarWidth(4), SKILL_BAR_UNSET);
});

test('the file\'s words: the editor\'s five, other tools\' synonyms, numbers and percentages; the rest is no level', () => {
  const cases = {
    Beginner: 1, beginner: 1, Novice: 1, Basic: 2, Elementary: 2, Intermediate: 3, INTERMEDIATE: 3, Competent: 3,
    Advanced: 4, Proficient: 4, Expert: 5, Master: 5, guru: 5,
    1: 1, '3': 3, 5: 5, '80%': 4, '60': 3, 80: 4, '100%': 5, '20 %': 1, 100: 5,
  };
  for (const [text, level] of Object.entries(cases)) assert.equal(skillLevelFromText(isNaN(text) ? text : Number(text)), level, text);
  for (const text of ['', '  ', null, undefined, 'Intermediate to advanced', 'Some', '0', '0%', '101%', '2.5', -3, 'six']) assert.equal(skillLevelFromText(text), null, String(text));
  // What the editor writes reads back as itself.
  for (const { value, label } of SKILL_LEVELS) assert.equal(skillLevelFromText(label), value, label);
});

const group = (extra) => ({ id: 'g1', category: 'Web', skills: 'React, Vue, Go', ...extra });

test('a group as printed: each skill\'s level beside it, null where none is set or it is not a level', () => {
  const g = skillGroup(group({ skillLevels: { React: 5, Vue: '2', Go: 9, Ghost: 3 } }));
  assert.deepEqual(g.list, ['React', 'Vue', 'Go']);
  assert.deepEqual(g.levels, [5, 2, null]);
  assert.deepEqual(skillGroup(group()).levels, [null, null, null]);
  for (const bad of [null, 'x', 4, [], [4, 4, 4], true]) assert.deepEqual(skillGroup(group({ skillLevels: bad })).levels, [null, null, null], JSON.stringify(bad));
  // The list and the text are what they always were.
  assert.equal(skillGroup(group({ skillLevels: { React: 5 } })).skills, 'React, Vue, Go');
  // A skill named like an Object member reads its own level, not the prototype's.
  assert.deepEqual(skillGroup({ skills: 'constructor, toString', skillLevels: { toString: 3 } }).levels, [null, 3]);
  assert.equal(skillLevelOf({ React: 2 }, 'constructor'), null);
});

test('a hidden skills field prints no skills, so no levels', () => {
  const g = skillGroup(group({ hiddenFields: ['skills'], skillLevels: { React: 5 } }));
  assert.deepEqual([g.list, g.levels], [[], []]);
  // The names still read for the editor and the normaliser: hiding is not deleting.
  assert.deepEqual(skillNames(group({ hiddenFields: ['skills'] })), ['React', 'Vue', 'Go']);
});

test('the editor sets a level: the group keeps the levels of the skills it lists now, in their order, and no empty object', () => {
  const g = group({ skillLevels: { React: 4, Gone: 2 } });
  const set = withSkillLevel(g, 'Go', 5);
  assert.deepEqual(set.skillLevels, { React: 4, Go: 5 });
  assert.deepEqual(Object.keys(set.skillLevels), ['React', 'Go']);
  assert.deepEqual(withSkillLevel(set, 'React', 2).skillLevels, { React: 2, Go: 5 });
  // Not set (''), the last one: the key goes.
  const cleared = withSkillLevel(withSkillLevel(set, 'React', ''), 'Go', '');
  assert.ok(!('skillLevels' in cleared));
  assert.deepEqual(cleared, group());
  // The list's value is text; a value that is no level clears.
  assert.deepEqual(withSkillLevel(g, 'Vue', '3').skillLevels, { React: 4, Vue: 3 });
  assert.deepEqual(withSkillLevel(g, 'Vue', 'x').skillLevels, { React: 4 });
  // A skill the text does not list gets none; the input is not changed.
  assert.deepEqual(withSkillLevel(g, 'Rust', 5).skillLevels, { React: 4 });
  assert.deepEqual(g.skillLevels, { React: 4, Gone: 2 });
});

const resumeOf = (...items) => ({ sections: [{ id: 's', type: 'skills', title: 'Skills', items }, { id: 'o', type: 'custom', items: [{ id: 'x', skills: 'A', skillLevels: { A: 9 } }] }] });

test('normalise: valid levels stay, invalid ones are unset, unknown skills go, the key goes when none is left', () => {
  const r = resumeOf(
    group({ skillLevels: { React: 4, Vue: '2', Go: 6, Ghost: 3 } }),
    group({ id: 'g2', skillLevels: { React: 0, Vue: 'high', Go: null } }),
    group({ id: 'g3', skillLevels: 'x' }),
    group({ id: 'g4', skillLevels: [3, 3, 3] }),
    group({ id: 'g5', skillLevels: { Vue: 3.5 } }),
  );
  const out = withSkillLevels(r).sections[0].items;
  assert.deepEqual(out[0].skillLevels, { React: 4, Vue: 2 });
  for (const i of [1, 2, 3, 4]) assert.ok(!('skillLevels' in out[i]), `group ${i + 1}`);
  // The text and everything else on the group are kept.
  assert.deepEqual(out.map((i) => i.skills), r.sections[0].items.map((i) => i.skills));
  // Only Skills sections are read: another section's field of that name is left alone.
  assert.deepEqual(withSkillLevels(r).sections[1], r.sections[1]);
});

test('normalise: the same object when nothing changes, and a hidden skill keeps its level', () => {
  const r = resumeOf(group({ skillLevels: { React: 4, Go: 1 } }), group({ id: 'g2' }), group({ id: 'g3', hiddenFields: ['skills'], skillLevels: { React: 5 } }));
  assert.equal(withSkillLevels(r), r);
  assert.deepEqual(withSkillLevels(r).sections[0].items[2].skillLevels, { React: 5 });
  const fixed = withSkillLevels(resumeOf(group({ skillLevels: { React: '4', Ghost: 1 } })));
  assert.equal(withSkillLevels(fixed), fixed);
  for (const v of [null, undefined, {}, { sections: 'x' }]) assert.equal(withSkillLevels(v), v);
});

test('normalise: a skills list stored as an array (imported data) is read as its text', () => {
  const out = withSkillLevels(resumeOf({ id: 'g', skills: ['React', 'Vue'], skillLevels: { React: 3, Ghost: 2 } })).sections[0].items[0];
  assert.deepEqual(out.skillLevels, { React: 3 });
});

const cv = (...items) => ({ personal: { name: 'Mira Tidewell' }, template: 'classic', settings: {}, sections: [{ id: 's1', type: 'skills', title: 'Skills', items }] });
const skillsOf = (r) => r.sections.find((s) => s.type === 'skills').items;
const levelsOf = (r) => skillsOf(r).map((i) => ({ skills: i.skills, skillLevels: i.skillLevels }));

test('JSON Resume out: skills[].level is the word when the whole group shares one; otherwise keywordLevels; none: neither', () => {
  const file = cpwtResumeToJsonResume(cv(
    group({ skillLevels: { React: 4, Vue: 4, Go: 4 } }),
    group({ id: 'g2', category: 'Back', skills: 'Go, Rust', skillLevels: { Go: 5 } }),
    group({ id: 'g3', category: 'Mixed', skills: 'A, B', skillLevels: { A: 1, B: 3 } }),
    group({ id: 'g4', category: 'Plain', skills: 'X, Y' }),
  ));
  assert.deepEqual(file.skills, [
    { name: 'Web', level: 'Advanced', keywords: ['React', 'Vue', 'Go'] },
    { name: 'Back', keywordLevels: { Go: 'Expert' }, keywords: ['Go', 'Rust'] },
    { name: 'Mixed', keywordLevels: { A: 'Beginner', B: 'Intermediate' }, keywords: ['A', 'B'] },
    // No level set: the entry is what it always was.
    { name: 'Plain', keywords: ['X', 'Y'] },
  ]);
  for (const s of file.skills) assert.ok(typeof s.level === 'undefined' || typeof s.level === 'string', 'level is a string');
});

test('JSON Resume round trip: levels come back as they went, and out -> in -> out is stable', () => {
  const start = cv(
    group({ skillLevels: { React: 4, Vue: 4, Go: 4 } }),
    group({ id: 'g2', category: 'Back', skills: 'Go, Rust', skillLevels: { Go: 5 } }),
    group({ id: 'g3', category: 'Mixed', skills: 'A, B, C', skillLevels: { A: 1, C: 3 } }),
    group({ id: 'g4', category: 'Plain', skills: 'X, Y' }),
  );
  const file = cpwtResumeToJsonResume(start);
  const back = jsonResumeToCpwtResume(JSON.parse(JSON.stringify(file)));
  assert.deepEqual(levelsOf(back), levelsOf(start));
  assert.deepEqual(cpwtResumeToJsonResume(back).skills, file.skills);
  // Twice over, and through the normaliser (what the store does with an import), nothing moves.
  const again = jsonResumeToCpwtResume(JSON.parse(JSON.stringify(cpwtResumeToJsonResume(withSkillLevels(back)))));
  assert.deepEqual(levelsOf(again), levelsOf(start));
});

test('JSON Resume in: another tool\'s level (a word, a number, a percentage) is every skill of the group\'s; text that names none is none', () => {
  const file = {
    basics: { name: 'X' },
    skills: [
      { name: 'Langs', level: 'Master', keywords: ['JS', 'TS'] },
      { name: 'Ops', level: '80%', keywords: ['Docker'] },
      { name: 'Odd', level: 'a lot', keywords: ['Perl'] },
      { name: 'Bare', keywords: ['Lisp'] },
      { name: 'Num', level: 3, keywords: ['C', 'C++'] },
      // Both: the keyword's own beats the group's.
      { name: 'Both', level: 'Basic', keywordLevels: { Rust: 'Expert', Nothing: 'x' }, keywords: ['Rust', 'Zig'] },
    ],
  };
  assert.deepEqual(levelsOf(jsonResumeToCpwtResume(file)), [
    { skills: 'JS, TS', skillLevels: { JS: 5, TS: 5 } },
    { skills: 'Docker', skillLevels: { Docker: 4 } },
    { skills: 'Perl', skillLevels: undefined },
    { skills: 'Lisp', skillLevels: undefined },
    { skills: 'C, C++', skillLevels: { C: 3, 'C++': 3 } },
    { skills: 'Rust, Zig', skillLevels: { Rust: 5, Zig: 2 } },
  ]);
  // A group with no level imports with no `skillLevels` key at all.
  assert.ok(!('skillLevels' in skillsOf(jsonResumeToCpwtResume(file))[3]));
});

test('JSON Resume: a hidden skills field writes no keywords, so no level; a level of an unlisted skill is not written', () => {
  const file = cpwtResumeToJsonResume(cv(
    group({ hiddenFields: ['skills'], skillLevels: { React: 5 } }),
    group({ id: 'g2', skills: 'A', skillLevels: { A: 3, Ghost: 5 } }),
  ));
  assert.deepEqual(file.skills.map((s) => [s.level, s.keywordLevels, s.keywords]), [[undefined, undefined, []], ['Intermediate', undefined, ['A']]]);
});
