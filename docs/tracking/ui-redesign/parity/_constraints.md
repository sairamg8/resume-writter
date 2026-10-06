# BUILD CONSTRAINTS scout (UI rebuild, UI only, every function stays)

Written 2026-10-06 by the constraints scout, read-only: no test, build, install or dev server was run. Everything is read from the worktree
`.claude/worktrees/ui-rebuild` (master `eb8e46c` + docs). "Measured" means read from a CI log or computed by a static import walk of `src/`
(a script in the scratchpad, not a build); "could not determine" is said where it applies. Accessibility is deferred and not covered.

## 0. Corrections to the README's BUILD CONSTRAINTS (read this first)

1. The README says "do not edit `src/components/ui/*` or shell files" because of the 0.2 kB margin. That is too blunt, and in one place wrong:
   - `src/components/shell/*` (TopBar, Sidebar, WorkspaceLayout, PageHeader ...) is NOT on the start-up path. It loads with the first
     workspace page: `AppRoutes.jsx:23` `WorkspaceRoute = page(() => import('@/components/shell/WorkspaceRoute'))`. Restyling the shell
     costs 0 bytes against the cap. (Same for `components/board/*`, `components/job/*`, `components/tracker/*`.)
   - Of `src/components/ui/*` only the files the Dashboard reaches are start-up (list in 1.2). The rest (Button, Menu, Popover, Select,
     Tabs, Toast, SearchInput, SegmentedControl, ...) is lazy. They are still shared by 10+ unit tests (`tests/unit/ui-kit.unit.mjs`,
     `ui-overlays`, `ui-shell`, `ui-helpers`), so add variants rather than change defaults.
   - The pages that ARE on the start-up path and are in the redesign's scope: Dashboard (`src/pages/Dashboard.jsx`, 20.2 kB source), Terms
     and Privacy (`pages/TermsPage.jsx` 7.2 kB, `PrivacyPage.jsx` 10 kB), AuthBar (11.3 kB), ResumeCard, ResumeThumbnail, CareerHistoryPanel,
     ImportMenu, NewLetterModal, RecoveryNotice, ErrorBoundary. A "Documents" page redesign lands here and is the real budget risk.
2. The shell the canvas draws ("Documents / Applications / Projects" top bar on every page) does not exist in code: there are THREE different
   chromes today (see 3.1): the Dashboard's own header, the workspace TopBar + Sidebar, and the editor's left-panel header. The rebuild
   unifies them; only the Dashboard half is on the start-up path.
3. The canvas's global search "Search everything" with a `/` hint is a capability that exists ONLY in the workspace shell
   (`TopBar.jsx` QuickSearch, `utils/workspaceSearch` over boards: issues and projects). Documents, New and the editor have no search. Drawing
   it on those pages is either decoration or a new function. PARITY-RULE says UI only: the lead must decide (a) the same bar everywhere but the
   search box only where it works, or (b) owner approves a new Documents search (needs data from the résumé store, new tests, bytes).

## 1. Start-up path budget

### 1.1 What is measured, and how
- Test: `tests/pdf/71-startup-chunks.test.mjs`. `before()` runs a real `vite build` in memory (`write:false`, production mode, `vite.config.js`).
  `startup` = every chunk with `isEntry` plus its static `imports`, transitively (the `closure()` helper, test lines 41-52). `loaded` = the JS files
  named by `<script src>` / `<link href>` in the built `index.html` (modulepreloads); each must be in `startup`.
- The cap (test lines 100-107): `total = sum of chunk.code.length` over the start-up chunks, `assert total < 1100 * 1024` and no single chunk over
  `500 * 1024`. `code.length` is the MINIFIED, UNCOMPRESSED JS in characters. Consequences for the rebuild:
  - CSS is not counted (only `type === 'chunk'` outputs). Tailwind classes, `index.css` tokens, `@theme` colours, `@font-face`, a Google-Fonts
    `<link>` in `index.html`: 0 bytes against the cap.
  - Class-name strings written in start-up JSX ARE counted (they are string literals in the chunk). A verbose Tailwind class list repeated in
    Dashboard JSX costs real bytes; a shared `const` string, or moving the look into one CSS class in `index.css` (`@apply` / a component class),
    costs less.
  - lucide icons are named imports (tree-shaken): each new icon on a start-up page is roughly 0.3-0.6 kB minified (could not measure; estimate).
- Lazy-library guard in the same file (lines 56-90): the start-up path and index.html must contain none of `@react-pdf|pdfkit|fontkit|yoga-layout|
  pdfjs-dist|docx|jszip|pizzip`; React bundled once. `tests/pdf/71-startup-public-link-lazy.test.mjs` and `122-startup-json-resume-export-lazy.test.mjs`
  use `tests/pdf/startup-modules.mjs` (a static import walk of `src/main.jsx`) to pin by NAME that `utils/publicLink.js`, `jsonResumeExport.js` and
  `entryPrints.js` are not on the start-up path, and (122) that `pages/Dashboard.jsx` and `utils/jsonResumeImport.js` ARE.
- Perf harness mirror: `tests/perf/budgets.mjs:34-37` (`startup.raw` max 1100 kB, `startup.gzip` max 450 kB, `startup.largest` 500 kB, `startup.lazy` 0).
  The `perf` CI job runs only when asked (it was `skipped` in run 37429442862). The 450 kB gzip budget is a second limit I could not read a current
  value for.
- Chunk grouping: `vite.config.js:46-66` `codeSplitting.groups`: `react` (priority 30), `react-pdf` (20), `docx` (10), `firestore` (11), `firebase` (10).
  A module imported both by start-up code and by a lazy chunk is hoisted into the start-up (entry) chunk. So a NEW shared module that the Dashboard
  and the editor both import is start-up weight, however "editor" it feels.

### 1.2 Current margin (evidence)
- HANDOFF.md:19 and :35: "71-startup-chunks still 0.2 kB to spare"; HANDOFF.md:32-34: master `3f579152` printed `start-up path 1100.0 kB of the
  1,100 kB cap: 0.0 kB to spare` (run 37401441776); after `hasDataUrlInTag` moved to `src/utils/dataUrlInTag.js` it was `1099.8 kB, 0.2 kB to
  spare` (run 37402197749).
