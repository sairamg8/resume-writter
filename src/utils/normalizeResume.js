// Résumé data from before this build — this browser's saved store, the cloud account, an
// imported .json, the sample set — made current in ONE place. Every way a résumé comes in goes
// through normalizeResume(): the store's load, import and restore, and the cloud sync's merge.
// A photo stored larger than an upload keeps is the one change made later, as decoding an image
// takes a promise: the store makes it smaller once it has it (smallerPhotos.js).
import { inSidebarColumn, offersTemplate, withKnownTemplate } from '@/constants/templates';
import { withDesignNumbers } from '@/constants/designNumbers';
import { normalizeHexColor } from '@/utils/colors';
import { HEADER_READS, HEADER_SEEN, withHeaderColorsBack } from '@/templates/pdf/shared/headerColors';
import { DEFAULT_ITEM_GAP_PX, SECTION_SPACING_PX } from '@/templates/pdf/shared/pdfUnits';
import { withTextFields } from '@/utils/textFields';
import { withSkillNames } from '@/utils/skills';
import { withSectionShapes } from '@/utils/sectionShapes';

import { DATA_VERSION } from '@/utils/dataVersion';

/** The data version this build writes (dataVersion.js): which one-time migrations a résumé has had. */
export { DATA_VERSION };

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
 * default, Center. A Modern résumé storing anything but Top — Center, none, a value the PDF reads
 * as Center, and Bottom too (picked on Classic before a switch, or on Modern while the chips did
 * nothing: it printed Top all the same, V2W2b-1) — gets Top, so it prints as it always did. The
 * builds deployed from 0b83cb1 on printed the stored value and stamped version 8 on every résumé
 * they loaded: one edited since then (`updatedAt`) was edited while its preview printed that value,
 * and keeps it; so does every résumé a version-9 build saved.
 */
