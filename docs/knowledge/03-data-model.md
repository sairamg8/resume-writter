# 03 — Data Model

## App store document (`cpwtcv_v1`)

```json
{
  "resumes": [ /* Resume */ ],
  "activeId": "resume_…",
  "dataVersion": 12,
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
  name: string;
  updatedAt: number;          // ms epoch; conflict resolution key
  dataVersion: number;        // the one-time migrations it has had (DATA_VERSION when current)
  dataVersionAhead?: number;  // a newer build's version, kept until this build catches up (AUD-26)
  keep?: boolean;             // "Keep as my original" (demo accounts)
  template: 'classic' | 'modern' | 'minimal' | 'executive' | 'sidebar'
          | 'timeline' | 'banner' | 'academic' | 'compact'; // any other id prints as Classic
  settings: Settings;         // design system; starts from ATS_DEFAULTS
  personal: Personal;
  sections: Section[];
  coverLetter: CoverLetter;
  kind?: 'letter';            // a cover letter of its own, listed apart on the dashboard (R2-135)
};
```

### Personal (high level)

A new résumé starts from `BLANK_PERSONAL` in `defaultDataContent.js` (empty fields).  
Includes name, title, contact fields, optional photo, `hiddenFields[]`.  
A photo (and the letter's `clPhoto`) is a data URL: an upload is stored at most 1024 px and 300 KB
(`readImageFile`); one an older build stored larger is replaced by that copy once the store has it,
`updatedAt` untouched (`src/utils/smallerPhotos.js`, ONB-10).

### Section

```ts
type Section = {
  id: string;
  type: SectionType;
  title: string;
  visible?: boolean;
  items: Item[];
  settings?: Record<string, unknown>; // per-section design overrides
};
```

Section factories: `SECTION_TYPE_DEFAULTS` in `defaultDataSectionTypes.js`.

### Settings (`ATS_DEFAULTS`)

Important keys (non-exhaustive):

- Typography: `font`, `fontSize`, `fontSizeBase`, deltas, `lineHeight`, `lineHeightValue`, `customFont`
- Colors: `accentColor`, `textColor`, `sidebarBg`, `headerTextColor`, `nameColor`, `jobTitleColor`
- Layout: `margins` / `marginH` / `marginV`, `sectionGap`, `itemGap`, `headerAlign`, `headerLayout`
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
```

No jobs collection.

## Import/export schemas

- **Resume JSON:** a CPWT-CV backup (`personal` and a `sections` array) or a JSON Resume file
  (`isJsonResume`, converted by `jsonResumeToCpwtResume`) — the Dashboard's import check.
- **Jobs JSON:** array or `{ jobs: [] }`.
