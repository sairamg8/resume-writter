// "Share a public link" (R2-148): a signed-in account publishes a read-only copy of one résumé at
// `#/r/<shareId>`, served by this same app (PublicResume.jsx). The copy lives at `public/{shareId}`,
// the one place firestore.rules lets anyone read — by its id only, never as a list — and only its
// owner write; `users/{uid}/shares/{resumeId}` remembers which id a résumé has, under the account's
// own rule. The copy holds what the résumé's PDF prints and nothing else: a hidden field's value, a
// hidden section or entry, the cover letter and the résumé's name in the dashboard stay private.
// The Firestore calls take the SDK's functions (`fs`: doc, getDocFromServer, writeBatch — and
// collection, getDocsFromServer for unpublishDeleted), so the tests run this very code against
// tests/pdf/fake-firestore.mjs.
import { newId } from '@/utils/ids';
import { CONTACT_FIELDS, CONTACT_KEYS } from '@/utils/contacts';

/** The largest copy the cloud takes (Firestore's 1 MiB a document), less room for the rest. */
export const MAX_PUBLIC_BYTES = 1_000_000;

/**
 * An item or `personal` with the values of its hidden fields gone; the list stays, so it prints as
 * before. A hidden contact takes its "Display label" and "Link URL" with it: the PDF prints neither
 * once the field is hidden, and a hidden LinkedIn's link is as private as the field.
 */
function withoutHidden(fields) {
  const hidden = Array.isArray(fields?.hiddenFields) ? fields.hiddenFields : [];
  const out = { ...fields };
  for (const key of hidden) {
    if (key in out) out[key] = key === 'photo' ? null : '';
    // A hidden end date hides "Present" too (endDateOf): whether the job is current is not printed.
    if (key === 'endDate' && 'current' in out) out.current = false;
    for (const extra of [`${key}Label`, `${key}Url`]) if (extra in out) out[extra] = '';
  }
  return out;
}

/** What the PDF reads of `personal` (contacts.js, the templates' headers): nothing else is copied. */
const PERSONAL_KEYS = ['name', 'title', 'summary', 'photo', 'hiddenFields', ...CONTACT_KEYS.flatMap((k) => [k, `${k}Label`, `${k}Url`])];
const printedPersonal = (personal) => Object.fromEntries(PERSONAL_KEYS.filter((k) => k in personal).map((k) => [k, personal[k]]));

/**
 * The design as the PDF reads it: the saved designs and the name of the look last applied
 * (useResumeDesignActions) print nothing, and an uploaded icon for a contact hidden with its eye
 * prints no more than the contact does, so none of them is copied — nor, saved or deleted, makes
 * the copy look out of date.
 */
function printedSettings(settings, hiddenFields) {
  const { myDesigns: _designs, templatePreset: _preset, ...out } = settings;
  const hidden = new Set(Array.isArray(hiddenFields) ? hiddenFields : []);
  const icons = settings.customContactIcons;
  if (icons && typeof icons === 'object' && hidden.size) {
    out.customContactIcons = Object.fromEntries(Object.entries(icons).filter(([key]) => !hidden.has(key)));
  }
  return out;
}

/** The section types whose Location a section's "Show location" hides (a custom section prints it always). */
const LOCATION_SWITCH = new Set(['experience', 'education', 'volunteering']);

/**
 * An entry as its section prints it: with the section's Show dates off no date prints, and with Show
 * location off (where it applies) no location, so neither is copied.
 */
function asSectionPrints(item, section) {
  const s = section.settings || {};
  const out = { ...item };
  if (s.showDates === false) {
    for (const key of ['startDate', 'endDate', 'date', 'expiry']) if (key in out) out[key] = '';
    if ('current' in out) out.current = false;
  }
  if (s.showLocation === false && LOCATION_SWITCH.has(section.type) && 'location' in out) out.location = '';
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
      items: (Array.isArray(s.items) ? s.items : []).filter((item) => item && item.visible !== false)
        .map((item) => asSectionPrints(withoutHidden(item), s)),
    }));
  const copy = {
    template: resume?.template || 'classic',
    settings: printedSettings(resume?.settings || {}, resume?.personal?.hiddenFields),
    personal: printedPersonal(withoutHidden(resume?.personal || {})),
    sections,
  };
  if (resume?.dataVersion != null) copy.dataVersion = resume.dataVersion;
  // As the cloud sync stores a résumé: a field holding `undefined` is refused by the SDK.
  return JSON.parse(JSON.stringify(copy));
}

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
  // The contact table's own names, in its order (src/utils/contacts.js: one table, R1-3 / R9-6).
  for (const { key, label } of CONTACT_FIELDS) if (p[key]) lines.push(`${label}: ${p[key]}`);
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

/** A copy without its data version: an app update that migrates the résumé changes nothing it prints. */
const printed = ({ dataVersion: _version, ...copy } = {}) => copy;

