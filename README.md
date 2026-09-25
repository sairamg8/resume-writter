# CPWT-CV

A free, open-source, browser-based résumé and cover letter builder. Create, design, and export professional résumés with optional Google account sync — your data stays in your browser until you choose to back it up to the cloud.

> **How it works** (architecture, data model, features, sync, templates, testing, file map):  
> [`docs/knowledge/`](docs/knowledge/INDEX.md) — start at `INDEX.md`

---

## Features

- **9 résumé templates** — Classic, Modern, Minimal, Executive, Sidebar (with a single-column
  *ATS-safe* layout), Timeline, Banner, Academic and Compact — plus five starter résumés
  (software engineer, product manager, data scientist, academic CV, compact leader)
- **What you see is the PDF** — the preview is the exported A4 / US Letter PDF itself, rendered
  with `@react-pdf/renderer`
- **Exports** — PDF, Word (`.docx`), Markdown, ATS plain text, [JSON Resume](https://jsonresume.org),
  and a full backup JSON; **imports** a backup or a JSON Resume file
- **Design system** — accent and text colours, 13 built-in fonts plus any Google Font, heading
  styles, header spacing, page margins, spacing presets, date formats, contact icons, photo shape
  and size, and per-section options (columns, dates, locations, title order)
- **Cover letters** — share the résumé's design; a generator drafts one from the résumé
- **ATS checker** — a score for what the PDF prints, job-description keyword matching, and a
  STAR bullet optimiser
- **Job tracker** — list and kanban views, stages, tasks, notes, status history, CSV export
- **Boards** — Jira-style boards for anything else you track, each with a backlog and settings,
  and a "Your work" page of what needs doing across all of them
- **Drag and drop** — reorder sections and entries
- **Google Sign-In + cloud sync** — résumés sync across devices through Firebase Firestore;
  everything works offline and without an account

---

## Tech Stack

| Layer | Library |
|---|---|
| UI framework | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 (`HashRouter`) |
| PDF | `@react-pdf/renderer` (export and preview), `pdfjs-dist` (preview painting) |
| Word export | `docx` |
| Drag and drop | dnd-kit |
| Auth + cloud | Firebase v12 (Auth + Firestore) |
| Icons | lucide-react |
| Linting | oxlint |
| Tests | `node:test` (PDF and unit suites), Playwright, Cypress |

---

## Local Development Setup

### 1. Clone and install

The project uses Yarn 4 through Corepack (Node 22).

```bash
git clone https://github.com/sairamg8/resume-writter.git
cd resume-writter
corepack enable
yarn install
```

No configuration is needed: with no `.env` at all the app runs fully offline (localStorage only),
and a production build hides Google Sign-In. Sign-in and cloud sync need the `VITE_FIREBASE_*`
values below. Every variable the app reads is listed in [`.env.example`](.env.example) — copy it to
`.env.local` and fill in what you need.

### 2. Firebase setup (required for Google Sign-In and cloud sync)

**a. Create a Firebase project**

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Create a project"**, name it (e.g. `cpwt-cv`), click through

**b. Enable Google Sign-In**

1. Left sidebar → **Build → Authentication** → **Get started**
2. **Sign-in method** tab → click **Google** → toggle **Enable** → **Save**

**c. Create Firestore database**

1. Left sidebar → **Build → Firestore Database** → **Create database**
2. Choose **"Start in production mode"** → pick a region → **Done**
3. Click the **Rules** tab and paste the contents of [`firestore.rules`](firestore.rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Everything an account syncs: its own, and no one else's.
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    // A résumé its owner published (Share a public link, src/utils/publicLink.js): anyone with the
    // link reads it — one by its id, never the list — and only the account that owns it writes it.
    match /public/{shareId} {
      allow get: if true;
      allow create: if request.auth != null && request.resource.data.owner == request.auth.uid;
      allow update: if request.auth != null && resource.data.owner == request.auth.uid && request.resource.data.owner == request.auth.uid;
      allow delete: if request.auth != null && resource.data.owner == request.auth.uid;
    }
  }
}
```

The second rule is what makes **Share a public link** work: a signed-in user can publish a read-only
copy of one résumé at `https://<your site>/#/r/<id>`. Only published copies are readable by anyone;
everything else stays owner-only. Without Firebase configured the feature is hidden.

