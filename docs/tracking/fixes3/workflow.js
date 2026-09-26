export const meta = {
  name: 'flowcv-bugs-then-design',
  description: 'flowcv: fix the known open rows, sweep 10 areas for bugs, then 4 for design bugs; every fix gets a separate reviewer; patches handed off one by one',
  phases: [
    { title: 'Known', detail: 'the rows left open or waiting on the owner — Claude makes the call and fixes them' },
    { title: 'Bugs', detail: 'find per area → fix (stacked per area) → independent review, up to 3 rounds' },
    { title: 'Design', detail: 'design bugs and flaws, after the bugs (lower priority in the queue)' },
  ],
}

const REPO = '/mnt/Storage/Projects/flowcv'
const BASE = 'd11d5a0'
const OUT = '/mnt/Storage/my-learning/claude/flowcv/wip/execution-2026-09-26/fixes3'
const WORK = '/tmp/claude-1000/-mnt-Storage-Projects-flowcv/e73739fc-f28b-4528-8cc6-abd9057d822d/scratchpad/work'

const RULES = `
HARD RULES (the owner's, binding):
- NEVER touch the real checkout ${REPO}: no checkout/switch/merge/commit/push/stash/reset/worktree/branch, no file edits there.
  Read project code ONLY via git: \`git -C ${REPO} show ${BASE}:<path>\`, \`git -C ${REPO} grep -n <pat> ${BASE} -- <path>\`,
  \`git -C ${REPO} ls-tree -r --name-only ${BASE} -- <dir>\`, \`git -C ${REPO} log\`.
- NEVER run tests, node, yarn, npm, vite, playwright, cypress, oxlint or any build — the owner's laptop crashes. No CI dispatch.
- Accessibility is OUT OF SCOPE entirely (aria/roles, contrast, focus rings, keyboard-only use, TARGET SIZES, screen readers):
  never report it, never fix it.
- English only: résumé-language / right-to-left work is parked; do not touch src/utils/resumeLanguage* or RTL; non-English is not a bug.
- The owner wants ZERO pending items: when a fix needs a product call, make the sensible one yourself, say it in notes, and fix it.
`

