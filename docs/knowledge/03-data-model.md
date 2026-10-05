# 03 — Data Model

## App store document (`cpwtcv_v1`)

```json
{
  "resumes": [ /* Resume */ ],
  "activeId": "resume_…",
  "dataVersion": 13,
  "deletedIds": ["resume_…"],
  "deletedInfo": { "resume_…": { /* version, time, account, keep */ } },
  "syncedUid": "…",
  "cloudVersions": { "resume_…": 1727000000000 },  // the updatedAt the cloud holds (R2-004)
  "stashed": { "<uid>": { "resumes": [], "versions": {} } }  // kept aside at sign-out (R2-005)
}
```

First run: an empty store (no résumés; the dashboard shows "Create your first resume"). On load any
store version is kept: each résumé is migrated from its **own** `dataVersion` by `normalizeResume()`
(`src/utils/dataVersion.js` holds the current number; `src/utils/normalizeResume.js` the migrations).
A store or résumé that cannot be read is copied to a backup key before the next save replaces it
(`src/utils/storageBackup.js`).

### Resume object

```ts
type Resume = {
  id: string;                 // `resume_<uuid>` (newId, src/utils/ids.js)
  name: string;               // always text: normalizeResume stores a number's digits, and none /
                              // no text as 'Untitled Resume' ('Cover Letter' for a letter)
  updatedAt: number;          // ms epoch; conflict resolution key
  dataVersion: number;        // the one-time migrations it has had (DATA_VERSION when current)
  dataVersionAhead?: number;  // a newer build's version, kept until this build catches up (AUD-26)
  keep?: boolean;             // "Keep as my original" (demo accounts)
  template: 'classic' | 'modern' | 'minimal' | 'executive' | 'sidebar'
          | 'timeline' | 'banner' | 'academic' | 'compact'; // any other id prints as Classic
  settings: Settings;         // design system; starts from ATS_DEFAULTS. Always an object: normalizeResume
                              // stores none, null, text or a list as {} (the defaults), whatever the version
  personal: Personal;
  sections: Section[];
  coverLetter: CoverLetter;
  kind?: 'letter';            // a cover letter of its own, listed apart on the dashboard (R2-135)
};
```

### Personal (high level)