4. Click **Publish**

**d. Register a web app and get your config**

1. Gear icon ⚙️ next to "Project Overview" → **Project settings**
2. Scroll to **"Your apps"** → click the **`</>`** (web) icon
3. Nickname: `cpwt-cv-web` → **Register app**
4. Copy the config values shown

**e. Create `.env.local`** in the project root:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc...
```

> `.env.local` is gitignored by default (`*.local` in `.gitignore`). Never commit it.

### 3. Optional deployment settings

| Variable | What it does | Unset |
|---|---|---|
| `VITE_DEMO_ACCOUNTS` | Comma-separated emails whose résumés marked **"Keep as my original"** always come back after being deleted | nobody (empty = nobody too) |
| `VITE_CONTACT_EMAIL` | The contact address the Terms and Privacy pages give | the pages say to contact whoever runs the site |
| `VITE_DEV_USER_EMAIL`, `VITE_DEV_USER_NAME`, `VITE_DEV_USER_UID` | The stand-in account `yarn dev` signs in as when Firebase is not configured or its popup fails (dev server only) | `dev@example.com`, `Dev User`, `dev_user` |

### 4. Run the dev server

```bash
yarn dev
```

Open [http://localhost:5173](http://localhost:5173).

### 5. Build for production

```bash
yarn build          # outputs to /dist
yarn preview        # serve the built output locally
```

---

## Project Structure

```
src/
  main.jsx        # StrictMode + HashRouter
  App.jsx         # the app's state: résumé store, account, cloud sync, demo restore
  AppRoutes.jsx   # the routes, and what each page gets from App
  pages/          # Dashboard, Editor, JobTracker, JobForm, JobDetail, Boards, Board, Backlog,
                  # BoardSettings, YourWork, TermsPage, PrivacyPage
  components/     # editor panels (design, sections, personal info, cover letter, ATS checker,
                  # career history), the PDF preview, export/import menus, résumé cards
    ui/           # the shared UI kit (dialogs, menus, toasts, fields…)
    shell/        # the workspace shell (sidebar) around the Job Tracker and Boards
    job/, board/  # Job Tracker and Boards components
  hooks/          # stores (résumés, jobs, job stages, boards), auth, cloud sync, demo restore, exports
  templates/pdf/  # one react-pdf file per template, the cover letter (and its header), shared/ building blocks
  constants/      # the template table (templateTable.js, templates.js), section groups, jobs, boards,
                  # page sizes and margins, header spacing, photo options…
  utils/          # data model and normaliser, exporters (PDF, Word, Markdown, ATS text, JSON Resume),
                  # cloud-sync engine, ATS checker, bullet optimiser, cover-letter generator,
                  # job and board logic, fonts, Firebase init
tests/
  pdf/            # node:test suites that render real PDFs and read them back (Poppler, MuPDF, pdf.js)
  unit/           # node:test unit suites
  playwright/     # browser suites against a built ./dist: the preview is the downloaded PDF
  fixtures/       # fictional sample résumés