const FIX_HOWTO = `
HOW TO WRITE A FIX — one scratch git repo per item:
    D=${WORK}/<ID>; rm -rf $D; mkdir -p $D && cd $D && git init -q
    for f in <every file you will change>; do mkdir -p "$(dirname "$f")"; git -C ${REPO} show ${BASE}:"$f" > "$f"; done
    git add -A && git -c user.email=a@b -c user.name=a commit -qm base
    STACKING: if an earlier patch listed below touches a file you change, \`git apply ${OUT}/<EARLIER>.patch\` in $D (only for
      files you have there; copy its other files from base first if needed) BEFORE the base commit, and list it in "after".
    ...edit files in $D (Edit/Write); new test files at their repo paths...
    git add -A && git diff --cached > ${OUT}/<ID>.patch     (repo-relative paths: it applies with \`git apply\` at the repo root)
- Then write ${OUT}/<ID>.fix.json (Write tool, valid JSON):
    {"id","area","outcome":"fixed","patch":"${OUT}/<ID>.patch","after":[ids],"failfirst_tests":[node test files that FAIL
     without the src change],"other_tests":[...],"commit_subject","commit_body","notes"}
- Every app fix needs a node test (tests/pdf/*.test.mjs or tests/unit/*.unit.mjs) that FAILS without the src/ change and PASSES
  with it — CI's fail-first undoes the commit's src/ changes and runs failfirst_tests. Model it on an existing test of the same
  area (\`git -C ${REPO} ls-tree -r --name-only ${BASE} -- tests/\`) and use only harness APIs that exist
  (tests/pdf/harness.mjs, tests/pdf/fake-dom.mjs, tests/unit/ui-dom-harness.mjs, tests/pdf/fake-firestore.mjs).
  LESSONS: (1) the fake DOM keeps attributes only — React sets an <input>'s type/value as PROPERTIES; read el.type/el.value too.
  (2) The fake DOM has no layout: no getBoundingClientRect, no computed styles — for layout/design fixes assert the classes or
  structure that make the layout right. (3) A test whose fixture never renders the thing it checks passes without the fix — make
  sure the element under test is on the page. (4) Mounting a page pulls in everything it renders (dnd-kit etc.): prefer the
  smallest component that shows the bug. (5) Source-guard tests (reading a file and asserting a pattern) are acceptable only
  when behaviour cannot be exercised. Never weaken an existing test; a stale one is updated only with evidence, said in notes.
- If you change behaviour a doc in docs/knowledge/ states, update that line too. NEVER edit docs/tracking/ (the coordinator owns it).
- Style: match the surrounding code; comments explain why, in the repo's plain sentences. Commit subject like
  "fix(<area>): <what the user now sees> (<ID>)"; body: cause, fix, test.
- Re-read your own patch hunk by hunk against the base before handing off: the coordinator applies it as is.
- If after reading the code the item is NOT a real bug at ${BASE}, already fixed, or a duplicate of a tracker row that is fixed,
  write no patch; return that outcome with the evidence.
`

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          kind: { type: 'string', enum: ['bug', 'design'] },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          files: { type: 'array', items: { type: 'string' } },
          repro: { type: 'string' },
          expected: { type: 'string' },
          actual: { type: 'string' },
          fix_hint: { type: 'string' },
        },
        required: ['title', 'kind', 'severity', 'files', 'repro', 'actual', 'fix_hint'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['findings'],
}
const FIXED = {
  type: 'object',
  properties: {
    outcome: { type: 'string', enum: ['fixed', 'not-a-bug', 'already-fixed', 'duplicate', 'needs-owner', 'skipped'] },
    files: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['outcome', 'notes'],
}
const REVIEW = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['approve', 'changes', 'reject'] },
    issues: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['verdict', 'issues', 'summary'],
}

// Priority slots: at most 5 agents at once (the owner's laptop rule); known rows first, bugs next, design last.
let running = 0
const waiters = []
async function slot(prio, fn) {
  if (running >= 5) {
    await new Promise((r) => { waiters.push({ prio, r }); waiters.sort((a, b) => a.prio - b.prio) })
  }
  running += 1
  try { return await fn() } finally {
    running -= 1
    const w = waiters.shift()
    if (w) w.r()
  }
}

const TRACKERS = `The trackers at ${BASE}: docs/tracking/bug-status-r2/*.md (R2-/R3- rows), docs/tracking/boards-jobs-bugs/*.md (B-/J- rows),
docs/tracking/templates-ui-bugs.md. Skip anything already a row there that is ✅ AND really fixed; if a ✅ row's bug still reproduces
at ${BASE}, report it as a regression (say which row). Skip these, they are being fixed separately right now: R2-148-c (PDF import
company/role on Executive/Timeline), RES-R2-140-a (offline reorder of jobs/boards), RES-R2-140-c (sync icon for jobs/boards),
RES-R2-137 (Word Modern/Sidebar banner, Word letter contacts beside the name), R2-147-pn (page-number footer on a page with an
over-tall block), PERF-1 WOFF cost. Features never built (template gallery filters, AI writing, new sign-in options, …) are not bugs.`

