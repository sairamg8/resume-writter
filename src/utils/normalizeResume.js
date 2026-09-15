// Résumé data from before this build — this browser's saved store, the cloud account, an
// imported .json, the sample set — made current in ONE place. Every way a résumé comes in goes
// through normalizeResume(): the store's load, import and restore, and the cloud sync's merge.
import { inSidebarColumn, withKnownTemplate } from '@/constants/templates';
import { DEFAULT_ITEM_GAP_PX, SECTION_SPACING_PX } from '@/templates/pdf/shared/pdfUnits';

/**
 * The data version this build writes: the store's `dataVersion`, and each résumé's own once it
 * has been through normalizeResume(). A résumé's own version records which one-time migrations
 * it has had, so none runs twice on the same data — not after a sync, an import of an exported
 * file, or a stale tab of an older build writing the store back with its older store version.
 */
export const DATA_VERSION = 10;

const filled = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * When 4bc56fe was pushed (2026-09-14 21:39:53 IST): the first deployed build with ec843e2 (Design →
 * Spacing "Between Items" prints), FIDB-38 (the Sidebar's dark column takes the section presets),
 * bf0467f (the letter prints its recipient block) and e0e243c (the letter's hidden contacts are its
 * own list alone, FIDB-44). It stamped no data version on a résumé, and
 * nor did the builds before it, so `updatedAt` alone tells which of them a résumé was last edited
 * on (R7-2). The builds deployed from 0b83cb1 on ran v7 and v8 and stamped version 8.
 */
const SPACING_AND_RECIPIENT_LIVE = Date.UTC(2026, 8, 14, 16, 9, 53);

/** Was `r` edited at or after `live`? No `updatedAt` (or not a number) is not known to be: older. */
const editedSince = (r, live) => Number.isFinite(r.updatedAt) && r.updatedAt >= live;

/**
 * v7 (R1-0): builds before bf0467f gave every new letter the recipient title "Hiring Manager".
 * There was no input for it and the letter never printed it; it prints now. A letter that still
 * carries that default and none of the block's other lines (recipient name, company, subject,
 * date: the user never filled the block in) gets an empty title. One whose block the user did
 * fill in keeps it — they saw the title in its input and left it — and so does one edited since
 * 4bc56fe went live, which printed it and showed it in its input (R7-2).
 */
function withoutDefaultRecipientTitle(cl) {
  if (!cl || cl.recipientTitle !== 'Hiring Manager') return cl;
  if (['recipientName', 'company', 'subject', 'date'].some((key) => filled(cl[key]))) return cl;
  return { ...cl, recipientTitle: '' };
}

/** What builds before adbc5b9 stored on every new résumé, and printed where none was stored. */
const OLD_ITEM_GAP_PX = 12;

/** The section's Spacing preset as a multiple of Normal (getEffectiveSpacing); none reads as Normal. */
const presetScale = (ss) => (SECTION_SPACING_PX[ss.spacing] ?? SECTION_SPACING_PX.normal) / SECTION_SPACING_PX.normal;

/**
 * v8 (R2-1, R7-1, R7-2): Design → Spacing "Between Items" (`itemGap`, px) now prints in both
 * columns, times each section's Spacing preset, unless the section sets its own Item gap. What it
 * printed before depends on the build the résumé was last edited on, and that is what it prints:
 * - before 4bc56fe went live: the main column printed each section's preset as a fixed gap (Normal
 *   8 px; Between Items only in a section with no preset — FIDA-53), and the Sidebar's dark column
 *   printed Between Items itself in every section, whatever its preset (until FIDB-38). Whatever
 *   it stored, Between Items becomes 8 px, which times a preset is that preset's old gap; a
 *   section that would then move — the dark column's, or one with no preset — gets the gap it
 *   printed as its own Item gap.
 * - 4bc56fe, edited since it went live: what prints now. The value the user saw is kept; none
 *   stored printed 12 px, the default then.
 * - either: the dark column's Interests chips sat a fixed 2.5 pt apart (until 8a3d8fc); an Item
 *   gap of 8 px keeps them there.
 * A section's own Item gap is kept as the user typed it: it printed on every build (except
 * between the dark column's Interests chips, until 8a3d8fc). A résumé with no settings at all (an
 * imported file those builds stored as it came) printed their defaults, so it gets settings here.
 */
function withItemGapsAsPrinted(r) {
  if (r.settings != null && typeof r.settings !== 'object') return r;
  const settings = r.settings || {};
  const stored = settings.itemGap ?? OLD_ITEM_GAP_PX;
  const seen = editedSince(r, SPACING_AND_RECIPIENT_LIVE);
  const itemGap = seen ? stored : DEFAULT_ITEM_GAP_PX;
  /** The px the section printed between its entries, when Between Items alone would not print it now. */
  const printed = (section) => {
    const ss = section.settings || {};
    if (ss.itemGap != null) return undefined;
    const side = inSidebarColumn(r.template, section.type);
    if (side && section.type === 'interests') return DEFAULT_ITEM_GAP_PX; // the chips' 2.5 pt
    if (seen) return undefined;
    return side ? stored : (SECTION_SPACING_PX[ss.spacing] ?? stored);
  };
  const sections = !Array.isArray(r.sections) ? r.sections : r.sections.map((section) => {
    if (!section || typeof section !== 'object') return section;
    const px = printed(section);
    if (px === undefined || px === itemGap * presetScale(section.settings || {})) return section;
    return { ...section, settings: { ...section.settings, itemGap: px } };
  });
  return { ...r, settings: { ...settings, itemGap }, sections };
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

/**
 * v10 (R5-0): the Cover Letter panel's "Visible Contact Fields" wrote the letter's own
 * `hiddenFields` on every build, but until e0e243c the letter printed the résumé's hidden fields
 * as well as that list, which held only what the letter hid besides them. Since then it prints its
 * own list alone (FIDB-44), so a letter saved before with a list — even an empty one, hidden and
 * shown again — would print a contact the user hid on the résumé. It gets the résumé's hidden
 * fields added: it prints what it printed, and its panel shows those contacts hidden, for the user
 * to switch on. A letter with no list follows the résumé's already; one edited since 4bc56fe went
 * live printed its own list alone and showed it in its panel, and keeps it.
 */
function withResumeHiddenOnLetter(r) {
  const cl = r.coverLetter;
  if (!cl || !Array.isArray(cl.hiddenFields) || editedSince(r, SPACING_AND_RECIPIENT_LIVE)) return r;
  const resumeHidden = Array.isArray(r.personal?.hiddenFields) ? r.personal.hiddenFields : [];
  const added = [...new Set(resumeHidden)].filter((key) => !cl.hiddenFields.includes(key));
  if (!added.length) return r;
  return { ...r, coverLetter: { ...cl, hiddenFields: [...cl.hiddenFields, ...added] } };
}

/** One-time migrations: [the version that introduced it, (résumé, its own version) → résumé]. */
const MIGRATIONS = [
  [7, (r) => (r.coverLetter && !editedSince(r, SPACING_AND_RECIPIENT_LIVE) ? { ...r, coverLetter: withoutDefaultRecipientTitle(r.coverLetter) } : r)],
  [8, withItemGapsAsPrinted],
  [9, withModernTextAtTop],
  [10, withResumeHiddenOnLetter],
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