- Newest green full gate I found: run 37429442862 (`ci.yml`, workflow_dispatch, head `ccb068ee`, all 15 build/lint/suite 6/6/Playwright 3/3/Cypress
  4/4 jobs success; attempt 1, 07:24Z-07:40Z). The 71 diagnostic line is inside one of the six `suite (n/6)` job logs; HANDOFF itself says "its exact
  margin was not read" (HANDOFF.md:5). I did NOT pull a 6x multi-thousand-line log. UNKNOWN: the exact figure at `ccb068ee` (the block-cap commit
  changed only editor code, so expect 0.2 kB still). Also note: the push gate on master `e4b56b72` (run 37426726646) concluded `failure` per the run
  list (docs-only commit; HANDOFF says to read it first on cold start). Not investigated.
- Treat the margin as ZERO. Any net growth of the start-up path fails the full gate. First action of batch 1: dispatch `tests` with
  `tests/pdf/71-startup-chunks.test.mjs` on one machine and read the `# start-up path ... to spare` diagnostic (printed via `t.diagnostic`).

### 1.3 What is on the start-up path (static walk of `src/main.jsx`, 142 source files, 887 kB of source; minified total is ~1,100 kB including node_modules)
Entry chain: `main.jsx` -> `App.jsx` -> `AppRoutes.jsx` -> pages `Dashboard`, `TermsPage`, `PrivacyPage`, `ErrorBoundary`, `utils/lazyPage`. `App.jsx:2-6`
pulls the whole store layer above the router: `hooks/useResumeStore.js` (29.9 kB), `useAuth`, `useCloudSync`, `useCollectionSync` (+ `useJobStore` 18.8 kB,
`boardStoreState`), `useDemoSeed`. Largest source files on it (kB): `utils/richText.js` 36.3, `useResumeStore` 29.9, `collectionSyncEngine` 28.8,
`normalizeResume` 23.2, `Dashboard` 20.2, `useJobStore` 18.8, `cloudSyncEngine` 17.7, `printableImage` 17.5, `templates/pdf/shared/letterhead.js` 17.4,
`cloudSyncPlan` 16.5, `constants/templates.js` 16.2, `normalizeJob` 16.0, `jsonResumeSections` 14.3, `jsonResumeImport` 14.2, `constants/templatePresets` 13.5,
`storageBackup` 12.8, `ResumeCard` 11.7, `starterTemplates` 11.4, `AuthBar` 11.3. node_modules on it: react + react-dom (chunk `react`), react-router-dom (the
data router `createHashRouter`), firebase app/auth/firestore (the `firebase` and `firestore` chunks), lucide-react icons imported by name.
`src/components/ui/*` on it, because the Dashboard's `NewLetterModal` imports `@/components/ui/Dialog` and `ResumeCard`/`EditorHeader` import
`@/components/ui/compose`: `Dialog.jsx` (8.3 kB), `useFocusTrap` (4.5), `compose` (4.4), `placement` (3.9), `Tooltip` (3.8), `useFloating` (3.4),
`IconButton` (2.8), `Kbd` (1.7), `useScrollLock` (1.4), `usePresence` (1.2), `Portal` (0.7), `focusRing` (0.5). Everything else in `ui/` is lazy.
Caveat: my regex walk ignores some `export ... from` forms and counts source, not minified bytes; use it for WHO is on the path, not for sizes.

Never import the `ui/index.js` barrel (`@/components/ui`) from start-up code: it re-exports 40 files; tree-shaking is not something this repo's
tests prove. Existing start-up code imports single files (`@/components/ui/Dialog`, `.../compose`); keep that.

### 1.4 What is lazy today
`AppRoutes.jsx:15-33` (`page()` = `lazy(() => loadPage(import(...)))`): Editor, NewResume, JobTracker, JobDetail, JobForm, Boards, Board, Backlog,
BoardSettings, YourWork, WorkspaceRoute (the workspace shell + CreateIssueDialog), ProjectSummary/Timeline/Calendar/List, PublicResume. The test
`71-startup-chunks` (lines 117-125) names these pages and asserts none is on the start-up path and at least 5 are split. Inside the editor chunk: DesignPanel*,
PersonalInfoEditor*, SectionEditor*, CoverLetterPanel, AtsCheckerPanel, `ui/Toast`, TemplateGallery, PdfPreview, ExportDropdown, and (dynamic `import()`)
`utils/pdfBuild` (PDF worker), pdf.js, docx. New editor UI belongs here at zero cost.

### 1.5 What a redesigned shell costs
Today's Dashboard header (`Dashboard.jsx:185-232`) already holds the CV mark, four buttons and the AuthBar. Costs of the canvas's bar on Documents/New/Terms/Privacy
(estimates, minified, NOT measured):
- Three nav links (Documents / Applications / Projects) with the sunken-pill active state, using `Link` (react-router is already start-up): ~0.8-1.5 kB.
- The global-search box with `/` hint as a static button/field: ~0.5-1 kB. The real QuickSearch (`TopBar.jsx` lines 59-190, `useHotkeys`, `workspaceSearch`, listbox) is
  ~4-5 kB source and lives in the lazy shell; pulling it into the Dashboard would exceed 0.2 kB by itself.
- Avatar menu with Keyboard shortcuts, Terms/Privacy, Sign out: AuthBar already owns the avatar and its Sign out menu (`AuthBar.jsx:131,86`); extra entries ~0.5 kB; the
  `ShortcutsDialog` (33 lines) is shared with TopBar and would become start-up if imported statically.
- Restyled Dashboard (cards, chips, empty states): class strings only, roughly net zero if rewritten rather than added to.
Expect +2 to +5 kB if done naively on the Dashboard, i.e. a red gate by 2-5 kB. NOT knowable without a build; the rebuild must read the 71 figure after every batch that touches a start-up file.

### 1.6 Ranked ways to stay under the cap (cap raise is the OWNER's call, not the lead's)
1. Zero-cost first: restyle with CSS only. Tokens in `src/index.css` `@theme` (see 2), new variants in lazy kit files, classes in JSX that is lazy (editor, workspace). Prefer
   one CSS class in `index.css` over long class strings repeated in Dashboard JSX.
