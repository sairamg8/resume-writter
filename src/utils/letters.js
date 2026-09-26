// A cover letter of its own (R2-135). It is a résumé record marked `kind: 'letter'` and listed with
// the letters on the dashboard, not with the résumés. It keeps a résumé's shape on purpose: the
// letterhead prints the record's own name, job title, contacts and photo in its template's look, and
// the generator writes from its sections, so the editor, the PDF, Word and text exports and the cloud
// sync take a letter as they always took one. Relative imports only, none of them back to the
// normaliser, so Node's test runner loads this file as it is.
import { BASE_COVER_LETTER } from './defaultDataContent.js';
import { withKeep } from './demoSeed.js';

export const LETTER_KIND = 'letter';

/** The name a new letter gets, as Dashboard → New Cover Letter always named it. */
export const LETTER_NAME = 'Cover Letter';

export const isLetter = (r) => r?.kind === LETTER_KIND;

/** Where the editor opens the record `id`: a letter on its letter's tab, as its card's Edit does. */
export const editorPath = (id, record) => (isLetter(record) ? `/resume/${id}?tab=coverletter` : `/resume/${id}`);

/**
 * The résumés a new letter can take its sender from — every record that is not a letter — the most
 * recently edited first (a record with no time last, in list order).
 */
export function letterSources(resumes) {
  const at = (r) => (Number.isFinite(r.updatedAt) ? r.updatedAt : -Infinity);
  return (Array.isArray(resumes) ? resumes : []).filter((r) => r && !isLetter(r)).sort((a, b) => at(b) - at(a));
}

/** What a letter says to its reader. A new one starts with these empty. */
export const LETTER_CONTENT = ['date', 'recipientName', 'recipientTitle', 'company', 'subject', 'body'];

/**
 * A new letter `id`, made at `now`, from the résumé `source`: a copy of it — its Personal Info (the
 * name, job title and contacts the letterhead prints, the photo and what it hides), its template and
 * Design (the letterhead's look), its sections (what Auto-Generate writes from) and its own letter's
 * letterhead and sign-off choices (the letter's photo and Show photo, contact style, layout and
 * fields, closing, signature) — with what the letter says to its reader (LETTER_CONTENT) empty. A
 * copy is not the account's original, whatever the source is (as duplicateResume's copy).
 */
export function letterFrom(source, { id, now }) {
  const copy = JSON.parse(JSON.stringify(source));
  const own = copy.coverLetter && typeof copy.coverLetter === 'object' && !Array.isArray(copy.coverLetter) ? copy.coverLetter : {};
  const coverLetter = { ...BASE_COVER_LETTER, ...own };
  for (const key of LETTER_CONTENT) coverLetter[key] = BASE_COVER_LETTER[key];
  return withKeep({ ...copy, id, name: LETTER_NAME, kind: LETTER_KIND, coverLetter }, false, now);
}
