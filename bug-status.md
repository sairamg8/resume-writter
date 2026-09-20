# FlowCV Bug Tracker & Status Index

> Location: `/mnt/Storage/Projects/flowcv/bug-status.md`
> Total prompt tasks: 33 | **Closed: 32** | **Open: 1**

## Summary

- **Total Tracked Bugs in prompts:** 33
- **Closed / Fixed:** 32 (latest: `ONB-10-NB1` landed in `951e600`)
- **Remaining Open:** 1

### Remaining Open Bugs (Next in Queue)

- [ ] **`ONB-11`** (Storage / uploads / UI / minor) — A contact icon uploaded before c7b1aa6 (WebP/GIF) is silently replaced by the icon pack's shape (`prompts/15-ONB-11.md`)

---

## Complete Bug Tasks Index

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
| 15 | `ONB-11` | Storage / uploads / UI | minor | ⏳ **OPEN** | `—` | — | A contact icon uploaded before c7b1aa6 (WebP/GIF) is silently replaced by the icon pack's shape |
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
