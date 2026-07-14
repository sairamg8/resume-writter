# Graph Report - .  (2026-06-29)

## Corpus Check
- 126 files · ~77,039 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 555 nodes · 882 edges · 38 communities (28 shown, 10 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 92 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_React-PDF Template Rendering|React-PDF Template Rendering]]
- [[_COMMUNITY_Personal Info Editor UI|Personal Info Editor UI]]
- [[_COMMUNITY_Package & Dependency Config|Package & Dependency Config]]
- [[_COMMUNITY_Auth & Career History UI|Auth & Career History UI]]
- [[_COMMUNITY_Design Panel & Theming|Design Panel & Theming]]
- [[_COMMUNITY_Word Export Pipeline|Word Export Pipeline]]
- [[_COMMUNITY_App Routing & Firebase Sync|App Routing & Firebase Sync]]
- [[_COMMUNITY_Playwright Test Suite|Playwright Test Suite]]
- [[_COMMUNITY_Canvas Template Renderers|Canvas Template Renderers]]
- [[_COMMUNITY_Sidebar Template Layout|Sidebar Template Layout]]
- [[_COMMUNITY_Project Docs & Assets|Project Docs & Assets]]
- [[_COMMUNITY_Job Tracker Kanban & List|Job Tracker Kanban & List]]
- [[_COMMUNITY_PDF Font & Page Utilities|PDF Font & Page Utilities]]
- [[_COMMUNITY_Job Pipeline Overview|Job Pipeline Overview]]
- [[_COMMUNITY_Job Notes & Tasks|Job Notes & Tasks]]
- [[_COMMUNITY_Cover Letter & Font Loading|Cover Letter & Font Loading]]
- [[_COMMUNITY_Resume Constants & Config|Resume Constants & Config]]
- [[_COMMUNITY_Minimal Template Helpers|Minimal Template Helpers]]
- [[_COMMUNITY_Career Timeline Display|Career Timeline Display]]
- [[_COMMUNITY_Interview Stage & Job Form|Interview Stage & Job Form]]
- [[_COMMUNITY_Resume Store & Section Actions|Resume Store & Section Actions]]
- [[_COMMUNITY_Modern Template Helpers|Modern Template Helpers]]
- [[_COMMUNITY_Linting Config (oxlint)|Linting Config (oxlint)]]
- [[_COMMUNITY_Job Tracker Pages & Hooks|Job Tracker Pages & Hooks]]
- [[_COMMUNITY_Classic Template Helpers|Classic Template Helpers]]
- [[_COMMUNITY_JS Path Alias Config|JS Path Alias Config]]
- [[_COMMUNITY_Cover Letter Template Helpers|Cover Letter Template Helpers]]
- [[_COMMUNITY_Canvas PDF Export|Canvas PDF Export]]
- [[_COMMUNITY_Job Modal Dialog|Job Modal Dialog]]
- [[_COMMUNITY_Bundle Splitting TODOs|Bundle Splitting TODOs]]
- [[_COMMUNITY_Social Icons Sprite|Social Icons Sprite]]

## God Nodes (most connected - your core abstractions)
1. `PdfRichText()` - 13 edges
2. `normal()` - 13 edges
3. `buildSection()` - 12 edges
4. `sectionHeading()` - 12 edges
5. `getPageStyle()` - 11 edges
6. `bold()` - 11 edges
7. `gotoEditor()` - 9 edges
8. `CPWT-CV Browser-Based Resume Builder` - 9 edges
9. `buildExperience()` - 8 edges
10. `buildEducation()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Hero Marketing Illustration — 3D Isometric Layered Cards in Purple` --conceptually_related_to--> `CPWT-CV Browser-Based Resume Builder`  [INFERRED]
  src/assets/hero.png → README.md
- `React Framework Logo (Cyan Orbital/Atomic Symbol)` --conceptually_related_to--> `CPWT-CV Browser-Based Resume Builder`  [INFERRED]
  src/assets/react.svg → README.md
- `Vite Build Tool Logo (Purple Lightning Bolt with Parentheses)` --conceptually_related_to--> `CPWT-CV Browser-Based Resume Builder`  [INFERRED]
  src/assets/vite.svg → README.md
- `CPWT-CV App Favicon (Purple Flow/Lightning Icon with Gradient)` --semantically_similar_to--> `Vite Build Tool Logo (Purple Lightning Bolt with Parentheses)`  [INFERRED] [semantically similar]
  public/favicon.svg → src/assets/vite.svg
- `React App HTML Entry Point (CPWT-CV)` --references--> `CPWT-CV Browser-Based Resume Builder`  [INFERRED]
  index.html → README.md

## Import Cycles
- 3-file cycle: `src/App.jsx -> src/hooks/useCloudSync.js -> src/utils/firebase.js -> src/App.jsx`
- 3-file cycle: `src/App.jsx -> src/hooks/useAuth.js -> src/utils/firebase.js -> src/App.jsx`

## Hyperedges (group relationships)
- **React + Vite Tech Stack Visual Identity** — src_assets_react_react_logo, src_assets_vite_vite_logo, readme_cpwt_cv [INFERRED 0.85]
- **PDF Export Feature Cluster (cover letter, dynamic imports, export capabilities)** — readme_pdf_word_export, todo_resolve_conflicts_cover_letter_pdf, todo_resolve_conflicts_dynamic_imports [INFERRED 0.85]
- **Bundle Optimization via Dynamic Imports and Chunk Splitting** — todo_resolve_conflicts_bundle_splitting, todo_resolve_conflicts_dynamic_imports, readme_cpwt_cv [INFERRED 0.85]

## Communities (38 total, 10 thin omitted)

