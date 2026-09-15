// Résumé data from before this build — this browser's saved store, the cloud account, an
// imported .json, the sample set — made current in ONE place. Every way a résumé comes in goes
// through normalizeResume(): the store's load, import and restore, and the cloud sync's merge.
import { withKnownTemplate } from '@/constants/templates';

/**
 * The data version this build writes: the store's `dataVersion`, and each résumé's own once it
 * has been through normalizeResume(). A résumé's own version records which one-time migrations
 * it has had, so none runs twice on the same data — not after a sync, an import of an exported
 * file, or a stale tab of an older build writing the store back with its older store version.
 */
export const DATA_VERSION = 9;

const filled = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * v7 (R1-0): builds before bf0467f gave every new letter the recipient title "Hiring Manager".
 * There was no input for it and the letter never printed it; it prints now. A letter that still
 * carries that default and none of the block's other lines (recipient name, company, subject,
 * date: the user never filled the block in) gets an empty title. One whose block the user did
 * fill in keeps it — they saw the title in its input and left it.
 */
function withoutDefaultRecipientTitle(cl) {
  if (!cl || cl.recipientTitle !== 'Hiring Manager') return cl;
  if (['recipientName', 'company', 'subject', 'date'].some((key) => filled(cl[key]))) return cl;
  return { ...cl, recipientTitle: '' };
}

/**
 * v8 (R2-1): Design → Spacing "Between Items" did nothing until FIDA-53 (ec843e2) — every
 * section printed its preset's fixed gap, Normal 8 px — and new résumés stored 12 px, the old
 * default. Since FIDA-53 that stored 12 px prints, 50 % wider than anything the résumé ever
 * showed. The untouched default becomes 8 px (the new default), so the résumé prints as it always
 * did; any other value is one the user chose, and the slider now honours it.
 */
function withoutOldItemGapDefault(settings) {
  if (!settings || settings.itemGap !== 12) return settings;
  return { ...settings, itemGap: 8 };
}

/** When 0b83cb1 was pushed (2026-09-15 08:02:51 IST): the first deployed build with dff28b7. */
const MODERN_TEXT_POSITION_LIVE = Date.UTC(2026, 8, 15, 2, 32, 51);

/**
 * v9 (R7-10): Modern's banner put the text beside the photo at the photo's top whatever Photo →
 * Text Position stored, until dff28b7 made it take the setting — and every résumé stores the
 * default, Center. A Modern résumé still at Center (or storing none, or a value the PDF reads as
 * Center) gets Top, so it prints as it always did. Bottom is a choice (and one Classic, Minimal and
 * Executive print), so it is kept. The builds deployed from 0b83cb1 on printed the stored Center
 * and stamped version 8 on every résumé they loaded: one edited since then (`updatedAt`) was
 * edited while its preview printed Center, and keeps it.
 */
function withModernTextAtTop(r, from) {
  const align = r.settings?.photoTextAlign;
  if (r.template !== 'modern' || !r.settings || align === 'top' || align === 'bottom') return r;
  if (from >= 8 && !(r.updatedAt < MODERN_TEXT_POSITION_LIVE)) return r;
  return { ...r, settings: { ...r.settings, photoTextAlign: 'top' } };
}

/** One-time migrations: [the version that introduced it, (résumé, its own version) → résumé]. */
const MIGRATIONS = [
  [7, (r) => (r.coverLetter ? { ...r, coverLetter: withoutDefaultRecipientTitle(r.coverLetter) } : r)],
  [8, (r) => (r.settings ? { ...r, settings: withoutOldItemGapDefault(r.settings) } : r)],
  [9, withModernTextAtTop],
];

const versionOf = (r) => (Number.isFinite(r.dataVersion) ? r.dataVersion : 0);

/**
 * `resume` made current: a template the app offers (withKnownTemplate), then each one-time
 * migration newer than its own `dataVersion`, after which it carries DATA_VERSION. Never touches
 * `updatedAt` — this is not an edit, so it neither wins a sync merge nor triggers a cloud write
 * by itself. The same object when nothing changes; a value that is not an object comes back as
 * it is.
 */
export function normalizeResume(resume) {
  if (!resume || typeof resume !== 'object') return resume;
  const r = withKnownTemplate(resume);
  const from = versionOf(r);
  if (from >= DATA_VERSION) return r;
  return MIGRATIONS.reduce((out, [version, migrate]) => (from < version ? migrate(out, from) : out), { ...r, dataVersion: DATA_VERSION });
}
