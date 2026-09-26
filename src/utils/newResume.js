// Dashboard → New Resume → a look on /new (the owner's ask of 2026-09-24, R3-011): a new résumé starts
// from the account's own saved data — the name, contacts, photo and every section of one of its résumés —
// on the look picked, never from a sample person, and never from anyone else's data (the build carries
// none: the private-data scan forbids it). With no résumé yet there is nothing of the user's to start
// from, and the look's card makes a blank one, as New Resume always did. Relative imports only, so Node's
// test runner loads this file as it is.
import { BASE_COVER_LETTER } from './defaultDataContent.js';
import { withKeep } from './demoSeed.js';
import { LETTER_CONTENT, letterSources } from './letters.js';

/** The name a new résumé gets, as New Resume always named it. */
export const NEW_RESUME_NAME = 'Untitled Resume';

/**
 * The résumés a new one can start from — every record that is not a letter — the most recently edited
 * first: the first is the one /new starts from unless another is picked.
 */
export const resumeSources = letterSources;

/**
 * A new résumé `id`, made at `now`, from the résumé `source`: a copy of it — its Personal Info (with the
 * photo and what it hides), its sections and their options, its design — named `name`, with what its own
 * letter says to a reader (LETTER_CONTENT) empty, as a new letter starts, since that was written for one
 * application. A copy is not the account's original, whatever the source is (as duplicateResume's copy).
 * The caller puts it on the look picked (withLook).
 */
export function resumeFrom(source, { id, now, name = NEW_RESUME_NAME }) {
  const copy = JSON.parse(JSON.stringify(source));
  const own = copy.coverLetter && typeof copy.coverLetter === 'object' && !Array.isArray(copy.coverLetter) ? copy.coverLetter : {};
  const coverLetter = { ...BASE_COVER_LETTER, ...own };
  for (const key of LETTER_CONTENT) coverLetter[key] = BASE_COVER_LETTER[key];
  return withKeep({ ...copy, id, name, coverLetter }, false, now);
}
