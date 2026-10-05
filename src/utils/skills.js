// A skill group as every export prints it: the PDF's main column (Classic, Modern, Minimal,
// Executive), the Sidebar column and Word read their groups through here, so one rule decides
// what a group shows (R6-0). Plain data (no react-pdf).
import { skillLevelValue } from '../constants/skillLevels.js';

/** A stored value as text: '' for none; a number or other value from imported data as written. */
const asText = (v) => (v == null || v === false ? '' : String(v).trim());

/** A group's skills as typed: a list (some imported data) reads as the comma-separated line the editor writes. */
const typedSkills = (item) => (Array.isArray(item.skills) ? item.skills.map(asText).filter(Boolean).join(', ') : asText(item.skills));

/** The skills a group's text lists, one by one as typed, whether or not the editor's eye hid them. */
export const skillNames = (item = {}) => typedSkills(item).split(',').map((sk) => sk.trim()).filter(Boolean);

/**
 * The level (1–5, skillLevels.js) the group's `skillLevels` gives the skill `name`, or null: none set,
 * or one that is not a level. Read by the skill as typed; a name like 'constructor' reads its own.
 */
export const skillLevelOf = (levels, name) => (levels && typeof levels === 'object' && Object.hasOwn(levels, name) ? skillLevelValue(levels[name]) : null);

/**
 * `item` (a skill group) as printed:
 *   category  the category as typed, '' when the editor's eye hid it (FIDB-74)
 *   skills    the skills as typed, '' when hidden; a list (some imported data) reads as the
 *             comma-separated line the editor writes
 *   list      the skills one by one, for Tags, Bars and the Sidebar's Stacked
 *   levels    each skill's level (1–5) or null, in the order of `list`: Bars draws it (R2-147)
 */
export function skillGroup(item = {}) {
  const hidden = item.hiddenFields || [];
  const typed = typedSkills(item);
  const skills = hidden.includes('skills') ? '' : typed;
  const list = skills.split(',').map((sk) => sk.trim()).filter(Boolean);
  return {
    category: hidden.includes('category') ? '' : asText(item.category),
    skills,
    list,
    levels: list.map((sk) => skillLevelOf(item.skillLevels, sk)),
  };
}

/**
 * `item` with the skill `name`'s level set to `level` (1–5), or cleared for none (R2-147). The group's
 * `skillLevels` is rebuilt from the skills its text lists now, in their order: a level of a skill that
 * was renamed or deleted goes, and so does the key when no level is left. A new object.
 */
export function withSkillLevel(item, name, level) {
  const next = {};
  for (const n of skillNames(item)) {
    const v = n === name ? skillLevelValue(level) : skillLevelOf(item.skillLevels, n);
    if (v) next[n] = v;
  }
  const { skillLevels: _old, ...rest } = item;
  return Object.keys(next).length ? { ...rest, skillLevels: next } : rest;
}

/**
 * `r` with each skill group's `skillLevels` normalised (R2-147): an object of skill → level, a level a
 * whole number 1–5 (a digit text of one is that number) and the skill one its text lists — an invalid
 * level, an unknown skill or anything but an object reads as no level and is dropped, and the key goes
 * when none is left. A skill the editor's eye hid still keeps its level. normalizeResume() runs this
 * wherever résumés come in. The same object when every group is as it should be.
 */
export function withSkillLevels(r) {
  if (!Array.isArray(r?.sections)) return r;
  const clean = (item) => {
    if (!item || typeof item !== 'object' || !('skillLevels' in item)) return item;
    const kept = {};
    for (const n of skillNames(item)) {
      const v = skillLevelOf(item.skillLevels, n);
      if (v) kept[n] = v;
    }
    const given = item.skillLevels && typeof item.skillLevels === 'object' ? item.skillLevels : {};
    const same = Object.keys(kept).length > 0 && Object.keys(given).length === Object.keys(kept).length && Object.keys(kept).every((k) => given[k] === kept[k]);
    if (same) return item;
    const { skillLevels: _old, ...rest } = item;
    return Object.keys(kept).length ? { ...rest, skillLevels: kept } : rest;
  };
  const sections = r.sections.map((s) => {
    if (s?.type !== 'skills' || !Array.isArray(s.items)) return s;
    const items = s.items.map(clean);
    return items.some((item, i) => item !== s.items[i]) ? { ...s, items } : s;
  });
  return sections.some((s, i) => s !== r.sections[i]) ? { ...r, sections } : r;
}

/**
 * Whether `item` prints anything: a category or skills (skillGroup's). A group added and left blank, or
 * with both eyes off, takes no row, marker or gap in the PDF, as Word, Markdown and the ATS text leave
 * it out (R5-HUNT4-PDF-EMPTY-SKILL-GROUP-LONE-BULLET).
 */
export function skillGroupPrints(item) {
  const { category, skills } = skillGroup(item);
  return Boolean(category || skills);
}

/**
 * A group's `category` in the case it prints in: in capitals in the Sidebar's side column
 * (`sideColumn`, every style) and in the main column's Tags and Bars (`style`, the stored Skills
 * style); as typed in Inline, Bullet, Stacked and a style the app does not offer, which prints as
 * Inline. The PDF and Word read it here, so the .docx cases a category as the preview (ONB-2-NB1).
 */
export function skillCategory(category, { style, sideColumn = false } = {}) {
  return sideColumn || style === 'tags' || style === 'bars' ? category.toUpperCase() : category;
}

/**
 * `r` with each skill group that holds nothing but the old `name` label holding it as its skills
 * instead. The role starters (1f08531) saved every skill that way, and the editor, the PDF, Word and
 * the exports read `category` and `skills`, so a résumé made from one printed an empty Skills
 * section. normalizeResume() runs this wherever résumés come in. The same object when none is.
 */
export function withSkillNames(r) {
  if (!Array.isArray(r?.sections)) return r;
  const heal = (item) => {
    const { name, ...rest } = item || {};
    return typeof name === 'string' && name.trim() && !asText(item.skills) && !asText(item.category)
      ? { ...rest, skills: name.trim() }
      : item;
  };
  const sections = r.sections.map((s) => {
    if (s?.type !== 'skills' || !Array.isArray(s.items)) return s;
    const items = s.items.map(heal);
    return items.some((item, i) => item !== s.items[i]) ? { ...s, items } : s;
  });
  return sections.some((s, i) => s !== r.sections[i]) ? { ...r, sections } : r;
}

/**
 * The separator between a group's category and its skills (Inline and Bullet; Word): Section Options →
 * Separator's Colon (and a section storing none), Dash or Pipe (R2-147).
 */
const SEPARATORS = { colon: ': ', dash: ' – ', pipe: ' | ' };
export const skillSeparator = (settings = {}) => (Object.hasOwn(SEPARATORS, settings.separator) ? SEPARATORS[settings.separator] : SEPARATORS.colon);