const BUG_AREAS = [
  { key: 'ED', name: 'Résumé editor and store', files: 'src/pages/Editor.jsx, src/components/Editor*.jsx, SectionEditor*.jsx, PersonalInfoEditor*.jsx, RichTextEditor.jsx, CareerHistoryPanel.jsx, HeaderIconPickerModal.jsx, HeaderSpacingControls.jsx, src/hooks/useResumeStore.js, useResume*Actions.js, useEditorTab.js, useOpenResume.js, useTypedNumber.js, useRename.js, useHotkeys.js, usePanelResize.js, src/utils/resume.js, normalizeResume.js, richText.js, textFields.js, dates.js, skills.js, languageLevel.js, roleGroups.js, sectionShapes.js, defaultData*.js, dataVersion.js, storedText.js, coalescedWrite.js, storageBackup.js, contacts.js' },
  { key: 'PDF', name: 'PDF rendering, preview and canvas-vs-PDF parity', files: 'src/templates/** (every template, shared pieces), src/components/PdfPreview.jsx, EditorPreviewPane.jsx, FontFallbackNotice.jsx, src/utils/pdfBuild.js, pdfExportReactPDF.js, pdfWorker*.js, pageFit.js, pageImage*.js, fonts.js, fontsource.js, fontFallback.js, printableImage.js, smallerPhotos.js, sectionIconPaths.js, contactIcon*.js*, linkStyle.js, colors.js' },
  { key: 'DSN', name: 'Design panel, templates, picker, saved designs, new résumé', files: 'src/components/DesignPanel*.jsx, TemplateGallery.jsx, TemplateThumb.jsx, ResumeThumbnail.jsx, StarterTemplateModal.jsx, LayoutToggle.jsx, src/pages/NewResume.jsx, src/hooks/usePickCard.js, usePicture.js, useSmallerPhotos.js, src/utils/templatePicker.js, templateSwitch.js, starter*.js, newResume.js, headerSpacingRows.js' },
  { key: 'EXP', name: 'Exports: Word, Markdown, ATS text, JSON Resume, file names, downloads', files: 'src/utils/wordExport*.js, wordFonts.js, markdownExport.js, atsPlainText.js, jsonResume*.js, exportFilename.js, download.js, clipboard.js, src/components/ExportDropdown.jsx, src/hooks/useEditorExports.js' },
  { key: 'IMP', name: 'Import: PDF, Word, text, Markdown, JSON, job CSV', files: 'src/utils/importFile.js, importDocument.js, importText.js, jsonResumeImport.js, jobImport.js, jobCsv.js, pdfjsLoader.js, src/components/ImportMenu.jsx, src/hooks/useImportNotice.js' },
  { key: 'SYNC', name: 'Accounts, cloud sync, public link, storage, recovery', files: 'src/utils/cloudSync*.js, collectionSync*.js, syncMerge.js, firebase.js, firestoreOldCache.js, publicLink.js, localDeletions.js, demoRestore.js, demoSeed.js, demoAccounts.js, oldSamples.js, signInError.js, siteOwner.js, src/hooks/useAuth.js, useCloudSync.js, useCollectionSync.js, useDemoSeed.js, src/components/AuthBar.jsx, ShareLinkModal.jsx, SyncHeldNotice.jsx, RecoveryNotice.jsx, src/pages/PublicResume.jsx, firestore.rules' },
  { key: 'BRD', name: 'Boards (Jira-style): boards, board, backlog, issues, projects, calendar, timeline', files: 'src/components/board/**, src/components/tracker/** (if board), src/pages/Board.jsx, Boards.jsx, BoardSettings.jsx, Backlog.jsx, Project*.jsx, YourWork.jsx, src/hooks/useBoardStore.js, src/utils/board*.js, issueHistory.js, calendarGrid.js, projectSummary.js, cardKeys.js, normalizeBoard.js, workspaceSearch.js' },
  { key: 'JOB', name: 'Job Tracker', files: 'src/components/job/**, src/pages/JobTracker.jsx, JobDetail.jsx, JobForm.jsx, src/hooks/useJobStore.js, useJobStages.js, src/utils/job*.js, normalizeJob.js, unsavedJobs.js' },
  { key: 'CL', name: 'Cover letters and the writing tools (bullet optimizer, letter generator, ATS checker, parser view)', files: 'src/components/CoverLetter*.jsx, NewLetterModal.jsx, BulletOptimizerModal.jsx, CoverLetterGeneratorModal.jsx, AtsCheckerPanel.jsx, AtsParserView.jsx, src/utils/coverLetter*.js, letters.js, bulletOptimizer.js, atsChecker.js, parserText.js, src/templates/pdf/CoverLetter*' },
  { key: 'APP', name: 'Dashboard, routing, workspace shell, error handling, static pages', files: 'src/App.jsx, AppRoutes.jsx, main.jsx, src/pages/Dashboard.jsx, TermsPage.jsx, PrivacyPage.jsx, src/components/ResumeCard.jsx, ErrorBoundary.jsx, src/components/shell/**, src/components/ui/**, src/hooks/useBackOrHome.js, useUrlState.js, useSessionState.js, useMediaQuery.js, useOverlayClose.js, src/utils/lazyPage.js, ids.js, uiFormat.js, index.css' },
]