A new résumé starts from `BLANK_PERSONAL` in `defaultDataContent.js` (empty fields).  
Includes name, title, contact fields, optional photo, `hiddenFields[]`.  
Every template and export prints the contacts `contactItems` (`src/utils/contacts.js`) returns: a
website, LinkedIn or GitHub prints its Display label, else its address as a bare domain, and one whose
printed value is empty (typed as just `https://` or `www.`) is no contact at all. Its Link URL override
counts only when it names an address and is one the PDF follows (`linkOverride`): one of just `https://`,
`www.` or `https://www.`, or a `javascript:` address, is unset, so the value typed in the field is still
linked in every export, and an http(s) address with no host is no link anywhere (`safeHref`,
R5-HUNT12-LINK-URL-OVERRIDE-BARE-SCHEME, R5-HUNT12-LINK-URL-PLACEHOLDER-KILLS-CONTACT-LINK).  
A phone links (`contactHref`) to its first number only — cut at `/`, `,`, `;`, `|` or "or" once seven
digits are in — with an extension (`ext. 890`, `x890`, `#890`, also bracketed or after a comma: `(ext 12)`,
`, ext. 890`) as `;ext=890`; the text prints as typed; after a `+`, a
bracketed trunk `(0)` is left out of the link (`+44 (0) 20 7946 0958` → `tel:+442079460958`).  
A vanity number links to its keypad digits (ABC 2, DEF 3, GHI 4, JKL 5, MNO 6, PQRS 7, TUV 8, WXYZ 9):
`1-800-FLOWERS` → `tel:18003569377`, `1-800-GO-FEDEX`, `800 555 CALL`; one word of letters, no space in it,
after an unfinished number: fewer than seven digits, or seven that start with a 1 or a 0 (the long-distance
and trunk prefix: `1 800 555 CALL` → `tel:18005552255`, `1-800-555-HELP`, `0800 123 FLOWERS`,
`+1 800 356 WORD`), or a `+` country code, `800` and three digits (`+44 800 123 HELP`). After any other
number a word is a label (`555-0100 home`, `555 123 4567 home`, `030-123-456-home`, `(mobile)`, a leading
`Phone:`) and adds no digit (`UNFINISHED`, `dial`). A value that is not seven to fifteen digits (extension left out) links nowhere and prints as text (`Room 101`,
`On request`, two numbers typed with no separator); a value over 200 characters is none, which keeps the
patterns' time bounded (`telHref`, `dial`, R5-HUNT12-VANITY-PHONE-TEL-LINK-DROPS-LETTERS).  
The import reads such a phone back as typed, its extension too (`importText.js`: `PHONE_EXT`, `linkParts`).  
A photo (and the letter's `clPhoto`) is a data URL: an upload is stored at most 1024 px and 300 KB
(`readImageFile`); one an older build stored larger is replaced by that copy once the store has it,
`updatedAt` untouched (`src/utils/smallerPhotos.js`, ONB-10).

### Section

```ts
type Section = {
  id: string;
  type: SectionType;          // lower case: normalizeResume stores a file's 'Experience' or ' skills '
                              // as its id (sectionShapes.js); a type it does not know is a custom section's
  title: string;
  visible?: boolean;
  items: Item[];
  settings?: Record<string, unknown>; // per-section design overrides
};
```

Section factories: `SECTION_TYPE_DEFAULTS` in `defaultDataSectionTypes.js`.

A skill group's optional per-skill level is `item.skillLevels` (`{ "React": 4 }`, skill as typed → a whole
number 1–5, scale in `src/constants/skillLevels.js`; R2-147). `normalizeResume` → `withSkillLevels` drops
an invalid level, a skill the text no longer lists and an empty object; a group with none has no key.

### Settings (`ATS_DEFAULTS`)

Important keys (non-exhaustive):

- Typography: `font`, `fontSize`, `fontSizeBase`, deltas, `lineHeight`, `lineHeightValue`, `customFont`,
  `nameFont` / `headingFont` (a picker id or a custom font's name; normalizeResume drops one that is
  not text, `src/constants/designFonts.js`)
- Colors: `accentColor`, `textColor`, `sidebarBg`, `headerTextColor`, `nameColor`, `jobTitleColor`
- Layout: `margins` / `marginH` / `marginV`, `sectionGap`, `itemGap`, `headerAlign`, `headerLayout`
- The Sidebar's columns (read on its two columns only, R2-147-col): `sidebarSingleColumn` (Single ·
  ATS-safe, wins), `layoutColumns` (`two` | `mixed`), `layoutDetails` (`left` | `right` | `top`),
  `layoutSideWidth` (24–45, % of the paper) — not in `ATS_DEFAULTS`: unset prints Side column, Left, 38 %,
  the page every résumé printed before, so they came with no migration and no DATA_VERSION step.
  `normalizeResume` → `withLayoutSettings` drops a choice no build offered and clamps the width
  (`src/constants/layoutOptions.js`); Reset Design Settings drops all three
- Headings: `headingStyle`, `sectionTitleCase`, border widths/colors
- Contact: `contactStyle`, `contactCols`, `contactLayout`, `iconSize`
- Photo: `photoShape`, `photoSize`, `photoBorder`, …
- Header spacing, CSS px, **not** in `ATS_DEFAULTS` — unset, each prints its template's own
  (`TEMPLATES[t].headerGaps`, pt): `nameTitleGap`, `titleContactsGap`, `contactGapX`, `contactGapY`,
  `iconTextGap`, `photoTextGap`, `summaryGap`, `headerRuleGap`, `headerGapBelow`, `headerPadY`/`headerPadX`
  (Modern's banner; Banner's band under its text) — every template prints those it has, Personal Info →
  Header spacing offers each where it moves something; `contactsSideGap` is the cover letter's own (Right of
  Name: name side ↔ contacts, else 12 pt), offered in Cover Letter → Header Layout. Keys, ranges
  and resolution: `src/constants/headerSpacing.js`; `headerInlineGap` stays the Inline layout's.