2. Make the Documents page's non-first-paint parts lazy (offsets, each needs a test update with evidence, per CLAUDE.md "stale test updated, never weakened"):
   - `NewLetterModal` (3.4 kB) + its whole `Dialog` closure (~20 kB source: Dialog, useFocusTrap, usePresence, useScrollLock, Portal, placement-if-unshared) opened on a click: wrap in
     `lazy()` + Suspense in Dashboard. Check `ResumeCard`/`ImportMenu` do not import the same ui files (ResumeCard imports `compose` only).
   - `CareerHistoryPanel` (6.3 kB) + `utils/careerHistory` (5.3 kB): the canvas moves it to Applications > Insights anyway.
   - `utils/jsonResumeImport` + `jsonResumeSections` + `jsonResumeText` (~36 kB source): only needed when a JSON Resume file is picked on the Dashboard. Making it a dynamic
     import changes the contract of `tests/pdf/122-startup-json-resume-export-lazy.test.mjs` (it asserts the Dashboard and `jsonResumeImport.js` ARE on the path): update that one assertion
     to the new intended behaviour, with the evidence.
   - `utils/starterTemplates` (11.4 kB; imported by `hooks/useResumeStore.js`, so it is store weight) and `utils/printableImage` (17.5 kB, imported via `usePrintableImage`/pdf code): candidates if
     the import chain can be cut; not investigated (risk: the store).
   - Dashboard itself as a lazy page with the entry holding only a skeleton: biggest lever (Dashboard + ResumeCard 11.7 + ResumeThumbnail 9.6 + templates constants ~40 kB source) but worsens
     first paint (an extra request, partly mitigated by a modulepreload in `index.html`) and contradicts the comment at `AppRoutes.jsx:9-13` ("the dashboard and the legal pages, small and
     reached first, stay in the entry"). The owner should know before this is done.
3. Trim: remove dead exports and duplicated strings in start-up files (HANDOFF.md:34 shows the previous offset moved `hasDataUrlInTag` to its own file and shortened names in `careerHistory.js`
   "to give back start-up bytes"). Prior art exists; each trim needs the existing tests to stay green.
4. Cheap shell tricks: render the search as a plain `<button>` styled like the field that, on click or `/`, does `import('@/components/shell/QuickSearchLazy')`; nav links as one array mapped once.
5. Raise the cap (`71-startup-chunks.test.mjs:100` 1100 -> N, `tests/perf/budgets.mjs:34`): last resort, owner's decision, and it moves two files. Previous caps: 1,443 kB originally, trimmed to <=1,100 (R2-142).
Do NOT: put new shared helpers in `src/utils/` that both Dashboard and editor import (they are hoisted to start-up); edit `useResumeStore.js` (HANDOFF.md:32, "the store is on the start-up path
and every byte of it counts"; `useStableActions` was created in the editor's own code for this reason, `hooks/useStableActions.js:7-8`).

## 2. Styling system

### 2.1 How UI is styled today
- Tailwind v4 via `@tailwindcss/vite` (`vite.config.js:25`; `src/index.css:1` `@import "tailwindcss"`). ~2,259 `className` strings under `src/`. Only one CSS file in the app: `src/index.css` (152 lines).
  No CSS modules, no CSS-in-JS. 78 files use an inline `style={{}}` (dynamic widths, colours, the panel width, the photo).
- Two visual languages coexist:
  1. The legacy résumé UI (Dashboard, editor, panels; ~43 files in `src/components` + 6 pages): Tailwind default palette (`bg-blue-600`, `text-gray-*`, `rounded-lg`), page ground `bg-[#f5f3ef]` hard-coded
     (7 places), amber/red/blue pills ad hoc, 11-13 px text (`text-[11px]`, `text-xs`), system font.
  2. The "workspace UI kit" (src/components/ui + shell + board + job + tracker, 30+ files): tokens in `index.css:104-125` `@theme`: `ink #172b4d`, `ink-subtle #44546f`, `ink-subtlest #626f86`, `line #dcdfe4`,
     `line-subtle #ebecf0`, `sunken #f7f8f9`, `hovered #f1f2f4`, `brand #0c66e4` (+ hover `#0055cc`, pressed `#09326c`, subtle `#e9f2ff`), `loz-*` status lozenges; 4 px corner radius buttons
     (`ui/Button.jsx:21-30`), h-8 (32 px) controls, motion tokens `animate-ui-*` (`index.css:76-100`), `no-hover:` variant (`index.css:12`), a hand cursor on clickables (`index.css:23-47`), reduced-motion
     scoped to `[data-ui-motion]` (`index.css:135-144`). Focus ring `ui/focusRing.js`.
- Dark mode: none. The only `dark:` is in `ui/Kbd.jsx`; no `prefers-color-scheme` rule in app CSS. The canvas draws light only.
- Fonts: the UI is `system-ui, -apple-system, sans-serif` (`index.css:51`); `index.html` loads no web font. The BRIEF's UI font is Instrument Sans (Google Fonts, 400-700). PDF fonts are a separate system
  (`utils/fonts.js`, `fontsource.js`, fetched from a CDN for the preview/PDF; `FontFallbackNotice`). Adding a UI web font = a `<link>` in `index.html` (0 cap bytes, but a network dependency and a layout shift; offline
  use falls back to system-ui; app has offline behaviour to preserve).
- Tests that pin styling: I found none that pin colours (grep of `0c66e4|172b4d|--color-brand|f5f3ef` in tests/ and cypress/ returns nothing). Class-presence tests exist for specific behaviours
  (`tests/unit/touch-reveal.unit.mjs` `no-hover:` classes, `cursor-pointer.unit.mjs` every onClick, `103-r4-dph-31` bottom padding `max-md:pb-16`, `103-r4-dvis-12` truncation classes). Keep those classes where the behaviour stays.

### 2.2 BRIEF tokens vs today
| Token | BRIEF.md (canvas) | Today |
|---|---|---|
| ground | `#F5F6F8` | `#f0f2f5` body (`index.css:55`), `#f5f3ef` editor/dashboard |
| surface / sunken / stage | `#FFF` / `#EEF0F4` / `#E9ECF1` | white / `sunken #f7f8f9` / `#f5f3ef` |
| hairline / field border | `#E2E5EB` / `#D5DAE3` | `line #dcdfe4`, `line-subtle #ebecf0`; legacy `border-gray-200` (#e5e7eb) |
| ink / body / muted / faint | `#151922 / #2A303C / #4F586A / #6B7385` | `ink #172b4d / subtle #44546f / subtlest #626f86`; legacy `text-gray-400..800` (gray-400 fails the brief's "#6B7385 lightest") |
| brand | `#2B59FF` fills, `#1E45D6` text-on-soft, soft `#E8EEFF/#EEF3FF/#F3F6FF`, soft border `#C9D3F5` | `brand #0c66e4`, subtle `#e9f2ff`; legacy `blue-600 #2563eb` |
| good / warn / bad | `#0B7A55/#E1F5EC`, `#8F5200/#FFF0D6`, `#B3261E/#FDE7E5` | `loz-done #baf3db/#216e4e`; ad hoc `amber-50/800`, `red-50/700` |
| radii | cards 14-16, controls 8-10, chips full, inputs 34-38 (44 phone) | kit 4 px controls, 32 px tall; legacy `rounded-lg/xl/2xl` (8/12/16) |
| shadows | none on cards; popover/drawer `0 4px 8px rgba(20,30,50,.06), 0 18px 44px rgba(20,30,50,.20)` | `shadow-sm`, `shadow-2xl` on the preview pages; kit popovers use Tailwind shadows |
| type | 14 body; 11-13 meta; 15-16 titles; 20 section; 32 page title; weights 400-700; Instrument Sans | 11-14 px mixed, `text-xs` dominant; system-ui |
| spacing | flex/grid with gap; page gutters not stated | Tailwind scale; `max-w-7xl px-4 sm:px-6` on Dashboard |
The canvas states "literal hex, inline styles, no CSS variables" because it is a drawing; in React these become tokens.

### 2.3 Shared primitives, and what not to edit
- `src/components/ui/*` (kit): see 0.1. Files in the start-up closure (Dialog, useFocusTrap, compose, placement, Tooltip, useFloating, IconButton, Kbd, useScrollLock, usePresence, Portal, focusRing): do not add code
  to them; a class-string change of equal length is free. Lazy kit files: add variants/props, do not alter defaults (unit tests `ui-kit`, `ui-overlays`, `ui-helpers`, `ui-shell`, `ui-format` mount them).
- Shell (`src/components/shell/*`): lazy, editable, but `tests/unit/ui-shell.unit.mjs` states which paths are inside the shell (AppRoutes.jsx:84-87 comment); route structure changes need it updated.
- Do not touch `src/templates/pdf/*` or anything under the PDF/Word export chain: that is the résumé's printed look, not the app UI. `DesignPanelShared`, `SectionEditorShared` are UI-only.
- The résumé paper in the canvas (`Paper.dc.html`) is a drawing; the real preview is react-pdf through pdf.js (`PdfPreview.jsx`). The "page" look must come from the PDF canvas plus a CSS frame.

### 2.4 Introducing the new look without start-up bytes
1. Change tokens, not components: edit the `@theme` block in `index.css` (`--color-brand`, `--color-ink*`, `--color-line*`, `--color-sunken`, add `--font-sans: 'Instrument Sans', system-ui, ...`, `--radius-*`). Every kit and
   shell component restyles with 0 JS bytes. Risk: the legacy `blue-600`/`gray-*` pages do not read these tokens, so they stay old until their markup is rewritten; override palette entries in `@theme`
   (`--color-blue-600`, `--color-gray-*`) only if a single global flip is acceptable (it also recolours the PDF-panel swatches and anything else using those utilities: check before).
2. New class names live in lazy code: the editor chunk and workspace chunk. For the Dashboard, rewrite markup in place (same JSX size) and move repeated strings to `@layer components` classes in `index.css`.
3. Order hazard: do the tokens batch first, behind no flag; every later batch then uses the tokens. A token rename (e.g. `ink` hex change) cannot fail a test (no test pins colours), but contrast must be re-checked by the
   canvas tools (`tools/check.mjs`), though accessibility work is deferred.
4. The Google font link: put it in `index.html` with `display=swap` and `preconnect`; no JS. Decide with the owner (offline, privacy: the app contacts Google Fonts only for PDF fonts today).

## 3. Routing, state and render performance

### 3.1 Routes and chrome (`src/AppRoutes.jsx:81-130`)
Hash router (`main.jsx:11` `createHashRouter([{ path:'*', element:<App/> }])`; the data router exists for `useBlocker` in JobForm). `RouteFrame` (AppRoutes.jsx:57-82) wraps every route in
ErrorBoundary + Suspense and manages window scroll per history entry (R2-073, R5-HUNT6-DASH-BACK-LOSES-SCROLL): keep it untouched.
| Path | Page (lazy?) | Chrome today |
|---|---|---|
| `/` | Dashboard (start-up) | own header, own footer |
| `/new` | NewResume (lazy) | own |
| `/resume/:id` | Editor (lazy), `?tab=resume|design|coverletter|ats` | own: `fixed inset-0 z-20` full-window editor |
| layout route `WorkspaceRoute` (lazy): `/jobs`, `/jobs/new`, `/jobs/:id/edit`, `/jobs/:id`, `/boards`, `/work`, `/boards/:id`, `.../backlog|summary|timeline|calendar|list|settings` | JobTracker, JobForm, JobDetail, Boards, YourWork, Board, Backlog, ProjectSummary/Timeline/Calendar/List, BoardSettings (all lazy) | `WorkspaceLayout`: TopBar (h-14: brand, Your work, Projects menu, Job Tracker, Résumés, Create, search, sync dot, shortcuts, AuthBar) + Sidebar |
| `/terms`, `/privacy` | TermsPage, PrivacyPage (start-up) | own |
| `/r/:shareId` | PublicResume (lazy) | own, read-only |
| `*` | Navigate to `/` | |
The canvas's "Applications" = `/jobs` (JobTracker/JobDetail/JobForm); "Projects" = `/boards*` and `/work`; "Documents" = `/`. The current workspace nav calls these Job Tracker / Projects / Résumés / Your work: the
nav rename is UI-only but `tests/unit/ui-shell.unit.mjs` and cypress specs that click those labels need updating.

### 3.2 State above `<Routes>` (`App.jsx:9-17`)
`useAppStore()` (résumés + app state + all résumé actions, `hooks/useResumeStore.js`), `useAuth()`, `useCloudSync({user, appState, store})`, `useDemoSeed(...)`, `useCollectionSync(user, jobSync)`,
`useCollectionSync(user, boardSync)`; passed to `AppRoutes` as `store, auth, sync, seed`. Boards and jobs stores are read by the workspace pages (`useBoardStore`, `useJobStore`). Consequence (HANDOFF.md:17):
`App` re-renders on every store change, so `<Routes>` re-renders, so EVERY router-context consumer below gets a new context value every keystroke.

### 3.3 PERF-4 rules a rebuilt editor must keep (sources: HANDOFF.md:14-20,32-34; `tests/pdf/165`, `173`, `172`, `71-preview-*`)
1. A memoised editor part must not call a router hook (`useNavigate`, `useParams`, `useSearchParams`, `useLocation`) nor render a router `<Link>` (kit `Button` with `to`, `NavTabs` links, `TopLink`): it would re-render on every key
   whatever its props are. Pass a callback in (`goBack`/`onBack`, `Editor.jsx:70`, `EditorHeader.jsx:21`). A full-width editor top bar with nav links (the canvas shows Documents/Applications/Projects there? it draws the editor's own bar: brand mark,
   name, Resume|Cover letter switch, ATS chip, Download, Share, avatar) MUST be built from a `<button onClick>` with callbacks, not `<Link>`s, if memoised. `useEditorTab` (`hooks/useEditorTab.js`) uses `useSearchParams`/`useLocation`: it is called in
   `Editor` only, never inside a memo part.
2. `memo()` only helps over stable props. The three stabilisers: `useStableActions(source)` (`hooks/useStableActions.js`: stable identity per function key, calls the LATEST via a ref updated in `useLayoutEffect`), `useStableObject(source)`
   (`hooks/useStableObject.js`: object identity kept while plain values are `Object.is`-equal; function keys stable), `useSameList(array)` (stable identity while ids equal). Rebuilt parts take stable objects exactly as `Editor.jsx:66-69,92-96` and
   `EditorResumeTab.jsx:31-38` do. Stable handlers MUST call the latest closure (an export after a keystroke writes the typed text; `173` pins it).
3. Pass the résumé's id and a getter, not the résumé, to parts that only need it on an event: `PersonalInfoEditor` gets `resume={{id}}` (memoised `resumeId`) and `getResume()` (`EditorResumeTab.jsx:34-38`).
4. `EditorHeader`, `EditorAlerts`, `EditorModeBar` are `memo` and read props only (`EditorHeader.jsx:21,92,132`). `EditorHeader` takes `name` (string), not the résumé. `EditorAlerts` takes `exportError, persistError (the reason string), importNotice` + stable
   dismiss handlers. A keystroke renders none of them (`173`: 21+ tests).
5. dnd-kit: sensor options must be module constants (`KEYBOARD_SENSOR`, `EditorResumeTab.jsx:19`; `Board.jsx:98`, `Backlog.jsx:58` still inline: `172`): a new options object wakes every sortable. `SortableSection`, `SectionEntry`, `PersonalInfoEditor` stay `memo`; the store
   updaters share unedited sections/entries by reference.
6. `tests/pdf/165` records every fiber that renders in each commit after a keystroke, labels it by `item` prop / section key / `updatePersonal` prop, and asserts the list for a bullet / summary / email keystroke contains NOTHING but the typed field's own part. Rules from it: do
   not add a new component under the section tree that takes the whole `resume` or a fresh object/array/function prop; do not add a context whose value changes per key; keep component identity (`Card = ENTRY_CARD[type]`) stable.
7. `173` mounts the real `Editor(props)` page body under the real store with a fresh `auth`/`sync` object every render, imports `EditorHeader, EditorAlerts, EditorModeBar` from `/src/components/EditorHeader.jsx` by NAME and finds them in the returned element tree (`find(tree, EditorHeader)`).
   A rebuild that renames, moves or splits these three components breaks it; the new top bar and Resume|Cover letter switch must either KEEP these exports (same file, same props shape) or the test is rewritten to the same assertions on the new components (stale-test rule: update to intended behaviour with evidence, never weaken).
   `EditorModeBar` is 3 test files (173, 103-r4-dvis-12, 103-r4-dph-31); its tab strip disappears with decision 6, so those cases change; the "tab picker keeps identity / stale notice / phone" cases (173:737-811) still apply to whatever replaces it.
8. PdfPreview rules (`71-preview-hidden-builds`, `71-preview-typing-debounce`, `89-save-status`): the preview column is HIDDEN, never unmounted, in editor-only layout and on a phone's Edit tab, and builds nothing while hidden (`active` prop); it builds once on show. The preview keeps its debounced build on `input`
   changes: never pass it a new `render` function each render (`EditorPreviewPane.jsx:9-12` module-level `renderResumePreview`/`renderCoverLetterPreview`, "PdfPreview re-renders when `render` changes"); never change `key` except the existing `key="coverletter"`/`"resume"` swap.
9. Toast context value is memoised (`ui/Toast.jsx`, HANDOFF.md:17 "the toast context value is memoised"); keep it so, since DesignPanel/SortableSection/PersonalInfoEditorPhoto/CoverLetterPanel/AtsCheckerPanel all call `useToast()`. They need `ToastProvider` above them (`Editor.jsx:119`); a drawer must be rendered inside it.
10. Editor-only hooks and state live in the editor's own code, not the store (the store is start-up): keep new editor hooks under `src/hooks` only if they are imported by the editor alone (they are then in the lazy chunk; a hook imported by Dashboard too gets hoisted).
11. `Editor` still renders on every keystroke (it reads `store.activeResume`). That is expected. Keep new Editor-level state small and not derived per key; open/closed flags for docks, popovers and dialogs belong in `useState` in Editor (as `galleryOpen`, `shareOpen`, `templateOpen`, `personalOpen` do) or in a leaf.
12. Effects on the editor's mounted-ness: `useOpenResume` (leaves to `/` when the résumé is gone), the PDF warm-up effect (`Editor.jsx:106-114`, keyed on template and fonts), `useEditorExports(resume, activeTab, ...)` uses `activeTab` to switch the Export menu to the letter (`exportMenu.letterTab`); keep a value that says "the document is the letter".
13. The `?tab=` address (`useEditorTab.js`): the Dashboard's Cover letter links go to `?tab=coverletter`; an unknown tab is removed from the address; an import's notice rides in `location.state` and survives a tab pick (`state: location.state`, R5-HUNT2). Keep these links and this state behaviour. Recommended mapping for the tabless editor:
    keep `?tab=resume|coverletter` as the document switch and add a second param for the dock (`?dock=design|ats`), with the old `?tab=design|ats` accepted and rewritten (to resume + the dock) so bookmarks and Cypress specs keep working. This change goes in `hooks/useEditorTab.js` (lazy: only Editor imports it).

## 4. Panel contracts (today) and the optional group/view prop

All mounted today ONLY in `pages/Editor.jsx` (Résumé, Design, Cover letter and ATS are four tabs sharing one scroll box `EditorTabContent`). Props are exact copies of the code.

| Panel (file) | Mounted at | Props today | Notes that bind a rebuild |
|---|---|---|---|
| `DesignPanel` default export (`components/DesignPanel.jsx:57`, 414 lines + 8 `DesignPanel*.jsx` section files, ~1,260 lines) | `Editor.jsx:159-172` inside `px-4 py-4` | `resume, updateSetting, clearSettings, setTemplate, resetSettings, designs=[], applyDesign, saveDesign, deleteDesign, restoreDesign, onBrowseTemplates, templateOpen, onTemplateOpenChange`; each optional prop absent = its control is not offered | Sections in order (DesignPanel.jsx:204-409): Template (open state held by Editor via `templateOpen`), Colors, Contact icons, Typography, Spacing (1-Page Fit, Balanced, Spacious, Line height, page size, margins, gaps), Section Headings, Dates, Lists, Links, Page numbers, Reset Design Settings. `useToast()` (Undo notices; ids `design-section-reset`, `spacing-preset`). Unmounting the panel dismisses `design-section-reset` and STOPS a running 1-Page Fit (mounted ref, `DesignPanel.jsx:78,81`). 63 test files reference it. |
| `PersonalInfoEditor` default (`components/PersonalInfoEditor.jsx:263`, memo; `...Header.jsx`, `...Photo.jsx`) | `EditorResumeTab.jsx:60-72` inside the Personal Info card | `resume ({id}), getResume, personal, updatePersonal, toggleFieldVisibility, settings, updateSetting, clearSettings, template, coverLetter` | Memo + stable props (3.3). Holds Photo, Header Customization (own `open` states `photoOpen`), Fields (name, title + 6 contacts, each with show/hide, link label/URL, custom icon picker `HeaderIconPickerModal` rendered inside it), Professional Summary (`RichTextEditor`). Walker mounts it with spy actions and `personal/settings/template/coverLetter` only (no `resume`/`getResume`: they must stay optional). 29 test files. |
| `SectionCustomizer` named export (`components/SectionEditorCustomizer.jsx:46`) | Inline inside `SortableSection` when `customizerOpen` (`SectionEditor.jsx:54ff`) | `section, template, updateSectionSettings(sectionId,key,value), settings` | Pure render of Section Options (Alignment, Spacing/Rows, Grids, skills Style, ...). The canvas wants it as a popover. A popover wrapper is a NEW lazy component around the unchanged `SectionCustomizer`; the walker imports `SectionCustomizer` directly (`walker.mjs:239-243`) so it must remain exported and self-contained (no Popover/router/context requirement). 9 test files. |
| `SortableSection` (`SectionEditor.jsx:54`, memo) | `EditorResumeTab.jsx:93-113` | `section, template, settings, updateSection, updateSectionSettings, removeSection, addItem, updateItem, removeItem, reorderItems, toggleSectionVisibility, duplicateSection, duplicateItem, forceOpen, forceOpenKey, justAdded` | `useToast`; section menu (hide, duplicate, delete, reset style with Undo `section-style-reset-<id>`); entry cards via `ENTRY_CARD`; `confirm('Delete this entry?')`. 41 test files. |
| `EditorResumeTab` (`components/EditorResumeTab.jsx:27`) | `Editor.jsx:145-157` | `resume, store, personalOpen, setPersonalOpen, allExpanded, forceOpenKey, toggleAllSections, addSectionOpen, setAddSectionOpen` | Not memo. Collapse/Expand All, Personal Info accordion, DndContext of sections, Add Section grid (`SECTION_GROUPS`). 7 test files + `tests/pdf/resume-tab.mjs`. |
| `CoverLetterPanel` default (`CoverLetterPanel.jsx:19`, 367 lines) | `Editor.jsx:176-180` | `resume, coverLetter, personal, settings, template, updateCoverLetter, updateSetting, clearSettings` | Hosts `CoverLetterGeneratorModal` (own state `generatorOpen`) and the letter's field/position/photo controls; `useToast`, Undo id `letter-generated` dismissed on unmount/résumé change. ~16 test files. |
| `AtsCheckerPanel` default (`AtsCheckerPanel.jsx:75`, 594 lines + `AtsParserView.jsx` 210) | `Editor.jsx:182-186` | `resume, store` (the WHOLE store: it uses `usePickCard(resume, store)` for the Classic switch and the section fixes) | Wrapper keyed by résumé id (`key={id}`); pasted posting kept per résumé in `useSessionState('cpwtcv_ats_jd:'+id)` so it survives unmount; `analyzeAtsScore` memoised on `resume`; fixes with Undo ids `ats-fix-headings|title-order|grids`. Passing the whole `store` means it re-renders per key while mounted (fine: it is only mounted when open, and must stay so: the dock must UNMOUNT it when closed). ~17 test files. |

### 4.1 The optional group/view prop (proposal)
Pattern for each leaf panel: ONE new optional prop, default = today's behaviour (all groups), implemented as a pure filter in the panel's own return, no new state, no new hooks, no router, no context.
- `DesignPanel`: `groups` (array of section keys, default `undefined` = all). Keys: `'template' | 'colors' | 'icons' | 'typography' | 'spacing' | 'headings' | 'dates' | 'lists' | 'links' | 'pageNumbers' | 'reset'`. In the JSX
  each `<DesignSection>` is wrapped `show('colors') && ...` where `const show = (k) => !groups || groups.includes(k)`. Section files already exist (`DesignPanelColors|Typography|Headings|...`) so a "view" is a different list, not a copy. This gives the canvas's EditorTemplates
  (`['template']`), a "Style" drawer, and a "Layout" drawer. Hooks and effects (1-Page Fit, reset toasts, `useToast`, `fitting`, `confirmReset`) stay at the top, so mounting a subset still behaves identically and walker/`panels.mjs` (no prop = all) is untouched. Subtlety: effects that
  dismiss toasts on unmount (`DesignPanel.jsx:81`) would fire when a view swaps; avoid by keeping ONE DesignPanel instance mounted and changing only `groups`.
- `PersonalInfoEditor`: `view` (`'all' | 'fields' | 'photo' | 'header' | 'summary'`, default `'all'`), or `groups` same style. Photo, Header customization, Fields, Summary are already four sibling blocks in one return (lines 150-205). Keep the exports `default memo(...)`; `view` is a string, so it does not break memo.
  The `HeaderIconPickerModal` must stay mounted regardless of view (it is rendered at the end of the component, keyed by `pickerField`).
- `SectionCustomizer`: no prop needed; popover is a wrapper. If a "basic vs advanced" split is wanted (canvas's "Advanced"), add `advanced` boolean default `true` and gate the lower rows.
- `CoverLetterPanel`, `AtsCheckerPanel`: no group prop is needed for the canvas (letter content lives in the editor body as before; ATS is a dock). For the letter, if the generator or letterhead controls move, use `groups` the same way with default all.
- Walker/test safety: `tests/pdf/parity/panels.mjs` mounts `DesignPanel`, `PersonalInfoEditor`, `SectionCustomizer` with NO new props, walks every control it finds and the matrix (`registry*.mjs`, `00-registry`, `01-offered`, `40-structure`) pins settings keys. With the default all-groups path unchanged these pass untouched. The risk is not the prop but moving controls: do not rename a control's visible text, `title`,
  `aria-label` or DOM `data-*` row keys (walker signature = tag|type|name|data-attrs of 3 ancestors, `walker.mjs:51-61`); the emoji in DesignPanel's spacing-preset button labels (DesignPanel.jsx: 1-Page Fit, Balanced, Spacious) are in the signature too, and the canvas forbids emoji: changing them changes signatures
  and the registry expectations. Flag to the lead: either keep the label text or update the registry entries in the same batch with a fail-first.
- Cypress/Playwright specs driving the real Editor (BUILD CONSTRAINTS list: 04-design*, 05-cover-letter, 13, 14, 16, 17, 23, 25, 26, 27, 30; `parity-ui-controls`, `pdf-templates`, `pdf-typography-spacing`, `picker`, `pw-helpers.openDesignPanel`) click tabs; they need a new `openDesignPanel` helper that opens the dock.

## 5. Docked drawer (Design or ATS beside the page)

### 5.1 Today's layout (`Editor.jsx:119-243`)
`<ToastProvider>` > `<div class="fixed inset-0 z-20 flex overflow-hidden bg-[#f5f3ef]">` with three flex children: (1) the left editor panel (`flex flex-col`, in split mode inline `width/minWidth/maxWidth = panelWidth`, 240-640 px, default 360, remembered in
`localStorage['cpwtcv-panel-width']`, `hooks/usePanelResize.js:3-18`) containing `EditorHeader`, `EditorAlerts`, `EditorModeBar`, `EditorTabContent` (scroll box with the tab body); (2) the 4 px separator handle (`separatorProps`, only in split); (3) `EditorPreviewPane`
(`flex-1 min-w-0 min-h-0 h-full overflow-auto`, `hidden` when `layoutMode==='editor'`): toolbar (LayoutToggle, page size label, zoom - and + 50%-150%), `FontFallbackNotice`, `PdfPreview`, save status + Terms/Privacy. Modals: ShareLinkModal, TemplateGallery. Phone (<768 px, `useIsMobile`):
one pane at a time via `mobileTab`, plus the floating Edit|Preview pill (`Editor.jsx:216-240`).
`EditorHeader` lives INSIDE the left panel (so it is only as wide as the panel); the canvas draws a full-width editor bar. That is a structural change (see 6, Editor.jsx hazard).

### 5.2 How PdfPreview sizes itself (the constraint on any dock)
`PdfPreview.jsx:240-275,476-486`: `available = host.clientWidth` where `host = rootRef.current.parentElement` (the scrolling preview column), tracked by a `ResizeObserver`; `fitWidth = max(240, min(box.widthPx, available - 48))`; `cssWidth = round(fitWidth * zoom)`. When `cssWidth`
changes and the pane is `active`, a repaint effect re-paints the existing pages (`PdfPreview.jsx:399-412`; NOT a rebuild: the effect keyed `[input, render, retry, active]` is unaffected). So:
- Docking beside the page (a sibling of the preview pane in the root flex row) narrows the column by the dock's width and costs ONE repaint of the visible canvases per open/close, no PDF rebuild, no remount, zoom state kept (`previewZoom` lives in Editor, `Editor.jsx:43`).
- An OVERLAY dock (position absolute over the right of the preview) does not resize the host and costs nothing, but covers the page: not the canvas's "beside the page".
- Never animate the dock's WIDTH with a CSS transition: the ResizeObserver fires every frame and every frame schedules a repaint (`paint()` via pdf.js). Animate `transform: translateX` on the dock's inner content over a width that snaps, or no animation.
- Padding on the preview column does not help: `clientWidth` includes padding.
- Capacity: at a 1280 px window with the left panel at 360 and a 360 dock the page gets 1280-360-4-360 = 556 px (fitWidth 508, A4 794 px at 100%) so zoom 100% = 64% of true size; at 1024 px it is 300 px wide (fitWidth 252, near the 240 floor). The dock must hide the left panel or collapse
  to overlay under ~1100 px, or only one of left panel/dock fit (decide in the batch; the canvas Editor board is 1440).

### 5.3 Cleanest dock
- A new sibling in the root flex row AFTER `EditorPreviewPane`: `<EditorDock dock={dock} ...>` with `shrink-0` and a fixed width (e.g. 360), rendered only when `dock !== null`; "one dock at a time" is the single `dock` value (`null | 'design' | 'ats'`), stored in the address (`?dock=`, 3.3 #13) via `useEditorTab`'s
  successor (read in `Editor` only; the dock gets plain props).
- Mount the panel ONLY while its dock is open (as today: Design and ATS mount only when their tab is open; `AtsCheckerPanel` documents it; its session state survives). Keep ONE `DesignPanel` instance across `groups` changes (4.1), else its Undo toasts are dismissed and a running 1-Page Fit stops.
- Do not pass dock state into `EditorPreviewPane` or `PdfPreview` props (they are not memoised but their `input`, `render`, `zoom`, `active` props stay equal, so nothing rebuilds). The only effect of the dock is the DOM width.
- The dock is NOT a router consumer and needs no memo; but the panels inside take `useStableActions`-style props like `EditorResumeTab` does if they are memoised. DesignPanel and AtsCheckerPanel are not memo and re-render per key while open (ATS: `analyzeAtsScore` on every `resume` change is already
  memoised on the object; typing re-runs it: existing behaviour, same as today when the ATS tab is open).
- `layoutMode` interplay: `'editor'` hides the preview (then the dock should overlay or take the preview's place, its own decision); `'preview'` hides the left panel (dock beside preview fine); phone: no dock is drawn for ATS (canvas gap) and Design is a sheet (MobileDesign): `isMobile` branch needed, the pill (`Editor.jsx:216`) and `PdfPreview`'s
  "Updating preview…" chip (`fixed bottom-4 max-md:bottom-16 right-4`) must not collide with the dock.
- `TemplateGallery` (modal, `Editor.jsx:242`) is opened by DesignPanel's `onBrowseTemplates`; stays a modal; the canvas's EditorTemplates is a view of it (the gallery's apply-on-click + Undo is a PARITY rule).
- Tests to expect red and update: the tab specs listed in README; `103-r4-dph-31-pill-clears-tab-bottom`; `32-editor-tab-scroll` (EditorTabContent scroll reset per tab: a dock needs its own scroll box and the same reset when the dock changes); `71-preview-hidden-builds` should stay green (preview contract untouched).

## 6. Other things a planner must know

### 6.1 Shared files that two batches would both touch (serialise or own one batch)
- `src/pages/Editor.jsx` (246 lines): the layout root, dock, top bar, tab state, mobile pill, header placement. Exactly ONE batch owns it at a time; others hand it props. Tests tied: 165, 173, 71-preview-hidden-builds, 89-save-status, 29-page-size-preview-caption.
- `src/components/EditorHeader.jsx` (149): defines `EditorHeader`, `EditorAlerts`, `EditorModeBar`; 20 test files mention EditorHeader; 173 imports all three by name (3.3 #7).
- `src/hooks/useEditorTab.js` (37): the tab/dock address contract (3.3 #13); used by Editor and `useEditorExports`.
- `src/components/EditorPreviewPane.jsx` (84): toolbar content (LayoutToggle moves into the new bar; zoom, page size label; `SaveStatus` has its own test `89`).
- `src/index.css`: the tokens batch writes it; every other batch must not (merge conflicts, and the app-wide look flips).
- `src/components/DesignPanel.jsx` + `DesignPanel*.jsx`, `PersonalInfoEditor*.jsx`: the `groups`/`view` prop batch owns them; any batch moving controls changes walker signatures (4.1).
- `src/pages/Dashboard.jsx` + `AuthBar.jsx` + `ResumeCard.jsx`: start-up; one batch; it must carry the 71 check and any offsets (1.6) in the SAME batch, or the gate is red.
- `src/AppRoutes.jsx`: routes, `RouteFrame` scroll logic; `tests/unit/ui-shell.unit.mjs` pins shell paths. Nav renames touch it and `shell/TopBar.jsx`, `Sidebar*.jsx`, `WorkspaceLayout.jsx`.
- `tests/pdf/parity/*` registries: any control label change.

### 6.2 Ordering hazards
1. FIRST: read the real 71 margin (1.2) and the push gate on master; if master is red, fix-forward (HANDOFF rule).
2. Tokens (`index.css` `@theme`, optional font link) before any component batch; no JS risk; then lazy areas can proceed in parallel (workspace shell + Jobs + Projects are independent of the editor).
3. Dashboard/start-up batch needs its offsets decided first (1.6 items 2-3) and the owner informed if the Dashboard goes lazy or the cap moves.
4. Editor structure (full-width bar + document switch + dock) must land as ONE batch: the header move changes the root layout, `EditorModeBar`'s removal, `useEditorTab`, 173, and the Cypress/Playwright specs together. Doing the dock before the bar leaves two different shells.
5. The `groups`/`view` props (4.1) can land BEFORE the layout batch with default behaviour unchanged (safe, test-neutral), so the dock batch only wires them.
6. Per CLAUDE.md every fix/change needs a failfirst-proven test; a pure restyle has no behaviour change, so its proof is "existing tests green" plus a new structural test where the layout changes (e.g. `data-dock` present). Never weaken a stale test.
7. Memo and router interplay: anything new inside `EditorHeader`/top bar that needs navigation (Back to Documents, Terms/Privacy links in the footer: `EditorPreviewPane.jsx:61-67` already uses `useNavigate` inside the non-memo pane) must be callbacks from Editor.

### 6.3 Parity hazards found while reading (not owned by this scout, flagging)
- Global search on non-workspace pages: see 0.3.
- Template apply-on-click with Undo (DesignPanel via `usePickCard`, `designSnapshot`): the canvas draws Cancel / Use template; PARITY-RULE keeps today's.
- The Editor's other quiet functions that the canvas does not draw but must survive: `ImportMenu`/Import inside `ExportDropdown` (7 formats + Import JSON / file, "Import as my original" for demo accounts), Share link (`ShareLinkModal`, only with Firebase and a signed-in user, `canShare`, Editor.jsx:112), `RecoveryNotice`, `SyncHeldNotice`,
  `FontFallbackNotice`, `EditorAlerts` (import notice, export error, storage-full), "Auto-saved to your browser" / "Saving..." / "Saved N ago" / "Not saved" (`SaveStatus`), layout toggle (Editor only / Split / Preview only), preview zoom 50-150%, panel width drag with keyboard (Home/End, `usePanelResize.js:86`), Terms/Privacy links.
- `confirm('Delete this entry?')` (native) in `SectionEntry` and `useConfirm` elsewhere: keep.
- `useIsMobile(768)` is the breakpoint of the editor's phone layout; the canvas's phone boards are 390 px. Between 768 and ~1100 there is no canvas board: needs a rule (6.2).

### 6.4 What I could not determine
- The exact current start-up figure and the gzip budget value (log not read; run list and job ids given in 1.2).
- Minified byte cost of any new shell piece (all in 1.5 are estimates from source size).
- Which of the six `suite` shards runs `71-startup-chunks` (the shard split is by file order, `ci.yml:84-87`); `tests` input with that file name avoids needing to know.
- Whether Rolldown tree-shakes the `ui/index.js` barrel safely for start-up code (do not rely on it).
- Whether the master push gate failure (run 37426726646, `e4b56b72`, docs commit) is real or a flake: not opened.
- Cypress spec content (not read); the README's list of specs to update is taken as given.