function withModernTextAtTop(r, from) {
  if (r.template !== 'modern' || r.settings?.photoTextAlign === 'top') return r;
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

/**
 * `r` with a name or job-title colour that reads below `below`:1 on its template's header back to
 * the template's own, where that reads better (withHeaderColorsBack). The same object when none is.
 */
function withReadableHeaderColors(r, below) {
  const settings = withHeaderColorsBack(r.settings, r.template, { below });
  return settings === r.settings ? r : { ...r, settings };
}

/**
 * v11 (NB-1): picking a template kept a Name or Job title colour picked for the old one's header,
 * on every build before this one: the Sidebar column's white name printed white on Classic's,
 * Minimal's or Executive's page, Classic's ink name vanished on the dark Sidebar column. The old
 * seed's "Dark" résumé is one too: builds from 4bc56fe on stored it as Classic, white name and
 * all, so R5-5 (below, as the id is rewritten) never reaches it. A colour that can hardly be seen
 * on its template's header (below 2:1, HEADER_SEEN) goes back to the template's own; a faint one
 * (2:1 up to 3:1) may be the user's pick there — a vivid orange title on Classic is 2.8:1 — and is
 * kept. The switch itself now does this (headerColorsOnSwitch).
 */
const withHeaderColorsSeen = (r) => withReadableHeaderColors(r, HEADER_SEEN);

/** One-time migrations: [the version that introduced it, (résumé, its own version) → résumé]. */
const MIGRATIONS = [
  [7, (r) => (r.coverLetter && !editedSince(r, SPACING_AND_RECIPIENT_LIVE) ? { ...r, coverLetter: withoutDefaultRecipientTitle(r.coverLetter) } : r)],
  [8, withItemGapsAsPrinted],
  [9, withModernTextAtTop],
  [10, withResumeHiddenOnLetter],
  [11, withHeaderColorsSeen],
];

/**
 * Which of this build's one-time migrations `r` has had: its own stamp, and the version a newer
 * build claimed (`dataVersionAhead`) once this build has caught up with that claim — so a migration
 * added later does not run a second time on data the build that wrote it already migrated. A stamp
 * that is not a number is no evidence and counts as none, as it always has; one above this build's
 * never reaches here (aheadOf takes it first).
 */
const versionOf = (r) => Math.max(
  Number.isFinite(r.dataVersion) ? r.dataVersion : 0,
  Number.isFinite(r.dataVersionAhead) && r.dataVersionAhead <= DATA_VERSION ? r.dataVersionAhead : 0,
);

/**
 * The version `r` claims that this build has not reached, or null. Either a newer build of the app
 * wrote it, or the number is bad — a hand-edited backup, a corrupt file — and this build cannot
 * tell the two apart, so it treats both the same (see normalizeResume).
 */
function aheadOf(r) {
  const claims = [r.dataVersion, r.dataVersionAhead].filter((v) => Number.isFinite(v) && v > DATA_VERSION);
  return claims.length ? Math.max(...claims) : null;
}

/** `r` stamped with this build's version, carrying `ahead` if there is still a claim to keep. */
function stamped(r, ahead) {
  const { dataVersionAhead: _absorbed, ...rest } = r;
  const out = { ...rest, dataVersion: DATA_VERSION };
  // `undefined` is not the same as absent here: Firestore refuses a write holding one (AUD-07).
  if (ahead != null) out.dataVersionAhead = ahead;
  return out;
}

/**
 * R5-5: an id the app does not offer — the old seed's 'dark', an imported file's — prints as
 * Classic (withKnownTemplate), as it did on every build: on the white page. A name or job-title
 * colour picked there for a dark header (the 'dark' seed's white name and #cbd5e1 title, which
 * printed invisible) goes back to the template's own, as the Design panel's ↺ sets it, where that
 * reads better; one that reads (3:1, HEADER_READS) is kept. It runs as the id is rewritten, so
 * once, whatever the data version.
 */
const withHeaderReadableOnClassic = (r) => withReadableHeaderColors(r, HEADER_READS);

const SETTINGS_COLOR_KEYS = [
  'accentColor',
  'textColor',
  'sidebarBg',
  'headerTextColor',
  'nameColor',
  'jobTitleColor',
  'sectionBorderColor',
];

/**
 * Normalizes colors in `resume.settings` to standard 6-digit hex '#rrggbb' (ONB-7).
 * Converts CSS named colors, rgb(), hsl() to hex; drops unreadable strings (e.g. 'banana',
 * '#12345') so defaults take over. Empty string resets (nameColor, jobTitleColor,
 * sectionBorderColor) are preserved. Preserves object identity when unchanged.
 */
export function withNormalizedColors(resume) {
  const settings = resume?.settings;
  if (!settings || typeof settings !== 'object') return resume;
  let next = null;
  for (const key of SETTINGS_COLOR_KEYS) {
    if (!(key in settings) || settings[key] == null) continue;
    const val = settings[key];
    if (typeof val === 'string' && val.trim() === '') {
      if (val !== '') {
        next ??= { ...settings };
        next[key] = '';
      }
      continue;
    }
    const hex = normalizeHexColor(val);
    if (hex) {
      if (hex !== val) {
        next ??= { ...settings };
        next[key] = hex;
      }
    } else {
      next ??= { ...settings };
      delete next[key];
    }
  }
  return next ? { ...resume, settings: next } : resume;
}

/**
 * A project's link where the app reads it. The JSON Resume import stored a project's URL as `link`,
 * which nothing prints or edits: the editor, the PDF, Word and Markdown read `url`, so every imported
 * project lost its link. A project with a `link` and no `url` gets it as its `url`. Whatever its data
 * version (an import stamps its own); the same object when there is none to move.
 */
function withProjectUrls(r) {
  if (!Array.isArray(r.sections)) return r;
  const moved = (item) => item && typeof item === 'object' && typeof item.link === 'string' && item.link.trim()
    && !(typeof item.url === 'string' && item.url.trim());
  let changed = false;
  const sections = r.sections.map((s) => {
    if (s?.type !== 'projects' || !Array.isArray(s.items) || !s.items.some(moved)) return s;
    changed = true;
    return { ...s, items: s.items.map((item) => (moved(item) ? (({ link, ...rest }) => ({ ...rest, url: link }))(item) : item)) };
  });
  return changed ? { ...r, sections } : r;
}

/**
 * `resume` made current: a template the app offers (withKnownTemplate), sections and entries that
 * are objects with unique ids, a title and Grids of 1–4 (withSectionShapes), the Design panel's
 * numbers stored as numbers in their controls' ranges (withDesignNumbers), valid colors
 * stored as '#rrggbb' (withNormalizedColors), text wherever it keeps text (withTextFields), a
 * project's link as its `url` (withProjectUrls) and its skill groups as skills (withSkillNames),
 * whatever its version; then each one-time migration newer than its own `dataVersion`, after
 * which it carries DATA_VERSION.
 * Never touches `updatedAt` — this is not an edit, so it neither wins a sync merge
 * nor triggers a cloud write by itself. The same object when nothing changes; a value that is not
 * an object comes back as it is.
 *
 * A version this build never issued (AUD-26) is a claim it cannot check: a newer build of the app
 * wrote it, or the number is bad — a hand-edited backup, a corrupt file. Trusting it froze the
 * résumé past every migration this app will ever ship, because a stamp of 999 stays above every
 * future DATA_VERSION and `from >= DATA_VERSION` stays true for good. Such a résumé is stamped with
 * what this build is at and none of this build's migrations run on it — a newer build has had them
 * all, and running them backwards on its data is the one thing `dataVersion` exists to prevent —
 * while the claim itself is kept in `dataVersionAhead` for the build that can check it: versionOf
 * reads it back as the version once DATA_VERSION has caught up (so that build does not migrate its
 * own data twice) and goes on ignoring one it never will.
 */
export function normalizeResume(resume) {
  if (!resume || typeof resume !== 'object') return resume;
  const known = withSectionShapes(withKnownTemplate(resume));
  const r = withSkillNames(withProjectUrls(withTextFields(withNormalizedColors(withDesignNumbers(offersTemplate(resume.template) ? known : withHeaderReadableOnClassic(known))))));
  const ahead = aheadOf(r);
  const from = versionOf(r);
  if (ahead != null) return r.dataVersion === DATA_VERSION && r.dataVersionAhead === ahead ? r : stamped(r, ahead);
  if (from >= DATA_VERSION) return 'dataVersionAhead' in r ? stamped(r, null) : r;
  return MIGRATIONS.reduce((out, [version, migrate]) => (from < version ? migrate(out, from) : out), stamped(r, null));
}