Template switch applies the new template's `style` (`TEMPLATES[t].style`: heading style, title case;
Academic and Compact bring more) through `styleOnSwitch` in `src/utils/defaultData.js`, keeping what
the user picked themselves.

### Cover letter

`BASE_COVER_LETTER` shape: recipient, body, etc. (see `defaultDataContent.js`).  
Edited via `updateCoverLetter` / `CoverLetterPanel`.  
A record with `kind: 'letter'` is a letter of its own (`src/utils/letters.js`): Dashboard → New Cover
Letter makes one from a résumé (`store.createLetter`: its Personal Info, template, Design and sections
copied, the letter's recipient block and body empty), and the dashboard lists it under Cover Letters.
v13 marks an older build's 'Cover Letter' résumé with no entries as one.

## Job store document (`cpwtcv_jobs_v1`)

```json
{
  "jobs": [ /* Job */ ],
  "dataVersion": 2
}
```

### Job object

```ts
type Job = {
  id: string;                 // `job_<uuid>` (newId) or demo_*
  company: string;
  role: string;
  status: JobStatusId;
  url?: string;
  location?: string;
  salary?: string;
  contact?: string;
  resumeId?: string;          // link to a resume id
  notes?: string;
  appliedDate?: string;
  deadline?: string;
  todos: { id: string; text: string; done: boolean }[];
  statusHistory: { status: string; changedAt: number }[];
  createdAt: number;
  updatedAt: number;
  // optional, read by src/utils/jobFields.js: stage, followUpDate, source, workMode,
  // excitement (0–5), interviews[]
};
```

Every job, loaded or imported, goes through `readJob()` then `completeJob()`
(`src/utils/normalizeJob.js`).

Statuses: `saved | applied | phone_screen | interview | offer | on_hold | rejected | withdrawn`  
(defined in `src/constants/jobs.js`).

Migration v2: strips old `demo_*` jobs from prior seeds and re-injects current `DEMO_JOBS`.

## Firestore layout

```
users/{uid}/resumes/{resumeId}   → full Resume document
users/{uid}/meta/deletions       → { ids: string[] }
users/{uid}/jobs/{jobId}, users/{uid}/boards/{id}, users/{uid}/meta/{jobs|boards}
                                 → the Job Tracker's and Boards' lists (collectionSyncIo.js)
users/{uid}/shares/{resumeId}    → { shareId, publishedAt }: the link a résumé's public copy has
users/{uid}/meta/publicCopies    → { copies: { [shareId]: resumeId } }: every public copy the account has
public/{shareId}                 → { owner, resume, publishedAt }: a published copy, readable by its id
```

The public-link documents are `src/utils/publicLink.js`'s (05-state-auth-sync.md, Public links). The
index `meta/publicCopies` (R2-148) is written in the same transaction as each copy and taken out with it,
deleted when it lists none; it falls under the account's owner-only rule (`users/{uid}/{document=**}`),
so `firestore.rules` needed no change. The résumé sync reads only `resumes` and `meta/deletions`, and the
lists' sync only their own collection and `meta/<name>`, so neither ever takes it for their data.

## Import/export schemas

- **Resume JSON:** a CPWT-CV backup (`personal` and a `sections` array) or a JSON Resume file
  (`isJsonResume`, converted by `jsonResumeToCpwtResume`) — the Dashboard's import check.
- **Jobs JSON:** array or `{ jobs: [] }`.