const DESIGN_AREAS = [
  { key: 'DPH', name: 'Phone-width layout (≤ 640 px) of every page and dialog', files: 'every page in src/pages/ and every dialog/modal/popover in src/components/ (Tailwind classes: missing responsive variants, fixed widths, overflow, clipped or overlapping content, horizontal page scroll, sticky bars covering content, dialogs taller than the screen with no scroll, the iOS 16 px input rule)' },
  { key: 'DVIS', name: 'Visual consistency on desktop/tablet', files: 'src/components/ui/** (the kit) against its users: buttons, inputs, selects, cards, headers, dialogs, spacing, typography, icon sizes, colours, dark/light tokens, hover states, loading states — one-off styles that break the kit, inconsistent headers between Dashboard / Editor / Boards / Jobs, misaligned toolbars, truncated labels' },
  { key: 'DUX', name: 'Flow and UX design flaws', files: 'every user flow: new résumé → edit → design → export; import; cover letter; share link; boards; job tracker; sign-in/sync — dead ends, missing empty/loading/error states, confusing or wrong copy, actions with no feedback, destructive actions with no confirm or undo, settings that do nothing, controls shown where they do not apply, lost unsaved input on navigation' },
  { key: 'DOUT', name: 'Output design: the résumé and letter as printed', files: 'src/templates/** and src/utils/wordExport*.js — typography and spacing defects in each template (orphaned headings, uneven gaps, misaligned columns/dates, icons off the baseline, clashing default colours, a template whose defaults look broken, cover letter look vs its résumé), Word vs PDF look differences users will notice' },
]

