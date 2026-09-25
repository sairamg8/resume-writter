// A skill group as every export prints it: the PDF's main column (Classic, Modern, Minimal,
// Executive), the Sidebar column and Word read their groups through here, so one rule decides
// what a group shows (R6-0). Plain data (no react-pdf).

/** A stored value as text: '' for none; a number or other value from imported data as written. */
const asText = (v) => (v == null || v === false ? '' : String(v).trim());

/**
 * `item` (a skill group) as printed:
 *   category  the category as typed, '' when the editor's eye hid it (FIDB-74)
 *   skills    the skills as typed, '' when hidden; a list (some imported data) reads as the
 *             comma-separated line the editor writes
 *   list      the skills one by one, for Tags, Bars and the Sidebar's Stacked
 */
export function skillGroup(item = {}) {
  const hidden = item.hiddenFields || [];
  const typed = Array.isArray(item.skills)
    ? item.skills.map(asText).filter(Boolean).join(', ')
    : asText(item.skills);
  const skills = hidden.includes('skills') ? '' : typed;
  return {
    category: hidden.includes('category') ? '' : asText(item.category),
    skills,
    list: skills.split(',').map((sk) => sk.trim()).filter(Boolean),
  };
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
