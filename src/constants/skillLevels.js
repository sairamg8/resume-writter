// A skill's own level (R2-147): a group's skill (a comma-separated part of its Skills text) may carry a
// level of one to five, kept in the group's `skillLevels` ({ 'React': 4 }, by the skill as typed). One
// scale end to end: the editor's list, the PDF's Bars (a bar filled to level / 5), Word's glyphs and
// the JSON Resume words. A skill with no level draws the 80 % bar it always did (4 of 5) and prints
// nothing more anywhere else. Plain data, no imports: Node loads it as well as Vite.

/** The scale, lowest first: `label` is what the editor's list and the JSON Resume file name it. */
export const SKILL_LEVELS = [
  { value: 1, label: 'Beginner' },
  { value: 2, label: 'Basic' },
  { value: 3, label: 'Intermediate' },
  { value: 4, label: 'Advanced' },
  { value: 5, label: 'Expert' },
];

/** The steps of the scale: a bar is filled to level / SKILL_LEVEL_STEPS, Word draws this many glyphs. */
export const SKILL_LEVEL_STEPS = SKILL_LEVELS.length;

/** The width of a Bars skill that has no level: what every bar was (SKILL_LEVEL_STEPS = 5, so a 4). */
export const SKILL_BAR_UNSET = '80%';

/**
 * `v` as a level: a whole number from 1 to SKILL_LEVEL_STEPS, or the same as text ('4', from a hand-written
 * file); null for anything else (0, 2.5, 6, words, null), which reads as no level.
 */
export function skillLevelValue(v) {
  const n = typeof v === 'string' && /^\s*\d+\s*$/.test(v) ? Number(v) : v;
  return Number.isInteger(n) && n >= 1 && n <= SKILL_LEVEL_STEPS ? n : null;
}

/** A Bars skill's fill as a width: its level's fifths, or SKILL_BAR_UNSET without one. */
export const skillBarWidth = (level) => (skillLevelValue(level) ? `${skillLevelValue(level) * (100 / SKILL_LEVEL_STEPS)}%` : SKILL_BAR_UNSET);

/** The word for `level` (the editor's, the file's), '' for none. */
export const skillLevelLabel = (level) => SKILL_LEVELS.find((l) => l.value === skillLevelValue(level))?.label ?? '';

/**
 * Words another tool's JSON Resume file (skills[].level) may use, beside the editor's own five, by level.
 * Whole text only: "Intermediate to advanced" names no level.
 */
const SYNONYMS = {
  1: ['novice', 'entry', 'entry level', 'entry-level', 'learning', 'starter'],
  2: ['elementary', 'junior', 'limited', 'familiar', 'fundamental', 'fundamentals'],
  3: ['competent', 'working', 'moderate', 'average', 'mid', 'mid-level', 'intermediate'],
  4: ['proficient', 'strong', 'skilled', 'senior', 'fluent', 'high'],
  5: ['master', 'mastery', 'guru', 'expert', 'specialist', 'native'],
};

/**
 * A level as text (a JSON Resume skills[].level) read as one, or null: the editor's five words and the
 * synonyms above in any case, a whole number 1–5 ('4'), or a percentage or a number over 5 up to 100
 * ('80%', '60') in fifths, the way another tool's file gives a bar. Anything else reads as no level.
 */
export function skillLevelFromText(text) {
  const t = String(text ?? '').trim().toLowerCase();
  if (!t) return null;
  const word = SKILL_LEVELS.find((l) => l.label.toLowerCase() === t)?.value
    ?? Number(Object.keys(SYNONYMS).find((k) => SYNONYMS[k].includes(t)));
  if (Number.isInteger(word)) return word;
  const m = /^(\d+(?:\.\d+)?)\s*(%?)$/.exec(t);
  if (!m) return null;
  const n = Number(m[1]);
  if (!m[2] && Number.isInteger(n) && n >= 1 && n <= SKILL_LEVEL_STEPS) return n;
  return (m[2] || n > SKILL_LEVEL_STEPS) && n > 0 && n <= 100 ? Math.max(1, Math.round(n / (100 / SKILL_LEVEL_STEPS))) : null;
}
