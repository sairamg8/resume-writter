# FlowCV Bug Tracker & Status Index

> Location: `/mnt/Storage/Projects/flowcv/bug-status.md`
> Updated: 2026-09-22 21:38 · `origin/master` (deployed) = `2a7d728` · fixed but not pushed: `fd7ecca`, `4ee5ede`, `f829ce3`
> **Open: 26** | Fixed, not pushed: 4 | **Closed: 44**

## Summary

| List | Found | ✅ Fixed and pushed | ⏸ Fixed, local only | 🔴 Open |
|---|---|---|---|---|
| Bug audit, 2026-09-22 (`AUD-`) | 35 (34 + one follow-up) | 11 | 4 | **20** |
| ATS parsing defects (`ATS-`) | 6 | 0 | 0 | **6** |
| Prompt tasks, 2026-09-14 → 09-21 | 33 | 33 | 0 | 0 |
| **Total** | **74** | **44** | **4** | **26** |

- **Status:** ✅ fixed and pushed (on `origin/master`, so deployed) · ⏸ fixed and committed, not pushed · 🔴 open.
- **Severity (audit):** High = data loss, or a feature that does not work · Medium = a wrong result, no data loss ·
  Low = an edge case or cosmetic.
- **Verified:** Ran = reproduced by running the code · Code = confirmed by reading it · Known = also on the
  2026-09-22 gap list as A1–A6.
- Every open row was re-checked against the code at `4ee5ede` on 2026-09-22; its `file:line` is current there.

### Next in queue

1. **AUD-12** — hidden entries and photo leak into cover-letter generator and ATS score calculation.
2. AUD-13 → AUD-14 + AUD-15 → AUD-17 → AUD-19 → AUD-21 → AUD-22 → AUD-23 → AUD-24 → the Low rows,
   AUD-25 … AUD-34.
3. ATS-1 … ATS-6 — no order set yet; ATS-6 waits on a decision.

⏸ **Not pushed yet:** AUD-09 (`fd7ecca`), AUD-16 (`4ee5ede`), AUD-10 and AUD-11 (`f829ce3`) wait for the owner's go. The push gate runs every test,
a production build and a private-data scan; a push deploys.

**Each fix:** a test that fails before the fix → the fix → commit → set its row here to ⏸ with the commit and the
tests → ✅ once pushed, and update the counts above.

---

## Bug audit — 2026-09-22 (`AUD-`)

A read-only audit of `master` at `ba0874c`. The whole suite was green at the time (1496 pass, 0 fail, 2 todo), so no
existing test caught any of these; several unit tests asserted the same wrong data shape as the code.