const KNOWN = [
  { key: 'KIMP', name: 'Import leftovers', items: [
    { id: 'R2-148-c', title: 'PDF import guesses company/role wrong for Executive and Timeline résumés — re-land the reverted fix without its regression', kind: 'bug', severity: 'medium',
      files: ['src/utils/importFile.js', 'src/utils/importText.js'],
      repro: `The earlier fix is the patch ${OUT}/../fixes/R2-148-c.patch (manifest ${OUT}/../fixes/R2-148-c.done.json, landed as 95afab8 and reverted). CI gate 36221038666 failed tests/pdf/99-import-roundtrip-columns.test.mjs with it: the Sidebar template's education reads its field of study into the entry's description. Read the patch, the revert, and that test at ${BASE}; find why the new header logic swallows the Sidebar education's second line, fix both, keep the patch's tests and add the Sidebar education case.`,
      actual: 'reverted; bug open', fix_hint: 'restrict the new location/date-first handling to the layouts that need it (hint from line geometry) so the Sidebar education keeps its field of study' },
    { id: 'R2-148-b', title: 'PDF import reads at most two columns, left first', kind: 'bug', severity: 'low', files: ['src/utils/importFile.js'],
      repro: 'A three-column PDF résumé imports with columns interleaved. Judge: if a small, safe generalisation of the column split to N columns exists, fix with a test; if not, return not-a-bug with the reason (a documented limit) — no half-fix.', actual: 'two columns max', fix_hint: 'generalise the gap-based split' },
  ] },
  { key: 'KSYNC', name: 'Sync of jobs and boards', items: [
    { id: 'RES-R2-140-a', title: 'A reorder of jobs or boards made before the first sync (offline, signed out, a failed sync) is lost to the cloud order', kind: 'bug', severity: 'medium',
      files: ['src/utils/collectionSyncPlan.js', 'src/utils/collectionSyncMeta.js', 'src/utils/collectionSyncEngine.js'],
      repro: `Read the diagnosis in ${OUT}/../fixes/RES-R2-140-a.done.json "notes" (a three-way merge on a recorded base order). The owner wants it fixed. Implement it: the sync record keeps the last-synced order (older records without it must still read, no DATA_VERSION bump unless required — if you bump it, update docs/knowledge and tests/unit/knowledge-docs expectations), firstSync and flush record it, planFirstSync lets the local order lead when the cloud order still equals the base. Tests in tests/unit/job-sync.unit.mjs / board-sync.unit.mjs style.`,
      actual: 'cloud order always wins on first sync', fix_hint: 'three-way order merge on a recorded base' },
    { id: 'RES-R2-140-c', title: 'Jobs and boards show no sync status; an error or a refused sync is only logged to the console', kind: 'design', severity: 'medium',
      files: ['src/hooks/useCollectionSync.js', 'src/utils/collectionSyncMeta.js', 'src/components/AuthBar.jsx', 'src/components/shell/'],
      repro: `Read ${OUT}/../fixes/RES-R2-140-c.done.json "notes". Product call (made for the owner): show the same sync dot the résumés use (AuthBar's SyncDot look and words) on the /jobs and /boards workspace pages, in the workspace shell's header area, fed by a small status store set from the collection engine's report.status (worst status of the lists shown wins: error/off > offline > syncing > synced). Keep it visually identical to the résumé dot. No accessibility extras.`,
      actual: 'no status', fix_hint: 'status store + dot in the workspace shell header' },
  ] },
  { key: 'KWORD', name: 'Word export look', items: [
    { id: 'RES-R2-137', title: 'Word résumé drops the Modern and Sidebar header band; the Word letter puts contacts under the name at Right of Name', kind: 'design', severity: 'medium',
      files: ['src/utils/wordExportHeader.js', 'src/utils/wordExportCoverLetter.js', 'src/utils/wordExportLook.js', 'src/components/ExportDropdown.jsx'],
      repro: `Read the R2-137 and R2-133 rows (docs/tracking/bug-status-r2/03-features-and-test-gaps.md, 02-low.md) and commit 977c89b. Product call (made for the owner): draw the band in Word as a full-width one-cell shaded table (the accent fill, the header text colour, the name/title/contacts inside, headerPadX/Y as cell margins), for Modern and the Sidebar's header band; the letter's contacts sit beside the name at Right of Name (a two-cell borderless table, contactsSideGap as the gap). Then drop the Export menu's note that the .docx leaves the band out. Tests on the generated document.xml.`,
      actual: 'no band in Word', fix_hint: 'shaded table header' },
  ] },
  { key: 'KPDF', name: 'PDF leftovers', items: [
    { id: 'R2-147-pn', title: 'The page-number footer is missing on a page that holds an unbreakable block taller than a page', kind: 'bug', severity: 'low',
      files: ['src/templates/pdf/'], repro: 'Read the page-numbers report (git -C the repo show cd80e4a:wf-reports/page-numbers.json) and how the footer is drawn at the base. Fix so every page carries it (e.g. a react-pdf fixed element / render-prop footer) without breaking the "last text drawn" order the ATS tests rely on; if impossible without that break, return not-a-bug with the evidence.',
      actual: 'footer missing on that page', fix_hint: 'fixed footer per page' },
    { id: 'PERF-1-woff', title: 'PERF-1: the WOFF font cost left open on R2-142', kind: 'bug', severity: 'low',
      files: ['src/utils/fonts.js', 'src/utils/fontsource.js', 'src/utils/pdfWorker.js'], repro: 'Read the R2-142 row (docs/tracking/bug-status-r2/03-features-and-test-gaps.md, "PERF-1") and the perf2 commits (24b8724 7e04f04 d7fd476 9ac453d bd3ff9a cf3ad0e). Find what the WOFF cost is (fonts fetched/decoded again per build or per worker?) and fix it with a test that counts fetches/decodes; if it is already solved at the base, return already-fixed with the evidence.',
      actual: 'open on the row', fix_hint: 'cache decoded fonts across builds and the worker' },
  ] },
]

