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

/** The separator between a group's category and its skills (Inline and Bullet; Word). */
export const skillSeparator = (settings = {}) => (settings.separator === 'dash' ? ' – ' : ': ');
