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
 * does not hide that holds text. A language prints only with its language (a proficiency alone does
 * not). A skill group is decided by skillGroupPrints, as its renderers filter it.
 */
export function entryPrints(type, item) {
  if (!item || item.visible === false) return false;
  if (type === 'skills') return skillGroupPrints(item);
  const hidden = new Set(item.hiddenFields || []);
  // A proficiency is its language's label: alone ("Professional", every new row's default) it prints
  // nothing, as Markdown and the ATS text already had it (R5-HUNT9-LANGUAGE-DEFAULT-PROFICIENCY-PRINTS-ALONE).
  if (type === 'languages') return !hidden.has('language') && valuePrints('language', item.language);
  // What the type's renderers draw, not every stored field: a certificate's Link label only beside its
  // Link URL (the editor hides the label's box but keeps it when the URL is cleared), and interests
  // only as the parts left after splitting at commas (", " draws no chip). Either alone printed the
  // section's heading over nothing in the PDF and Word (R5-HUNT10-ENTRYPRINTS-COUNTS-UNPRINTED-LEFTOVERS).
  const urlShown = Boolean(item.url) && !hidden.has('url');
  const prints = (k, v) => {
    if (type === 'certifications' && k === 'urlLabel') return urlShown && valuePrints(k, v);
    // "Present" is the End Date's text: its eye off, a current role prints no end (endDateOf), so a
    // current job with every eye off printed its heading over nothing, and went into the JSON Resume
    // file as an empty job (R5-HUNT10-REVIEW-CURRENT-HIDDEN-END-PRINTS).
    if (k === 'current') return v === true && !hidden.has('endDate');
    // A project's `role` (an earlier JSON Resume import's) has no editor box and no renderer draws it
    // (R5-HUNT11-JSON-RESUME-PROJECT-ROLE-INVISIBLE).
    if (type === 'projects' && k === 'role') return false;
    if (type === 'interests' && k === 'interests') return String(v ?? '').split(',').some((s) => s.trim());
    return valuePrints(k, v);
  };
  return Object.entries(item).some(([k, v]) => !NOT_PRINTED.has(k) && !hidden.has(k) && prints(k, v));
}

/**
 * Whether section `s` prints: it is shown and at least one of its entries prints something
 * (entryPrints). The PDF's every template (PdfSections.jsx), the ATS Check's section and heading items
 * and its job-match corpus (atsChecker.js) read this one rule, so the report never names a section the
 * page leaves out (R2-057, R1-LEFT-d, R5-HUNT6-BLANK-SECTION-HEADING).
 */
export const sectionPrints = (s) => s.visible !== false && (s.items || []).some((i) => entryPrints(s.type, i));

/**
 * Section `s`'s entries that print (entryPrints), in order: the list every PDF renderer draws, groups
 * ("Group roles by company"), grids and measures its heading's keep on, as Word's `shown` does. A blank
 * entry, or one whose fields are all hidden with their eyes, took a dot on the Timeline rail, a grid
 * cell, an item gap, and split a company's roles in two groups (R5-HUNT7-BLANK-ENTRY).
 */
export const printedEntries = (s) => (s.items || []).filter((i) => entryPrints(s.type, i));

/** The section types whose renderers read `hiddenFields` themselves (a job's fields, a skill group's): left as they are. */
const READ_HIDDEN_THEMSELVES = new Set(['experience', 'skills']);

/**
 * Section `s` with each entry's hidden fields (the eyes of `hiddenFields`, as a Backup JSON, an import or an older
 * build carries them) emptied: a hidden text prints nowhere, as Markdown, the ATS text and the JSON Resume file already
 * leave it out. The PDF's and Word's renderers for an education, a project, a certification, an award, a volunteering role,
 * a reference, an interest or a custom entry read their fields straight, so a hidden institution, link or description
 * still printed there (only the dates read the flag, R1-LEFT-b). `hiddenFields` itself stays on the entry, so what reads
 * it still sees it. Jobs and skill groups come back as they were; so does a section with nothing hidden (the same object).
 */
export function withHiddenFieldsEmptied(s) {
  if (!s || READ_HIDDEN_THEMSELVES.has(s.type) || !Array.isArray(s.items)) return s;
  const emptied = (item) => {
    if (!item || !Array.isArray(item.hiddenFields)) return item;
    const blank = {};
    for (const key of item.hiddenFields) {
      if (typeof key !== 'string' || NOT_PRINTED.has(key)) continue;
      if (typeof item[key] === 'string' && item[key] !== '') blank[key] = '';
      else if (Array.isArray(item[key]) && item[key].length) blank[key] = [];
    }
    return Object.keys(blank).length ? { ...item, ...blank } : item;
  };
  const items = s.items.map(emptied);
  return items.some((item, i) => item !== s.items[i]) ? { ...s, items } : s;
}
