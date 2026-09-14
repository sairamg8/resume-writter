/**
 * Ids for résumés, sections, entries, jobs and to-dos. They used to be `${prefix}_${Date.now()}`,
 * so two made in the same millisecond — or on two devices that later sync — were the same id,
 * and editing or deleting one entry hit both.
 */

let fallbackSeq = 0;

/** The unique part: crypto.randomUUID (secure contexts), else crypto.getRandomValues (plain http). */
function uniquePart() {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  if (typeof c?.getRandomValues === 'function') {
    return Array.from(c.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  }
  // No Web Crypto at all: the per-session counter alone keeps ids from repeating here.
  fallbackSeq += 1;
  return `${Date.now().toString(36)}-${fallbackSeq.toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** A new unique id: `<prefix>_<unique>`, or just `<unique>` without a prefix. */
export function newId(prefix) {
  const unique = uniquePart();
  return prefix ? `${prefix}_${unique}` : unique;
}