function findPrompt(area) {
  return `${RULES}
You are a ${area.kind === 'design' ? 'senior product designer with front-end skills' : 'senior QA engineer'} auditing flowcv (CPWT-CV, a free résumé builder,
React 19 + react-pdf + Tailwind) at commit ${BASE}, by reading the code only.
AREA: ${area.name}. Files (start here, follow imports as needed): ${area.files}.
Find every REAL ${area.kind === 'design' ? 'design bug or design flaw a user would notice (layout breaks, visual inconsistency, confusing flows, dead ends — NOT accessibility)' : 'bug: wrong result, crash, data loss, state that goes stale, a control that does nothing, a race, an edge case (empty, very long, pasted, special characters in English text, many items, offline, two tabs), canvas-vs-PDF mismatch'} in this area.
${TRACKERS}
Report only what you have confirmed by reading the code path end to end — cite file:line at ${BASE}, a concrete repro a user could do,
what they see, what they should see, and a fix hint. No speculation, no style nits, no "could be refactored". Do not pad; do not stop
early either — exhaust the area. Order by severity.`
}

function fixPrompt(item, area, earlier, review) {
  return `${RULES}${FIX_HOWTO}
ITEM ${item.id} (area ${area.key}: ${area.name}) — ${item.kind}, ${item.severity}:
Title: ${item.title}
Files: ${(item.files || []).join(', ')}
Repro: ${item.repro}
${item.expected ? 'Expected: ' + item.expected + '\n' : ''}Actual: ${item.actual}
Fix hint: ${item.fix_hint}
Earlier patches of this area (stack on them if you touch the same files): ${earlier.length ? earlier.map((e) => `${OUT}/${e}.patch`).join(' ') : 'none'}
${review ? `\nTHIS IS A REVISION. Your previous patch ${OUT}/${item.id}.patch and ${OUT}/${item.id}.fix.json were reviewed; the reviewer asked for:\n- ${review.issues.join('\n- ')}\nReviewer summary: ${review.summary}\nRebuild the scratch repo, address every point, overwrite the patch and fix.json.` : ''}
First confirm the bug at ${BASE} by reading the code. Then fix it at the root (not the symptom), with its test, and hand off.
Return the outcome, the files changed, and notes (cause, fix, product calls made).`
}

function reviewPrompt(item, area, round) {
  return `${RULES}
You are an independent, skeptical code reviewer. Review the fix for ${item.id} (${area.name}) before it lands on the owner's app.
Bug: ${item.title}. Repro: ${item.repro}
Patch: ${OUT}/${item.id}.patch · manifest: ${OUT}/${item.id}.fix.json · base: ${BASE} (read code with \`git -C ${REPO} show ${BASE}:<path>\`).
Check, concretely:
1. The bug is real at ${BASE} (read the path). If it is not, verdict reject.
2. The fix is correct at the root, complete (every call site / template / variant the bug has), and breaks nothing else: read the
   callers of every changed function and every test at ${BASE} that covers the changed code (\`git -C ${REPO} grep -n\`) — would any
   existing test now fail? Would any other screen change?
3. The failfirst test really FAILS without the src/ change and PASSES with it: trace it through the harness it uses (fake DOM has
   attributes only and no layout). A test that passes either way is a blocker.
4. The patch applies cleanly: in a fresh dir under ${WORK}/review-${item.id}, copy the base files it touches (plus any "after" patches
   applied first), \`git apply --check\` it. Do not run tests or node.
5. Scope and style: no accessibility or locale changes; matches the surrounding code; no docs/tracking edits; commit subject says what
   the user now sees.
Round ${round} of 3.
- If it is good (or only trivially off — then fix the trivial thing yourself in the patch): write ${OUT}/${item.id}.done.json = the
  fix.json's content plus "reviewed": "<one line: what you checked>". Verdict approve.
- If it needs changes: verdict changes with a precise list${round === 3 ? '. This is the LAST round: also write ' + OUT + '/' + item.id + '.held.json with {"id","issues":[...]} so the coordinator takes it over' : ''}.
- If the bug is not real or the approach is wrong beyond repair: verdict reject and write ${OUT}/${item.id}.held.json {"id","reason"}.`
}