### Community 0 - "React-PDF Template Rendering"
Cohesion: 0.06
Nodes (53): ClassicTemplatePDF(), getPhotoStyle(), CoverLetterTemplatePDF(), getPhotoStyle(), ExecutiveTemplatePDF(), getPhotoStyle(), getPhotoStyle(), hexAlpha() (+45 more)

### Community 1 - "Personal Info Editor UI"
Cohesion: 0.05
Nodes (6): FIELDS, ADD_LABEL, NEW_ITEM, CUR_YEAR, MONTHS, YEARS

### Community 2 - "Package & Dependency Config"
Cohesion: 0.06
Nodes (35): allowScripts, @firebase/util@1.15.1, protobufjs@7.6.4, dependencies, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, docx (+27 more)

### Community 3 - "Auth & Career History UI"
Cohesion: 0.07
Nodes (14): AVATAR_COLORS, CareerHistoryPanel(), durationLabel(), parseDate(), totalCareer(), CONTACT_FIELDS, MODES, collectLeaves() (+6 more)

### Community 4 - "Design Panel & Theming"
Cohesion: 0.06
Nodes (19): COLOR_KEYS, HEADING_KEYS, SPACING_KEYS, TEMPLATES, TYPOGRAPHY_KEYS, ACCENT_PRESETS, SIDEBAR_BG_PRESETS, TEXT_COLOR_PRESETS (+11 more)

### Community 5 - "Word Export Pipeline"
Cohesion: 0.30
Nodes (22): exportToWord(), buildAwards(), buildCertifications(), buildCustom(), buildEducation(), buildExperience(), buildInterests(), buildLanguages() (+14 more)

### Community 6 - "App Routing & Firebase Sync"
Cohesion: 0.10
Nodes (9): firebase, App(), AppRoutes(), useAuth(), useCloudSync(), app, auth, db (+1 more)

### Community 7 - "Playwright Test Suite"
Cohesion: 0.26
Nodes (10): TEMPLATES, ALL_SECTION_TYPES, BASE_SETTINGS, buildTestState(), getPreviewText(), gotoDashboard(), gotoEditor(), injectTestState() (+2 more)

### Community 8 - "Canvas Template Renderers"
Cohesion: 0.16
Nodes (8): ClassicTemplate(), ExecutiveTemplate(), ItemDesc(), ROW_GAP, HeadingStyleContext, ModernTemplate(), COLS, isHtmlEmpty()

### Community 10 - "Project Docs & Assets"
Cohesion: 0.15
Nodes (14): React App HTML Entry Point (CPWT-CV), Playwright Test Results Report, CPWT-CV App Favicon (Purple Flow/Lightning Icon with Gradient), CPWT-CV Browser-Based Resume Builder, Resume Design System (accent colors, fonts, spacing, per-section overrides), Firebase + Firestore Cloud Sync with Offline Support, HashRouter for Server-Config-Free Client Routing, Offline-First LocalStorage Data Architecture (+6 more)

### Community 12 - "PDF Font & Page Utilities"
Cohesion: 0.21
Nodes (10): FONT_MAP, registered, registerFromCDN(), registerPdfFont(), resolveTemplateSettings(), TEMPLATE_SECTION_DEFAULTS, exportCoverLetterPDFReact(), exportToPDFReact() (+2 more)

### Community 17 - "Job Pipeline Overview"
Cohesion: 0.17
Nodes (4): TERMINAL_READONLY, Pipeline, TERMINAL, TERMINAL

### Community 19 - "Cover Letter & Font Loading"
Cohesion: 0.24
Nodes (7): CoverLetterTemplate(), SidebarTemplate(), FONTS, getFontById(), loadCustomFonts(), removeCustomFont(), saveCustomFont()

### Community 20 - "Resume Constants & Config"
Cohesion: 0.20
Nodes (5): FONT_SIZE_MAP, LINE_HEIGHT_MAP, MARGIN_MAP, SECTION_GROUPS, TEMPLATE_MAP

### Community 21 - "Minimal Template Helpers"
Cohesion: 0.22
Nodes (3): MinimalTemplate(), ROW_GAP, SectionCaseContext

### Community 22 - "Career Timeline Display"
Cohesion: 0.38
Nodes (5): AVATAR_COLORS, CareerTimeline(), durationLabel(), parseDate(), totalCareerDuration()

### Community 24 - "Resume Store & Section Actions"
Cohesion: 0.33
Nodes (5): createSectionActions(), loadStore(), seedResumes(), TEMPLATE_DEFAULTS, TEMPLATE_STYLE_DEFAULTS

### Community 25 - "Modern Template Helpers"
Cohesion: 0.33
Nodes (3): contactHref(), ContactLink(), ROW_GAP

### Community 27 - "Linting Config (oxlint)"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 28 - "Job Tracker Pages & Hooks"
Cohesion: 0.47
Nodes (6): useJobStages(), useJobStore(), useAppStore(), JobDetail(), JobForm(), JobTracker()

### Community 30 - "JS Path Alias Config"
Cohesion: 0.40
Nodes (4): compilerOptions, baseUrl, paths, @/*

## Knowledge Gaps
- **114 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `baseUrl` (+109 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Package & Dependency Config` to `App Routing & Firebase Sync`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `firebase` connect `App Routing & Firebase Sync` to `Package & Dependency Config`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `normal()` (e.g. with `buildAwards()` and `buildCertifications()`) actually correct?**
  _`normal()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `sectionHeading()` (e.g. with `buildAwards()` and `buildCertifications()`) actually correct?**
  _`sectionHeading()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _116 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `React-PDF Template Rendering` be split into smaller, more focused modules?**
  _Cohesion score 0.06424050632911392 - nodes in this community are weakly interconnected._
- **Should `Personal Info Editor UI` be split into smaller, more focused modules?**
  _Cohesion score 0.049682875264270614 - nodes in this community are weakly interconnected._