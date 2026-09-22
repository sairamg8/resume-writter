// Text wherever a résumé keeps text. A native .json, a JSON Resume file or a résumé saved from one
// can hold a list, a number or an object there, and whatever reads the field reads text. The
// cover letter generator split skills stored as a list and threw, blanking the editor as the Cover
// Letter tab rendered. The ATS score and text, the Markdown and JSON Resume exports, the Skills
// editor and the PDF threw on others. normalizeResume() runs withTextFields() wherever résumés come
// in, whatever their data version, so a résumé already saved that way is text once loaded.
import { CONTACT_FIELDS } from '@/utils/contacts';
import { storedText } from '@/utils/storedText';

/**
 * The fields a résumé keeps as text. Personal info's, with a link field's Display label and Link
 * URL (BLANK_PERSONAL, CONTACT_FIELDS). A section's title. Each entry's (SECTION_TYPE_DEFAULTS),
 * plus a skill group's old `name` label, which the generator and the JSON Resume export read when
 * the group has no skills. The letter's block, body and closing. Dates are not here: dates.js
 * reads a number (an imported 2019) as the year, and anything else as no date.
 */
const PERSONAL_TEXT = ['name', 'title', 'summary', ...CONTACT_FIELDS.flatMap(({ key, link }) => (link ? [key, `${key}Label`, `${key}Url`] : [key]))];
const SECTION_TEXT = ['title'];
const ENTRY_TEXT = [
  'company', 'role', 'org', 'location', 'description', 'institution', 'degree', 'fieldOfStudy', 'gpa',
  'category', 'skills', 'name', 'url', 'urlLabel', 'link', 'technologies', 'language', 'proficiency',
  'issuer', 'credentialId', 'title', 'subtitle', 'jobTitle', 'relationship', 'phone', 'email', 'interests',
];
const LETTER_TEXT = ['recipientName', 'recipientTitle', 'company', 'subject', 'body', 'closing'];
/** The letter's signature: none stored signs with the résumé's name and title (letterSignature), '' with none. */
const SIGNATURE_TEXT = ['signatureName', 'signatureDesignation'];

const isRecord = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/**
 * `obj` with each of `keys` that it stores as neither text nor null made text (storedText). A value
 * with no text in it becomes `blank`: '' by default, what the app stores for a field never filled
 * in; when `blank` is null, the key is left out instead. The same object when all are text already.
 */
function withText(obj, keys, blank = '') {
  if (!isRecord(obj)) return obj;
  let next = null;
  for (const key of keys) {
    const v = obj[key];
    if (v == null || typeof v === 'string') continue;
    next ??= { ...obj };
    const text = storedText(v);
    if (text || blank !== null) next[key] = text || blank;
    else delete next[key];
  }
  return next ?? obj;
}

/** `sections` with each section's title and each entry's fields as text; the same array when all are. */
function withSectionsText(sections) {
  if (!Array.isArray(sections)) return sections;
  const next = sections.map((s) => {
    const section = withText(s, SECTION_TEXT);
    if (!isRecord(section) || !Array.isArray(section.items)) return section;
    const items = section.items.map((item) => withText(item, ENTRY_TEXT));
    return items.some((item, i) => item !== section.items[i]) ? { ...section, items } : section;
  });
  return next.some((s, i) => s !== sections[i]) ? next : sections;
}

/**
 * `r` with every field it keeps as text holding text (the lists above). A list of skills is
 * stored as the line every export already printed for it, so the documents print as they did.
 * Nothing else is touched. The same object when every field holds text already.
 */
export function withTextFields(r) {
  const next = {
    personal: withText(r.personal, PERSONAL_TEXT),
    sections: withSectionsText(r.sections),
    coverLetter: withText(withText(r.coverLetter, LETTER_TEXT), SIGNATURE_TEXT, null),
  };
  const changed = Object.entries(next).filter(([key, value]) => value !== r[key]);
  return changed.length ? { ...r, ...Object.fromEntries(changed) } : r;
}