async function reviewLoop(item, area, prio, earlier, phaseName) {
  for (let round = 1; round <= 3; round++) {
    const rv = await slot(prio, () => agent(reviewPrompt(item, area, round),
      { label: `review:${item.id}#${round}`, phase: phaseName, schema: REVIEW, effort: 'high' }))
    if (!rv) return { id: item.id, outcome: 'review-died' }
    if (rv.verdict === 'approve') return { id: item.id, outcome: 'approved', summary: rv.summary }
    if (rv.verdict === 'reject') return { id: item.id, outcome: 'rejected', summary: rv.summary, issues: rv.issues }
    if (round === 3) return { id: item.id, outcome: 'held', issues: rv.issues }
    const fx = await slot(prio, () => agent(fixPrompt(item, area, earlier, rv),
      { label: `fix:${item.id}#${round + 1}`, phase: phaseName, schema: FIXED, effort: 'high' }))
    if (!fx || fx.outcome !== 'fixed') return { id: item.id, outcome: fx ? fx.outcome : 'fix-died', notes: fx && fx.notes }
  }
}

async function runItems(items, area, prio, phaseName) {
  const done = []
  const earlier = []
  for (const item of items) {
    const fx = await slot(prio, () => agent(fixPrompt(item, area, earlier.slice(), null),
      { label: `fix:${item.id}`, phase: phaseName, schema: FIXED, effort: 'high' }))
    if (fx && fx.outcome === 'fixed') {
      const snap = earlier.slice()
      earlier.push(item.id)
      done.push(reviewLoop(item, area, prio, snap, phaseName))
    } else {
      done.push(Promise.resolve({ id: item.id, outcome: fx ? fx.outcome : 'fix-died', notes: fx && fx.notes }))
    }
  }
  const res = await Promise.all(done)
  return res.map((r, i) => ({ ...r, title: items[i].title, area: area.key, kind: items[i].kind, severity: items[i].severity }))
}

async function runArea(area, prio, phaseName) {
  const found = await slot(prio, () => agent(findPrompt(area),
    { label: `find:${area.key}`, phase: phaseName, schema: FINDINGS, effort: 'medium' }))
  const list = (found && found.findings) || []
  const rank = { high: 0, medium: 1, low: 2 }
  list.sort((a, b) => rank[a.severity] - rank[b.severity])
  const items = list.map((f, i) => ({ ...f, id: `R4-${area.key}-${String(i + 1).padStart(2, '0')}` }))
  log(`${area.key}: ${items.length} finding(s) — ${items.map((i) => i.id + ' ' + i.severity).join(', ')}`)
  return runItems(items, area, prio + 0.5, phaseName)
}

const known = KNOWN.map((g) => runItems(g.items, g, 0, 'Known'))
const bugs = BUG_AREAS.map((a) => runArea({ ...a, kind: 'bug' }, 1, 'Bugs'))
const design = DESIGN_AREAS.map((a) => runArea({ ...a, kind: 'design' }, 3, 'Design'))
const all = (await Promise.all([...known, ...bugs, ...design])).flat().filter(Boolean)
const tally = {}
for (const r of all) tally[r.outcome] = (tally[r.outcome] || 0) + 1
log(`done: ${JSON.stringify(tally)}`)
return { tally, items: all }
