// The five fictional sample résumés (demo_classic …) that the owner's login got back after deleting
// everything, until 2026-09-15. Deleting one there flagged its cloud copy { deleted: true } instead
// of removing it, to bring back later; nothing brings the samples back now (demoSeed.js), so such
// a flag hid the copy for good, on every device, with no way to reach it or delete it. The first
// sync of a demo account settles each one (cloudSyncPlan.planInitialSync, V2OWNER-DATA-8): a
// copy nobody edited is removed for good, and an edited one — the owner's edits, which the flag
// was kept for — is an ordinary résumé again, back in the list to keep or delete.
// Plain data in and out, no imports, so Node's test runner loads this file as it is
// (tests/unit/old-samples.unit.mjs).

/** The samples' ids: the old builds flagged any deleted id starting so. */
export const isSampleId = (id) => typeof id === 'string' && id.startsWith('demo_');

/**
 * Every copy an old build could store for a sample nobody edited, as its sampleFingerprint: the
 * samples as they were until adbc5b9 (Between Items 12 px on Classic, 10 on the others) and from
 * then until 6483b72 took them out of the app (8 px) — the only two versions, each as a restore
 * wrote it and as any build's normalizeResume() left it (on a copy of the first version, which
 * 4bc56fe restored: Modern's text moved to the top, v9; the Sidebar column's own gaps, v8).
 * Fingerprints, not the samples: the app no longer carries them, and
 * tests/fixtures/sampleResumes.js follows today's defaults. tests/unit/old-samples.unit.mjs
 * recomputes every one from tests/fixtures/oldSampleCopies.json, which those builds' own code
 * produced.
 */
export const UNTOUCHED = {
  demo_classic: ['2f2eb31f2ce0be7e', '8ee975601ab2447d'],
  demo_modern: ['f12f0f455ce01489', '30c1d843cca3b292', '260530ea8d6fbba4', '2fa52359f9f39ffb'],
  demo_minimal: ['9b62ce9d2cb2a8e0', '29dcd9c9cf2755e6'],
  demo_sidebar: ['f0b8ab0566da821f', '4dbd6ff9d5db519c', 'aa3d0aa239c1acb2'],
  demo_executive: ['fffd363206edb7f7', 'c632813809eac327'],
};

/** What the sync or a restore stamps on a copy, not what anyone wrote in it. */
const STAMPS = new Set(['id', 'updatedAt', 'restoredAt', 'deleted', 'dataVersion']);

/** `value` as JSON with every object's keys sorted: Firestore hands a document's fields back in its own order. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : canonical(v))).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** 64 bits of `text` as 16 hex digits: cyrb53's two lanes (bryc, public domain), both kept. */
function hash64(text) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/** A résumé's content — every field but the STAMPS — as a fingerprint: equal content, equal print. */
export function sampleFingerprint(resume) {
  return hash64(canonical(Object.fromEntries(Object.entries(resume).filter(([k]) => !STAMPS.has(k)))));
}

/**
 * True when a sample's cloud copy holds nothing the owner wrote: a copy of a sample as an old build
 * stored it, or a flag with no résumé under it (a stub, only stamps: the flag of a copy the cloud
 * never had). Anything else — a word, a colour, the name — is an edit, and the copy is kept.
 */
export function isUntouchedSample(doc) {
  if (!doc || typeof doc !== 'object') return false;
  if (Object.keys(doc).every((k) => STAMPS.has(k))) return true;
  return (UNTOUCHED[doc.id] || []).includes(sampleFingerprint(doc));
}
