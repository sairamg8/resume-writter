// "Share a public link" (R2-148): a signed-in account publishes a read-only copy of one résumé at
// `#/r/<shareId>`, served by this same app (PublicResume.jsx). The copy lives at `public/{shareId}`,
// the one place firestore.rules lets anyone read — by its id only, never as a list — and only its
// owner write; `users/{uid}/shares/{resumeId}` remembers which id a résumé has, under the account's
// own rule. The copy holds what the résumé's PDF prints and nothing else: a hidden field's value, a
// hidden section or entry, the cover letter and the résumé's name in the dashboard stay private.
// The Firestore calls take the SDK's functions (`fs`: doc, getDocFromServer, writeBatch), so the
// tests run this very code against tests/pdf/fake-firestore.mjs.
import { newId } from '@/utils/ids';

/** The largest copy the cloud takes (Firestore's 1 MiB a document), less room for the rest. */
export const MAX_PUBLIC_BYTES = 1_000_000;

/** An item or `personal` with the values of its hidden fields gone; the list stays, so it prints as before. */
function withoutHidden(fields) {
  const hidden = Array.isArray(fields?.hiddenFields) ? fields.hiddenFields : [];
  const out = { ...fields };
  for (const key of hidden) {
    if (key in out) out[key] = key === 'photo' ? null : '';
  }
  return out;
}

/**
 * What a published copy holds of `resume`: its template, its design and what its PDF prints — the
 * header's fields but those hidden with their eye, and each shown section with its shown entries.
 * Its id, its name in the dashboard, its cover letter and whatever the PDF leaves out are not in it.
 */
export function publicSnapshot(resume) {
  const sections = (Array.isArray(resume?.sections) ? resume.sections : [])
    .filter((s) => s && s.visible !== false)
    .map((s) => ({
      ...s,
      items: (Array.isArray(s.items) ? s.items : []).filter((item) => item && item.visible !== false).map(withoutHidden),
    }));
  const copy = {
    template: resume?.template || 'classic',
    settings: resume?.settings || {},
    personal: withoutHidden(resume?.personal || {}),
    sections,
  };
  if (resume?.dataVersion != null) copy.dataVersion = resume.dataVersion;
  // As the cloud sync stores a résumé: a field holding `undefined` is refused by the SDK.
  return JSON.parse(JSON.stringify(copy));
}

const CONTACTS = [['email', 'Email'], ['phone', 'Phone'], ['location', 'Location'], ['website', 'Website'], ['linkedin', 'LinkedIn'], ['github', 'GitHub']];
const plain = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * What anyone with the link sees, in words, from a published copy: each header field with its
 * value, the photo, the summary, and each section with its number of entries. The share panel
 * lists it, so the owner knows exactly what is public.
 */
export function publicSummary(copy) {
  const p = copy?.personal || {};
  const lines = [];
  if (p.name) lines.push(`Name: ${p.name}`);
  if (p.title) lines.push(`Job title: ${p.title}`);
  for (const [key, label] of CONTACTS) if (p[key]) lines.push(`${label}: ${p[key]}`);
  if (p.photo) lines.push('Your photo');
  if (plain(p.summary)) lines.push('Your summary');
  for (const s of copy?.sections || []) {
    const n = s.items?.length || 0;
    lines.push(`${s.title || s.type}: ${n} ${n === 1 ? 'entry' : 'entries'}`);
  }
  return lines;
}

/** The web address of a published résumé on this site: the app's own page at `#/r/<shareId>`. */
export function publicUrl(shareId, origin = globalThis.location?.origin || '') {
  return `${origin}/#/r/${encodeURIComponent(shareId)}`;
}

/** `v` as JSON with every object's keys in order: the server hands a map back with its keys sorted. */
const stable = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));

/** Does the published copy print what `resume` prints now? */
export const publishedIsCurrent = (copy, resume) => stable(copy) === stable(publicSnapshot(resume));

const TOO_LARGE = 'This résumé is too large to publish (over 1 MB, usually its photo). Use a smaller photo and try again.';

export function publicIo(fs, db) {
  const publicDoc = (shareId) => fs.doc(db, 'public', shareId);
  const shareDoc = (uid, resumeId) => fs.doc(db, 'users', uid, 'shares', resumeId);

  return {
    /** The résumé's public copy as it is now: `{ shareId, publishedAt, copy }`, or null when it has none. */
    async readShare(uid, resumeId) {
      const share = await fs.getDocFromServer(shareDoc(uid, resumeId));
      if (!share.exists()) return null;
      const { shareId } = share.data();
      const pub = await fs.getDocFromServer(publicDoc(shareId));
      if (!pub.exists()) return null;
      const { publishedAt, resume } = pub.data();
      return { shareId, publishedAt, copy: resume };
    },

    /**
     * Publishes `resume` (publicSnapshot) at its link — the one it has, else a new one that cannot
     * be guessed — or puts its current state there. Resolves when the server has it.
     */
    async publish(uid, resume, { shareId = newId(), now = Date.now() } = {}) {
      const copy = publicSnapshot(resume);
      if (new Blob([JSON.stringify(copy)]).size > MAX_PUBLIC_BYTES) throw new Error(TOO_LARGE);
      const batch = fs.writeBatch(db);
      batch.set(publicDoc(shareId), { owner: uid, resume: copy, publishedAt: now });
      batch.set(shareDoc(uid, resume.id), { shareId, publishedAt: now });
      await batch.commit();
      return { shareId, publishedAt: now, copy };
    },

    /** Takes the résumé's copy down: its link then finds nothing. */
    async unpublish(uid, resumeId, shareId) {
      const batch = fs.writeBatch(db);
      batch.delete(publicDoc(shareId));
      batch.delete(shareDoc(uid, resumeId));
      await batch.commit();
    },

    /** A published copy by its id, for anyone: the résumé to print, or null when there is none. */
    async readPublic(shareId) {
      const pub = await fs.getDocFromServer(publicDoc(shareId));
      return pub.exists() ? (pub.data().resume || null) : null;
    },
  };
}