/** Does the published copy print what `resume` prints now? */
export const publishedIsCurrent = (copy, resume) => stable(printed(copy)) === stable(printed(publicSnapshot(resume)));

const TOO_LARGE = 'This résumé is too large to publish (over 1 MB, usually its photo). Use a smaller photo and try again.';
/** The error publish throws for a copy over MAX_PUBLIC_BYTES: its message is the whole story (no connection to check). */
export const TOO_LARGE_CODE = 'too-large';

export function publicIo(fs, db) {
  const publicDoc = (shareId) => fs.doc(db, 'public', shareId);
  const shareDoc = (uid, resumeId) => fs.doc(db, 'users', uid, 'shares', resumeId);

  /** The link the account has recorded for résumé `resumeId`, or null: read from the server, never a stale cache. */
  async function recordedId(uid, resumeId) {
    const share = await fs.getDocFromServer(shareDoc(uid, resumeId));
    return share.exists() ? share.data().shareId || null : null;
  }

  /** Adds to `batch` the deletion of each of these copies that is there (each id once). */
  async function deleteCopies(batch, shareIds) {
    for (const shareId of new Set(shareIds.filter(Boolean))) {
      // The rules refuse deleting a copy that is not there (no owner to check), so only one that is.
      if ((await fs.getDocFromServer(publicDoc(shareId))).exists()) batch.delete(publicDoc(shareId));
    }
  }

  /** Deletes résumé `resumeId`'s copies at `shareIds`, those that are there, and its record of the link. */
  async function takeDown(uid, resumeId, shareIds) {
    const batch = fs.writeBatch(db);
    await deleteCopies(batch, shareIds);
    batch.delete(shareDoc(uid, resumeId));
    await batch.commit();
  }

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
     * Publishes `resume` (publicSnapshot) at its link — the one the account has recorded, else
     * `shareId` (the link the panel shows), else a new one that cannot be guessed — or puts its
     * current state there. Resolves when the server has it. The record is read first: a panel
     * opened in another tab or on another device before this one published saw no link, and its
     * Publish made a second copy the record no longer named, public for good. A copy at the panel's
     * own `shareId`, when the record names another, is taken down in the same batch: a résumé has
     * one public copy at most.
     */
    async publish(uid, resume, { shareId, now = Date.now() } = {}) {
      const copy = publicSnapshot(resume);
      if (new Blob([JSON.stringify(copy)]).size > MAX_PUBLIC_BYTES) throw Object.assign(new Error(TOO_LARGE), { code: TOO_LARGE_CODE });
      const recorded = await recordedId(uid, resume.id);
      const id = recorded || shareId || newId();
      const batch = fs.writeBatch(db);
      if (shareId && shareId !== id) await deleteCopies(batch, [shareId]);
      batch.set(publicDoc(id), { owner: uid, resume: copy, publishedAt: now });
      batch.set(shareDoc(uid, resume.id), { shareId: id, publishedAt: now });
      await batch.commit();
      return { shareId: id, publishedAt: now, copy };
    },

    /**
     * Takes the résumé's copy down: its link then finds nothing. The copy at `shareId` (the link
     * the panel shows) and the one the account has recorded, when another tab moved it, both go;
     * one already gone (unpublished elsewhere) is skipped, as the rules refuse deleting it.
     */
    async unpublish(uid, resumeId, shareId) {
      await takeDown(uid, resumeId, [shareId, await recordedId(uid, resumeId)]);
    },

    /**
     * Takes down whatever copy the résumé has, when it has one: a résumé deleted from the dashboard
     * leaves no copy behind that its owner could no longer reach to unpublish. Resolves to whether
     * there was one.
     */
    async unpublishResume(uid, resumeId) {
      const share = await fs.getDocFromServer(shareDoc(uid, resumeId));
      if (!share.exists()) return false;
      await takeDown(uid, resumeId, [share.data().shareId]);
      return true;
    },

    /**
     * Takes down the copies of the résumés with these ids — the ones the account deleted, as its
     * deletion list says — when they have one, and resolves to those ids. A résumé deleted on
     * another device, or offline, or on a build that did not unpublish, kept its copy public with
     * no panel left anywhere to take it down: the cloud sync calls this once it knows the list
     * (cloudSyncEngine.js). One read of the account's links (`users/{uid}/shares`), then one batch
     * for each copy to take down.
     */
    async unpublishDeleted(uid, ids) {
      const gone = new Set(ids);
      if (!gone.size) return [];
      const shares = await fs.getDocsFromServer(fs.collection(db, 'users', uid, 'shares'));
      const stale = shares.docs.filter((d) => gone.has(d.id));
      for (const d of stale) await takeDown(uid, d.id, [d.data().shareId]);
      return stale.map((d) => d.id);
    },

    /** A published copy by its id, for anyone: the résumé to print, or null when there is none. */
    async readPublic(shareId) {
      const pub = await fs.getDocFromServer(publicDoc(shareId));
      return pub.exists() ? (pub.data().resume || null) : null;
    },
  };
}
