# 03 — Data Model

## App store document (`cpwtcv_v1`)

```json
{
  "resumes": [ /* Resume */ ],
  "activeId": "resume_…",
  "dataVersion": 11,
  "deletedIds": ["resume_…"]
}
```

On load: if missing/invalid version → seed one resume per template default factory list.

### Resume object

```ts
type Resume = {
  id: string;                 // `resume_${timestamp}`
  name: string;
  updatedAt: number;          // ms epoch; conflict resolution key
  template: 'classic' | 'modern' | 'minimal' | 'sidebar' | 'executive' | 'dark' /* orphaned */;
  settings: Settings;         // design system; starts from ATS_DEFAULTS
  personal: Personal;
  sections: Section[];
  coverLetter: CoverLetter;
};
```

### Personal (high level)

Seeded from `SAIRAM_PERSONAL` in `defaultDataContent.js` (demo content for the author).  
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
  `iconTextGap`, `photoTextGap`, `summaryGap`, `headerRuleGap`, `headerGapBelow` (Classic, Minimal,
  Executive print them); `headerPadY`/`headerPadX` and `contactsSideGap` are reserved. Keys, ranges
  and resolution: `src/constants/headerSpacing.js`; `headerInlineGap` stays the Inline layout's.

Template switch merges `TEMPLATE_STYLE_DEFAULTS` for heading style + title case.

### Cover letter

`BASE_COVER_LETTER` shape: recipient, body, etc. (see `defaultDataContent.js`).  
Edited via `updateCoverLetter` / `CoverLetterPanel`.

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
  id: string;                 // `job_${timestamp}` or demo_*
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
};
```

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

- **Resume JSON:** must include `personal` and `sections` array (Dashboard import check).
- **Jobs JSON:** array or `{ jobs: [] }`.