cypress/          # end-to-end specs (e2e/) and support/
docs/knowledge/   # how the app works — start at INDEX.md; 09-file-map.md is the full file map
docs/tracking/    # bug tracker, plans and session logs
.github/workflows/ci.yml  # the CI gate (see Scripts and tests)
firestore.rules   # Firestore security rules
wrangler.jsonc    # Cloudflare static-assets deploy of ./dist
```

---

## Cloud Sync Behaviour

| Scenario | What happens |
|---|---|
| No account | All data stored in `localStorage` only, never leaves your device |
| First sign-in | Local and cloud résumés merged; a résumé changed only in the cloud loads the cloud's copy |
| Edit while online | Written to Firestore ~1.5 s after you stop typing |
| Edit while offline, or a failed write | Kept in the browser's résumé store and sent at the next sync (Firestore's own cache is in memory only) |
| Delete a résumé | Removed from Firestore; its ID is logged so other devices don't re-pull it |
| Sign in on a second device | Cloud résumés fetched and merged with whatever is local |
| Conflict (the same résumé changed on two devices) | Both kept: the other device's version comes back as **"&lt;name&gt; (conflict copy)"** |
| Sign out on a shared browser | That account's résumés leave the browser; its next sign-in brings them back |

The cloud icon beside your account shows live status: **green** = synced, **amber spinner** = syncing, **grey** = offline or sync off (still works locally), **red** = sync error or a résumé the cloud would not take (usually a large photo).

Details: [`docs/knowledge/05-state-auth-sync.md`](docs/knowledge/05-state-auth-sync.md).

---

## Data & Privacy Summary

### Without an account
All data is stored in your browser's `localStorage` (résumés under `cpwtcv_v1`; jobs, job stages, boards and custom fonts under their own `cpwtcv_*` keys). Nothing is transmitted anywhere, apart from fetching font files when a résumé uses them.

### With a Google account
- **What we store in Firebase:** your resume content, tied to your Google UID.
- **What we receive from Google OAuth:** your display name, email, and profile photo URL.
- **What we never store:** passwords, payment info, or browsing data.
- Firestore security rules ensure only the authenticated owner can read or write their own data.
- You can export all your data at any time via the JSON export button.
- To delete your cloud data, delete all résumés in the app, or contact whoever runs the site (the address set by `VITE_CONTACT_EMAIL`, shown on the Privacy page).

Full policy: see [`/privacy`](#/privacy) in the running app or [`src/pages/PrivacyPage.jsx`](src/pages/PrivacyPage.jsx).

---

## Routes

| Path | Description |
|---|---|
| `#/` | Dashboard — all résumés |
| `#/resume/:id` | Résumé editor (`?tab=coverletter` opens the cover letter) |
| `#/jobs` | Job tracker — list and kanban |
| `#/jobs/new`, `#/jobs/:id`, `#/jobs/:id/edit` | Add, view and edit a job |
| `#/boards`, `#/boards/:id` | Boards, and one board |
| `#/boards/:id/backlog`, `#/boards/:id/settings` | A board's backlog and settings |
| `#/work` | Your work — what needs doing across every board |
| `#/terms` | Terms & Conditions |
| `#/privacy` | Privacy Policy |

Uses `HashRouter` so all routes work after a page refresh without any server configuration. Any
other path goes back to the dashboard.

---

## Scripts and tests

```bash
yarn dev          # dev server with HMR
yarn build        # production build → /dist
yarn preview      # serve the production build locally
yarn lint         # oxlint
yarn test         # node:test — the PDF suites and the unit suites
yarn test:pdf     # PDF suites only
yarn test:unit    # unit suites only
yarn test:pw      # production build + Playwright browser suites
yarn test:e2e     # e2e build + Cypress (cy:open / cy:run for Cypress alone)
```

The PDF suites read PDFs back with Poppler and MuPDF: install `poppler-utils` and `mupdf-tools`
(Debian/Ubuntu) first. To run one file: `node --test tests/pdf/06-pagination.test.mjs`.

You can run any of these locally, but the project's gate is GitHub Actions —
[`.github/workflows/ci.yml`](.github/workflows/ci.yml). Every push to `master` runs everything: the
node suite in six shards (on Ubuntu 26.04 with Poppler and MuPDF), a production build, Playwright
in three shards, oxlint, and Cypress in four shards against the e2e build. A branch is checked
before it merges by running the workflow by hand (**Actions → ci → Run workflow**), whose optional
inputs narrow the run:

| Input | Meaning |
|---|---|
| `tests` | Node test files to run instead of the whole suite (space-separated paths or globs) |
| `failfirst` | `sha:test1,test2` pairs — the commit's `src/` changes are undone and its tests must fail, then pass again with them |
| `playwright` | `all`, `none`, or spec files |
| `cypress` | `all`, `none`, or spec files |

Left empty, a dispatch runs everything; with `tests` or `failfirst` set, Playwright and Cypress are
skipped unless named. Lint runs every time.

---

## Contributing

Bug reports and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

*Built by Sairam Gudiputi · [sairamgudiputi8@gmail.com](mailto:sairamgudiputi8@gmail.com)*
