// Whether a section's entry prints anything. The PDF (sectionPrints) and Word (buildSection) print a
// section's heading only over an entry that does, as Markdown and the ATS text already did: a section
// just added (one blank entry), or whose entries' fields are all hidden with their eyes, printed its
// heading alone in the PDF and Word, and nothing in Markdown or ATS text (R5-HUNT6-BLANK-SECTION-HEADING).
// Plain data (no react-pdf).
import { hasRichText } from './richText.js';
import { skillGroupPrints } from './skills.js';

/** An entry's keys that are never printed text. */
const NOT_PRINTED = new Set(['id', 'visible', 'hiddenFields']);

/** Whether one stored value prints: text that is not blank, a description with text, a legacy bullet. */
function valuePrints(key, value) {
  if (typeof value === 'string') return key === 'description' ? hasRichText(value) : Boolean(value.trim());
  if (Array.isArray(value)) return value.some((v) => (typeof v === 'string' ? Boolean(v.trim()) : typeof v === 'number'));
  // "Present" for a current role; a number from imported data prints as written.
  return value === true || typeof value === 'number';
}

/**
 * Whether `item`, an entry of a section of `type`, prints anything: it is shown and has a field its eye
 * does not hide that holds text. A skill group is decided by skillGroupPrints, as its renderers filter it.
 */
export function entryPrints(type, item) {
  if (!item || item.visible === false) return false;
  if (type === 'skills') return skillGroupPrints(item);
  const hidden = new Set(item.hiddenFields || []);
  return Object.entries(item).some(([k, v]) => !NOT_PRINTED.has(k) && !hidden.has(k) && valuePrints(k, v));
}

/**
 * Whether section `s` prints: it is shown and at least one of its entries prints something
 * (entryPrints). The PDF's every template (PdfSections.jsx), the ATS Check's section and heading items
 * and its job-match corpus (atsChecker.js) read this one rule, so the report never names a section the
 * page leaves out (R2-057, R1-LEFT-d, R5-HUNT6-BLANK-SECTION-HEADING).
 */
export const sectionPrints = (s) => s.visible !== false && (s.items || []).some((i) => entryPrints(s.type, i));