| ID | Area | Severity | Status | Commit | Tests | Bug — where | Verified |
|---|---|---|---|---|---|---|---|
| AUD-01 | Storage · two tabs | High | ✅ Fixed | `9ec28e9` | tests/pdf/16-saved-data-two-tabs.test.mjs | Two open tabs erased each other's résumés: each change wrote the whole in-memory store and nothing listened for `storage` events, so a résumé made in tab 2 vanished when tab 1 saved (`src/hooks/useResumeStore.js`). The store now takes other tabs' saves without writing them back. | Code |
| AUD-01b | Editor · open résumé | High | ✅ Fixed | `2a7d728` | tests/pdf/52-editor-route.test.mjs | Found while fixing AUD-01: a résumé deleted in another tab left the editor showing the next résumé — and taking its edits — under the deleted one's address. `useOpenResume` now returns to the dashboard. | Ran |
| AUD-02 | JSON Resume · dates | High | ✅ Fixed | `5954e4d` | tests/unit/json-resume-roundtrip.unit.mjs | Export → import corrupted every date: export wrote the picker's "Jan 2024" instead of ISO `YYYY-MM`, and import kept 7 characters ("Jan 202", "Septemb"). | Ran |
| AUD-03 | JSON Resume · bullets | High | ✅ Fixed | `4c1875d` | tests/unit/json-resume-roundtrip.unit.mjs | A round trip doubled every bullet (exported in both `summary` and `highlights`) and leaked HTML and entities (`<p>`, `&amp;`). | Ran |
| AUD-04 | JSON Resume · projects | High | ✅ Fixed | `b64133f` | tests/pdf/16-saved-data-project-link.test.mjs, tests/unit/json-resume-roundtrip.unit.mjs | Project URLs were lost both ways: import stored `link` and export read `link`, while the editor, PDF, Word, Markdown and ATS text use `url`. Old `link` values are healed. | Code |
| AUD-05 | JSON Resume · import | High | ✅ Fixed | `05a602f` | tests/unit/json-resume-roundtrip.unit.mjs | Imported text was treated as HTML: `Owned the <ingest> pipeline` printed "Owned the pipeline", and `<b>cost</b>` turned bold. | Ran |
| AUD-06 | Starters · skills | High | ✅ Fixed | `bee22a2` | tests/pdf/16-saved-data-starter-skills.test.mjs, tests/unit/skill-names.unit.mjs, tests/unit/starter-templates.unit.mjs | A résumé made from a role starter printed an empty Skills section: starters stored `{ id, name }`, everything reads `{ category, skills }`. Stored `{ name }` groups are healed on load (`withSkillNames`). | Ran, Known A6 |
| AUD-07 | Sync · spacing override | High | ✅ Fixed | `e25f6ff` | tests/pdf/18-cloud-sync-undefined.test.mjs (the fake Firestore now throws on `undefined`, as the real one does) | Clearing a section's Spacing Override stored `undefined`; Firestore rejects it, so that résumé stopped syncing until a reload. | Ran (real Firebase SDK) |
| AUD-08 | Jobs · CSV export | High | ✅ Fixed | `888661a` | tests/unit/job-csv.unit.mjs (rewritten on the real job shape) | The CSV read fields no job has: Position, Applied Date and Source were always empty, and Status printed its id (`phone_screen`). It now writes Position, Status (its label), Stage, Applied Date and Contact; Source is gone. | Code |
| AUD-09 | Editor · STAR Optimizer | High | ⏸ Local only | `fd7ecca` | tests/playwright/bullet-optimizer.spec.mjs (needs a fresh `vite build`) | The optimizer never loaded the bullet being edited — it read the editor's ref on the first render, while it was still null — and Apply inserted unescaped HTML at the caret without replacing the bullet. It now opens on the caret's bullet and Apply replaces it as text. | Code |
| AUD-10 | ATS text export · hidden data | High | ⏸ Local only | `f829ce3` | tests/unit/ats-checker.unit.mjs | Prints what the user hid: hidden contacts (phone, location), hidden entries (`visible: false`) and per-entry hidden fields such as the company. `generateAtsPlainText`, `src/utils/atsChecker.js:376`. | Ran |
| AUD-11 | ATS text export · HTML | High | ⏸ Local only | `f829ce3` | tests/unit/ats-checker.unit.mjs | Prints raw HTML: the summary (`src/utils/atsChecker.js:402`) and every other section's description (`:487`, e.g. Awards) come out as `<p>Won <em>gold</em></p>` and `&amp;`. | Ran |
| AUD-12 | Hidden data · letter, ATS score | High | 🔴 Open | — | — | Hidden entries and the photo are still used: the cover-letter generator writes about a hidden job (`src/utils/coverLetterGenerator.js:49`); the ATS score counts hidden entries and takes 3 points off for a photo the user hid (`src/utils/atsChecker.js:1034`). | Ran |
| AUD-13 | Markdown export | High | 🔴 Open | — | — | Skills print empty — it reads `i.name` (`src/utils/markdownExport.js:126`); Languages print nothing and Volunteering loses its organisation — the generic branch reads `title`, `name`, `role`, `organization`, never `language` or `org` (`:134`); dates print raw, ignoring Date format; per-entry hidden fields still print. `tests/unit/markdown-export.unit.mjs` uses the same wrong `{ name }` shape. | Ran, Known A6 |
| AUD-14 | ATS checker · job match | Medium | 🔴 Open | — | — | Reports C++, C# and "5+" as missing: `\b…\b` never matches a keyword ending in `+` or `#` (`src/utils/atsChecker.js:324`), and "5+ years" yields the keyword "5+". | Ran |
| AUD-15 | ATS checker · add keyword | Medium | 🔴 Open | — | — | "+" (add a missing keyword) writes it lowercase — "aws", "sql" — because every keyword is lowercased (`src/utils/atsChecker.js:277`); with no Skills section it adds only an empty section, not the keyword (`src/components/AtsCheckerPanel.jsx:88`), while the button shows done. | Code |
| AUD-16 | Editor · STAR Optimizer | Medium | ⏸ Local only | `4ee5ede` | tests/unit/bullet-optimizer.unit.mjs | The weak-phrase check flickered: global regexes kept `lastIndex`, so the same text scored 1, 0, 1, 0 weak phrases on successive renders. | Ran |
| AUD-17 | Sidebar · Single ATS-safe | Medium | 🔴 Open | — | — | The Single · ATS-safe mode prints Classic's page, but the rest of the app still treats it as two columns: Header Customization hides Classic's controls and says they "don't apply" (`src/components/PersonalInfoEditorHeader.jsx:167`); Section Options hides Alignment, Grids and Title for the side-column sections (`inSidebarColumn`, `src/components/SectionEditorCustomizer.jsx:51`); Word prints them as side-column sections and never centres the header (`src/utils/wordExport.js:46`, `src/utils/wordExportHeader.js:52`); the ATS score still warns "Multi-column / Sidebar layout detected" (`src/utils/atsChecker.js:1011`). | Code |
| AUD-18 | Starters · data version | Medium | ✅ Fixed | `c3c7579` | tests/pdf/16-saved-data-starter-skills.test.mjs, tests/unit/starter-templates.unit.mjs | Starters and JSON Resume imports were stamped `dataVersion: 1`, so the next load re-ran old migrations and moved the Modern starter's photo text from centre to top. They now carry the current version (`src/utils/dataVersion.js`). | Ran |
| AUD-19 | Header spacing · Reset | Medium | 🔴 Open | — | — | Reset clears only the rows on screen (`onClear(rows…)`, `src/components/HeaderSpacingControls.jsx:78`): a gap set for a row now hidden (photo removed, Stack ↔ Inline) survives Reset, can't be cleared from the UI, and still prints in the cover letter. | Code |
| AUD-20 | Section options · spacing | Medium | ✅ Fixed | `f776e0f` | tests/pdf/51-section-spacing-override.test.mjs | The Spacing Override had no clamp: Before/After `-500` hid sections and Item gap `-30` overlapped entries. It is now held to 0–80 px in the PDF and the panel. | Ran, Known A1/A2 |
| AUD-21 | Section options · Reset style | Medium | 🔴 Open | — | — | Reset style and new sections store `titleStyle: 'stacked'`, which overrides Executive's inline default (`src/utils/defaultDataSectionTypes.js:4`, `src/components/SectionEditor.jsx:123`). | Ran, Known A3 |
| AUD-22 | Word export · fonts and sizes | Medium | 🔴 Open | — | — | Word ignores the Design font and sizes: the name is always 20 pt (`src/utils/wordExportHeader.js:58`), section titles 10 pt (`src/utils/wordExportUtils.js:71`), the font Calibri; entry dates are always the accent colour (`src/utils/wordExportUtils.js:157`) while the PDF prints them grey on Minimal, Executive and Sidebar. | Ran, Known A4 |
| AUD-23 | Exports · errors | Medium | 🔴 Open | — | — | Three exports fail silently: Markdown, ATS text and JSON Resume aren't wrapped in `runExport` (`src/hooks/useEditorExports.js:68`, `:74`, `:80`), and the editor's JSON Resume import converts outside any `try` (`src/components/ExportDropdown.jsx:118`), so an error shows nothing. | Code |
| AUD-24 | Jobs · edit | Medium | 🔴 Open | — | — | Editing an imported job whose company or role is `null` crashes the page: `form.company.trim()` (`src/pages/JobForm.jsx:46`), and there is no error boundary anywhere in `src`. | Code |
| AUD-25 | Photo · import | Low | 🔴 Open | — | — | An imported photo with an unknown shape or height (e.g. `'oval'`) is not clamped to the offered options (`getPdfPhotoStyle`, `src/templates/pdf/shared/pdfPhoto.js:57`). | Ran, Known A5 |
| AUD-26 | Storage · migrations | Low | 🔴 Open | — | — | A file stamped `dataVersion` 11 or higher (e.g. 999) skips every migration forever (`src/utils/normalizeResume.js:255`). | Code |
| AUD-27 | ATS checker · score | Low | 🔴 Open | — | — | The "Multi-column contact header" check reads `settings.contactCols`, which no control writes (the control is `contactLayout: '2grid'`), so it always passes (`src/utils/atsChecker.js:1019`). | Code |
| AUD-28 | Editor · month picker | Low | 🔴 Open | — | — | The years stop at the current year − 49 (`src/components/SectionEditorShared.jsx:27`): a 1975 date shows blank in the editor though the PDF prints it. | Code |
| AUD-29 | Career history panel | Low | 🔴 Open | — | — | A past job with no end date counts up to today (`src/components/CareerHistoryPanel.jsx:26`); "N companies" counts entries (`:78`); the total ignores gaps and hidden entries. | Code |
| AUD-30 | Exports · file name | Low | 🔴 Open | — | — | Export file names use the Google account's display name, not the résumé's name (`src/hooks/useEditorExports.js:10`). | Code |
| AUD-31 | Cover letter · generator | Low | 🔴 Open | — | — | The generator stores recipient "Hiring Manager" and title "Hiring Team", and both print in the recipient block (`src/utils/coverLetterGenerator.js:132`). | Code |
| AUD-32 | STAR Optimizer · verbs | Low | 🔴 Open | — | — | "Co-authored" can never count as an action verb: the hyphen is stripped before the lookup (`src/utils/bulletOptimizer.js:105`). | Code |
| AUD-33 | Mobile · touch | Low | 🔴 Open | — | — | Hover-only controls (`opacity-0 group-hover`) are invisible on phones: entry drag grips (`src/components/SectionEditorShared.jsx:141`) and the dashboard rename pencil (`src/components/ResumeCard.jsx:82`). The same pattern, found by search and not checked on a device: `src/components/job/Field.jsx:57`, `src/components/job/TodoItem.jsx:53`, `src/components/job/KanbanView.jsx:82`, `src/pages/Boards.jsx:80`. | Code |
| AUD-34 | Header spacing · defaults | Low | 🔴 Open | — | — | Every new résumé shows Name ↔ Title (Inline) as user-set: the defaults and the starters store `headerInlineGap: 8` (`src/utils/defaultData.js:26`, `src/utils/starterTemplates.js:25`), so the row reads as set (`set: stored != null`, `src/utils/headerSpacingRows.js:34`) and shows a dark value and ↺ on a résumé nobody touched. | Ran |

