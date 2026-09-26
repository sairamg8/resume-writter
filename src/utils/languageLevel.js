// Section Options → Level for Languages (R2-147): how a language's proficiency may be drawn beside its
// word — Text (the word alone, as always), Dots (five, the level's filled) or Bar (a track filled to
// level/5). The word always prints: a drawing never replaces it, and the Word, Markdown and ATS text
// exports print the word alone. Pure, no imports: the PDF's renderers and the tests read it alike.

/**
 * A proficiency's level, 0–5 steps read off its words, first match wins — the scale LinkedIn and the ILR
 * use (Elementary, Limited working, Professional working, Full professional, Native or bilingual) and
 * CEFR's letters, with the everyday words beside them:
 *   5  Native, Bilingual, Mother tongue, C2
 *   4  Fluent, Full professional, Advanced, Proficient, Upper-intermediate, C1, B2
 *   3  Professional (working), Intermediate, Conversational, B1
 *   2  Elementary, Limited (working), Pre-intermediate, A2
 *   1  Basic, Beginner, Novice, A1
 * Fluent is 4, not 5: it sits below Native in the editor's list and in both scales. The editor's plain
 * "Professional" is ILR's "professional working" (3), level with Intermediate: the word printed beside
 * the drawing still tells them apart. The lower steps are tried before 3, so "Limited working" and
 * "Pre-intermediate" are not read as 3.
 */
const LEVELS = [
  // Not "Non-native": a speaker saying they are not one, whatever else the words say.
  [/(?<!non[- ]?)\b(native|bilingual|mother[- ]tongue|c2)\b/, 5],
  [/\b(fluent|full[- ]professional|advanced|proficient|upper[- ]?intermediate|c1|b2)\b/, 4],
  [/\b(elementary|limited|pre[- ]?intermediate|a2)\b/, 2],
  [/\b(basic|beginner|novice|a1)\b/, 1],
  [/\b(professional|intermediate|conversational|working|b1)\b/, 3],
];

/** The level (1–5) `proficiency` names, or null for text the scale does not know (nothing is drawn). */
export function languageLevel(proficiency) {
  const text = String(proficiency ?? '').toLowerCase();
  if (!text.trim()) return null;
  const hit = LEVELS.find(([re]) => re.test(text));
  return hit ? hit[1] : null;
}

/** The drawing a Languages section's settings ask for: 'dots', 'bar', or null (Text, and a value this build does not know). */
export function languageLevelStyle(settings = {}) {
  const v = settings?.levelStyle;
  return v === 'dots' || v === 'bar' ? v : null;
}

/** The steps of the scale: Dots draws this many, Bar fills level / LEVEL_STEPS of its track. */
export const LEVEL_STEPS = 5;
