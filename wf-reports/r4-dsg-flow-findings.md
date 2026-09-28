# r4-dsg-flow — findings gathered before the session hit its usage limit (2026-09-26 13:55 UTC)

Branch `claude/wf-r4-dsg-flow`, base `94b4d9b`. Five read-only finder agents swept the flows and the printed
output; their findings are below, numbered by severity. **Status of every row: found, not yet confirmed by a
second agent, not fixed.** No code was changed. The cluster report (`r4-dsg-flow.json`) is not written yet, so
the coordinator must not treat this cluster as done. File:line refs are at `94b4d9b`.

To resume: confirm each row with a second agent, fix it with a fail-first test (CI `failfirst`), review it, and then
write `wf-reports/r4-dsg-flow.json` as R4-CLUSTERS.md says.

## R4-DUX — flow and UX (30)

### High
| ID | Finding | Where |
|---|---|---|
| R4-DUX-01 | Create issue: changing the Project wipes the typed summary, description, priority, dates and points (`key={board.id}` remounts the form) | board/CreateIssueDialog.jsx:38,78-84,150 |
| R4-DUX-02 | Job Tracker → Clear all jobs: no Undo, the confirm gives no count and doesn't say it's permanent, enabled with 0 jobs | pages/JobTracker.jsx:100-102,135; hooks/useJobStore.js:268-270 |
| R4-DUX-03 | ATS → "Switch to Classic" changes the template with no Undo toast (Design's switch has one) | AtsCheckerPanel.jsx:47-52,136-139; hooks/usePickCard.js:22-39 |
| R4-DUX-04 | Cover letter → Apply generated overwrites a written body and blanks the signature, with no confirm or undo | CoverLetterPanel.jsx:60-80; CoverLetterGeneratorModal.jsx:170-187 |

### Medium
| ID | Finding | Where |
|---|---|---|
| R4-DUX-05 | Create issue / Create project dialogs lose typed input on Escape or a backdrop click | board/CreateIssueDialog.jsx:145-148; ui/Dialog.jsx:63-83; board/CreateProjectDialog.jsx:86-87 |
| R4-DUX-06 | Job form: Cancel, ← and browser Back discard the typed input with no warning | pages/JobForm.jsx:52,89,94,215 |
| R4-DUX-07 | No sign-in, account or sign-out control in the Job Tracker or Boards (auth reaches only Dashboard and Editor) | AppRoutes.jsx:72-73; shell/TopBar.jsx:183-187; shell/CollectionSyncDot.jsx:52 |
| R4-DUX-08 | Board with filters: no "no matches" line with Group by None, and an issue created in a column that doesn't match the filter vanishes silently | pages/Board.jsx:104,194,248-271; board/BoardColumn.jsx:51 |
| R4-DUX-09 | STAR Optimizer loses every edit on a backdrop click | BulletOptimizerModal.jsx:22,67; hooks/useOverlayClose.js:10-24 |
| R4-DUX-10 | Share → Unpublish kills the public link in one click with no confirm; publishing again gives a new address | ShareLinkModal.jsx:65-69,130-134; utils/publicLink.js:194-218 |
| R4-DUX-11 | Dashboard import errors vanish after 4–8 s and cannot be dismissed (the long scanned-PDF advice is gone before it can be read) | pages/Dashboard.jsx:40-44,120,142-151,222-226 |
| R4-DUX-12 | ATS one-click fixes (standardize headings, job title first, Grids 1) rewrite sections with no feedback or undo | AtsCheckerPanel.jsx:103-149,278-293,450-457 |
| R4-DUX-13 | Auto-Generate on a Blank letter (no résumé content) silently writes generic filler | NewLetterModal.jsx:69-78; CoverLetterPanel.jsx:294-301; utils/coverLetterGenerator.js:111-125 |
| R4-DUX-14 | Design → a section's ↺ reset wipes a whole group (colours, typography…) with no confirm or undo | DesignPanelShared.jsx:322-329; DesignPanel.jsx:99-103,169-327 |
| R4-DUX-15 | 1-Page Fit's tooltip says margins and line heights, but it also lowers the font size (to 9 pt) and says nothing | DesignPanel.jsx:86-90,241-249; utils/pageFit.js:28-44 |
| R4-DUX-16 | Section ⋯ → Reset style discards every layout option with no confirm or undo (Delete beside it asks) | SectionEditor.jsx:284-295 |
| R4-DUX-17 | Editor → Import opens a new résumé under the same name with no notice; users think they restored the open one | ExportDropdown.jsx:116-121; hooks/useEditorExports.js:293-304; hooks/useResumeStore.js:283-288 |

### Low
| ID | Finding | Where |
|---|---|---|
| R4-DUX-18 | Job Board view says "Drop a job here" in every column when a search matches nothing or there are no jobs | job/KanbanView.jsx:144; pages/JobTracker.jsx:196,211 |
| R4-DUX-19 | Your work → ✓ Mark done: no toast, no Undo, the row disappears | pages/YourWork.jsx:42-44,63-66 |
| R4-DUX-20 | Job tasks and issue checklist items are deleted in one click with no undo | job/TodoItem.jsx:53-58; job/TasksTab.jsx:31; board/IssueChecklist.jsx:54-61 |
| R4-DUX-21 | Start sprint accepts an end date before the start date and a blank name ("   started" toast); Rename column with spaces does nothing silently | board/BacklogParts.jsx:130-136; utils/boardOps.js:236-239; pages/Backlog.jsx:207; board/BoardColumn.jsx:85-87 |
| R4-DUX-22 | STAR Optimizer → Use Template replaces the edited statement with no way back | BulletOptimizerModal.jsx:43-45,207-219 |
| R4-DUX-23 | Generated letter copy: "With over several years of hands-on experience" | utils/coverLetterGenerator.js:150 |
| R4-DUX-24 | Job description scanner shows nothing at all when the pasted text yields no keywords | AtsCheckerPanel.jsx:348-402; utils/atsChecker.js:425-428,1256-1258 |
| R4-DUX-25 | Spacing presets overwrite tuned spacing with no undo; a stale "Still 3 pages…" 1-Page Fit notice stays after changes | DesignPanel.jsx:59,78,250-279 |
| R4-DUX-26 | Ticking "Currently working here" erases the End Date, so unticking loses it | SectionEditorEntryItems.jsx:10,23,56 |
| R4-DUX-27 | Remove photo deletes the upload at once, no confirm or undo | PersonalInfoEditorPhoto.jsx:103-105 |
| R4-DUX-28 | Local exports (Markdown, ATS text, JSON) that fail say "Check your connection" | hooks/useEditorExports.js:214-290 |
| R4-DUX-29 | A non-image file picked as a custom contact icon silently does nothing | PersonalInfoEditor.jsx:209-221,271-277 |
| R4-DUX-30 | Save my design accepts a name already used, making identical cards | DesignPanelTemplate.jsx:43-47,83; hooks/useResumeDesignActions.js:27-36 |

Smaller notes from the finders (not numbered): Dashboard "New Cover" vs dialog "New Cover Letter"; the share
dialog's error says "try again" but has no Retry button; Career History doesn't name the résumé it shows, and the
Dashboard shows two Job Tracker links.

## R4-DOUT — the printed résumé and letter (18)

### High
| ID | Finding | Where |
|---|---|---|
| R4-DOUT-01 | Education with a GPA but no degree/field prints a stray leading " · " (main column and Timeline); Word is right. With no school, PDF and Word split the header differently | shared/PdfSectionsOne.jsx:276-281; shared/PdfTimelineSections.jsx:45-48; utils/wordExportBuilders.js:173-178 |

### Medium
| ID | Finding | Where |
|---|---|---|
| R4-DOUT-02 | Executive/Academic: PDF italicises the second field, location and issuer and joins Inline titles with ", "; Word is upright and uses " — " | ExecutiveTemplatePDF.jsx:133; AcademicTemplatePDF.jsx:138; shared/PdfItemHeader.jsx:182-203; utils/wordExportBuilders.js:102-120 |
| R4-DOUT-03 | Centred sections: Word puts the date on its own line; the PDF prints "Title · date" (tests/pdf/10-section-alignment-word pins the old Word layout) | utils/wordExportUtils.js:295-296; shared/PdfItemHeader.jsx:114-124,215-224 |
| R4-DOUT-04 | Projects in Word: technologies and link on the title line, a leading " · " when the name is empty; the PDF puts them on the next line | utils/wordExportBuilders.js:240-244; shared/PdfSectionsTwo.jsx:124-140 |
| R4-DOUT-05 | Awards in Word: " — Issuer" with a leading dash when the title is empty; the PDF stacks title, issuer and date | utils/wordExportBuilders.js:276-284; shared/PdfSectionsTwo.jsx:230-239 |
| R4-DOUT-06 | The PDF letterhead prints the photo; the Word letter never does | CoverLetterHeaderPDF.jsx:84,111; utils/wordExportCoverLetter.js:4,118-205 |
| R4-DOUT-07 | Timeline: a section heading can be orphaned at a page foot (fixed 5-line keep < first entry head + its keep) | shared/PdfTimelineSections.jsx:116; shared/PdfTimeline.jsx:128-183 |
| R4-DOUT-08 | Alignment Center: bullet markers stay at the left margin while the text is centred | shared/PdfRichText.jsx:94-121; shared/PdfSectionsOne.jsx:72 |
| R4-DOUT-09 | Letter's stacked job title is Regular where its résumé's is Medium (Banner, Timeline, Compact, designed); reversed on Academic Inline | CoverLetterHeaderPDF.jsx:126-129; BannerTemplatePDF.jsx:102; TimelineTemplatePDF.jsx:79; CompactTemplatePDF.jsx:75-88; shared/PdfDesigned.jsx:58-71 |

### Low
| ID | Finding | Where |
|---|---|---|
| R4-DOUT-10 | Broadsheet's heading rule is above the title in the PDF, below in Word; Gridline/Registry/Chronicle/Keystone marks drop to plain in Word | shared/sectionHeadingLook.js:35-88; utils/wordExportBuilders.js:38-49 |
| R4-DOUT-11 | Languages in Word print "English — Native" and ignore Level (dots/bar) | utils/wordExportBuilders.js:249-258; shared/PdfSectionsTwo.jsx:150-189 |
| R4-DOUT-12 | References in Word join title+company and email+phone ("  \|  "); the PDF uses one line each | utils/wordExportBuilders.js:295-311; shared/PdfSectionsThree.jsx:44-51 |
| R4-DOUT-13 | ATS plain text lists LinkedIn before Website and ignores display labels; every other export follows CONTACT_FIELDS order | utils/atsPlainText.js:163-170; utils/contacts.js:10-62 |
| R4-DOUT-14 | Languages: proficiency ends 12 pt short of the right margin, out of line with the dates | shared/PdfSectionsTwo.jsx:167-178 |
| R4-DOUT-15 | Interest chips are spaced twice as far apart as skill tags and grow with Spacing | shared/PdfSectionsThree.jsx:69; shared/PdfSectionsOne.jsx:210; shared/PdfSidebarColumn.jsx:340 |
| R4-DOUT-16 | Sidebar column Skills "Bars": double gap between groups and 4 pt extra under the section | shared/PdfSidebarSkills.jsx:38,47 |
| R4-DOUT-17 | A certification with no name prints a leading " — Issuer" (or "· ID: …") | shared/PdfSectionsTwo.jsx:53-55 |
| R4-DOUT-18 | Sidebar main-column card dot sits at a fixed 4 pt, so it rides high at larger entry sizes | shared/PdfSidebarSections.jsx:38; shared/PdfTimeline.jsx:53-57 |

Left out on purpose: Lectern's and Linen's letter rule is full-width where the résumé's mark is short, but
tests/pdf/33-cover-letter-header-rule.test.mjs pins it as intended.