---

## ATS parsing defects (`ATS-`)

From the ATS parsing work of 2026-09-21 → 09-22: text extraction with Poppler (`pdftotext`), pdf.js and MuPDF, a
field-level scorer and a 300-case fuzz, plus OpenResume's parser run locally. No commercial ATS has been run yet.

| ID | Where | State | Defect | Found with |
|---|---|---|---|---|
| ATS-1 | Experience · every template | 🔴 Open | The work location is glued to the job title (Classic, Modern, Minimal) or to the company (Executive, Sidebar) with " · " (`src/templates/pdf/shared/PdfSections.jsx:130`, `:132`; `src/templates/pdf/shared/PdfSidebarSections.jsx:103`), so a parser reads the title as "Senior Frontend Engineer · Austin, TX". | OpenResume, at `46505ec` |
| ATS-2 | Experience · no bullet glyph | 🔴 Open | An entry described in paragraphs, with no bullet glyph, loses its date: OpenResume takes only the first 2 lines as the entry's header, so a date on the 3rd line becomes description text. | OpenResume |
| ATS-3 | Sidebar · two columns | 🔴 Open — no fix in react-pdf v4 | Poppler's reading order and `-layout` mode interleave the two columns (reading order 97.5 %, 3 entries interleaved; `-layout` 86.1 %, 11 facts lost). Only a tagged PDF would fix it, and react-pdf v4 can't write one; the Single · ATS-safe mode (`3818b7a`) avoids it. | Poppler — a `todo` test, `tests/pdf/40-ats-parse.test.mjs:152` |
| ATS-4 | PDF text · `pdftotext -raw` | 🔴 Open | Poppler's `-raw` mode splits words by position and ignores the space glyphs, so words on a line the layout squeezes read glued. Narrow-space fonts (Lato, Source Sans 3, Literata) were fixed in `0765939`; squeezed lines are still open. pdf.js, MuPDF and Poppler's other modes read them fine. | Poppler — a `todo` test, `tests/pdf/40-ats-parse.test.mjs:142` |
| ATS-5 | Experience · long role | 🔴 Open, latent | A long role that wraps beside a right-aligned date: Poppler's layout modes put the date inside the title (3 of 300 fuzz cases: Classic or Minimal, a large entry font, 28 mm margins). | ATS fuzz |
| ATS-6 | Word export · headings | 🔴 Open — needs a decision | Section headings are not Word Heading styles (Microsoft's guidance; not proven to matter to an ATS). | Microsoft's guidance |

---

## Prompt tasks, 2026-09-14 → 09-21 — all 33 closed (latest: `ONB-11` in `8a5d782`)

| # | Task ID | Category | Severity | Status | Commit | Tests | Description |
|---|---|---|---|---|---|---|---|
| 01 | `VF2-3.2-NB1-NB1-NB1` | Imported / stored values | major | ✅ Closed | `8786922` | tests/pdf/16-saved-data-typography.test.mjs | Typography sizes stored as non-numbers or numeric text print a broken PDF and junk in the Typography panel |
| 02 | `VF2-2.2-NB1` | Imported / stored values | minor (dev server only) | ✅ Closed | `fcf0f72` | tests/pdf/19-demo-seed-normalize.test.mjs | The owner's private original (dev server) is stamped updatedAt: now before it is migrated, so date-keyed migrations treat it as edited today |
| 03 | `VF2-2.3` | Imported / stored values | nit | ✅ Closed | `fcf0f72` | tests/pdf/16-saved-data.test.mjs | A Modern résumé stored with no settings object prints its photo text Center; production printed Top |
| 04 | `NB-3-NB1-NB2` | PDF / layout | minor | ✅ Closed | `119f668` | tests/pdf/33-sidebar-column-fit.test.mjs | Sidebar Skills (Inline or Bullet): a category word wider than the column prints a hyphen that isn't in the text, and its ':' drops to the next line |
| 05 | `NB-3-NB1-NB1` | PDF / layout | minor | ✅ Closed | `209e02c` | tests/pdf/33-sidebar-long-words.test.mjs, tests/pdf/33-sidebar-column-fit.test.mjs | Sidebar dark column: an ordinary long word (skill, category, language level, degree, certificate, credential ID) runs out of the column over the main column |
| 06 | `W2a-4.1-NB1` | PDF / layout | minor | ✅ Closed | `5210954` | tests/pdf/28-contact-grid.test.mjs | 2 Grid contacts: a value spilling into the column gap ends 1.7 pt from the next value and reads as one string |
| 07 | `W2a-4.1-NB2` | PDF / layout | minor | ✅ Closed | `cd43e58` | tests/pdf/27-cover-letter-grid-fit.test.mjs, tests/pdf/27-cover-letter-header-fit.test.mjs | Cover letter "Right of Name" + 2 Grid prints one column (stacked) whenever the column beside the name is under 225 pt |
| 08 | `ONB-13` | PDF / layout | minor | ✅ Closed | `8e47e01` | tests/unit/templates.unit.mjs, tests/pdf/10-section-headings.test.mjs | Design → Section Headings: Border thickness does nothing under heading styles 'Boxed' and 'Plain' |
| 09 | `FIDB-51-VF4-NB2` | PDF / layout | minor | ✅ Closed | `ab865d4` | tests/pdf/36-cover-letter-title-size.test.mjs | Design → Font sizes → Entry Header resizes the résumé header's job title but not the cover letter letterhead's |
| 10 | `ONB-7` | PDF / layout | minor | ✅ Closed | `236626d` | tests/unit/colors.unit.mjs, tests/pdf/37-colors-normalization.test.mjs | A Text colour react-pdf reads but the Word export's parseColor can't (CSS names, hsl()) |
| 11 | `ONB-9-NB1` | PDF / layout | minor (cosmetic) | ✅ Closed | `e9661ab` | tests/unit/page-size.unit.mjs | The preview's placeholder and 100% width assume A4 for a US Letter résumé |
| 12 | `ONB-6` | Storage / uploads / UI | minor | ✅ Closed | `cd19247` | tests/unit/storage-backup.unit.mjs | The not-saved alert says 'browser storage is full' for any failed write |
| 13 | `ONB-4-NB1` | Storage / uploads / UI | minor | ✅ Closed | `7b831b8` | tests/unit/storage-recovery-durability.unit.mjs, tests/unit/storage-backup.unit.mjs | A repair's notice is not kept when storage has room for the backup but not the notice: after a reload the copy is kept but named nowhere |
| 14 | `ONB-10-NB1` | Storage / uploads / UI | major | ✅ Closed | `951e600` | tests/unit/image-upload.unit.mjs, tests/pdf/18-cloud-sync-held.test.mjs | Upload limits allow a résumé over Firestore's 1 MiB document: two photos plus one large contact icon exceed it, and the résumé is held back from sync for good |
| 15 | `ONB-11` | Storage / uploads / UI | minor | ✅ Closed | `8a5d782` | tests/pdf/39-contact-icons-webp.test.mjs | A contact icon uploaded before c7b1aa6 (WebP/GIF) is silently replaced by the icon pack's shape |
| 16 | `ONB-8` | Storage / uploads / UI | minor | ✅ Closed | `ba46f48` | tests/unit/templates.unit.mjs | Design → Contact icons says 'You can still upload a custom image per field under Personal Info → Fields' where Personal Info offers no upload |
| 17 | `FIDB-51-VF7-NB1` | Storage / uploads / UI | minor | ✅ Closed | `61ffed7` | tests/unit/templates.unit.mjs | Header Customization's banner hint hard-codes 'Classic, Minimal and Executive' and builds the template label by hand instead of from TEMPLATES |
| 18 | `W1b-5.2-NB1` | Storage / uploads / UI | nit | ✅ Closed | `4a39390` | tests/unit/dead-code.unit.mjs | Dead code: src/templates/headingStyle.js (HeadingStyleContext) is imported nowhere |
| 19 | `W1b-5.3` | Weak tests / cleanups | minor | ✅ Closed | `60be62f` | tests/pdf/16-saved-data.test.mjs | 16-saved-data tests fail on the parent only because modules are missing |
| 20 | `W1b-6.2` | Weak tests / cleanups | minor | ✅ Closed | `264c47c` | tests/pdf/15-design-defaults.test.mjs | 15-design-defaults: 'an Executive résumé reset to its defaults…' never resets anything |
| 21 | `W2a-4.2` | Weak tests / cleanups | minor | ✅ Closed | `0ad4853` | tests/pdf/19-cover-letter-details.test.mjs | 19-cover-letter-details: the signature pagination test fails before its fix only by chance of layout |
| 22 | `W2a-4.3` | Weak tests / cleanups | nit | ✅ Closed | `8458893` | tests/pdf/19-cover-letter-details.test.mjs | 19-cover-letter-details: the long-title test's commit claims 85/109/124-character titles; the test uses 72/85/124 |
| 23 | `W3-5.2` | Weak tests / cleanups | nit | ✅ Closed | `8f429d1` | tests/pdf/08-header-and-lines.test.mjs | 08-header-and-lines: a test claimed to fail before its fix passes on the old code |
| 24 | `W3-5.3` | Weak tests / cleanups | nit | ✅ Closed | `6234d21` | tests/unit/contact-icon-paths.unit.mjs | Cypress 14-contacts 'previews five distinct packs' never checks distinctness or the Filled pack's shapes |
| 25 | `W3-6.2` | Weak tests / cleanups | nit | ✅ Closed | `664789a` | tests/pdf/14-ids.test.mjs | 14-ids: the 'no id from the clock' scan misses object keys ending in Id ({ sectionId: Date.now() }) |
| 26 | `VF2-4.1` | Weak tests / cleanups | nit | ✅ Closed | `79b7698` | tests/pdf/12-cover-letter.test.mjs | 12-cover-letter: imageBoxes reimplements the operator walk painted() already provides |
| 27 | `VF2-4.2` | Weak tests / cleanups | nit | ✅ Closed | `b9c1929` | tests/pdf/15-design-defaults.test.mjs | 15-design-defaults: a tautological TEMPLATES assertion, and three unshared PdfStandardHeader copies |
| 28 | `VF1S.4` | Weak tests / cleanups | nit | ✅ Closed | `b99d5d5` | tests/pdf/24-private-data.test.mjs | 24-private-data: 'the build never reads the private file' is proven only for fs.readFileSync |
| 29 | `X-R7-9` | Weak tests / cleanups | minor | ✅ Closed | `02c9632` | tests/pdf/17-sidebar-background.test.mjs | 17-sidebar-background: tests "failed before" only because of a top-level import |
| 30 | `NB-6` | Weak tests / cleanups | nit | ✅ Closed | `19502f2` | tests/unit/job-store-snapshot.unit.mjs, tests/pdf/34-job-store-ids.test.mjs, tests/pdf/34-recovery-notice-room.test.mjs | useJobStore's getSnapshot (snapshot()) writes to localStorage and adds a window listener during render |
| 31 | `NB-7` | Weak tests / cleanups | nit | ✅ Closed | `fb45902` | tests/unit/page-margins.unit.mjs, tests/pdf/17-sidebar-background.test.mjs | SidebarTemplatePDF repeats the page-margin defaults instead of pageMargins() |
| 32 | `NB-8` | Weak tests / cleanups | nit | ✅ Closed | `6783551` | tests/unit/templates.unit.mjs | tests/helpers.js buildTestState restates each template's heading style and title case instead of importing templateStyleDefaults |
| 33 | `FIDB-51-VF8` | Weak tests / cleanups | nit | ✅ Closed | `391d81d` | tests/pdf/10-section-colors.test.mjs, tests/unit/dead-code.unit.mjs | PdfPage.jsx re-exports DEFAULTS/resolveTemplateSettings for a single consumer |
