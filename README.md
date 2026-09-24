# CPWT-CV

A browser-based resume and cover letter builder. Create, design, and export professional resumes with optional Google account sync — your data stays in your browser until you choose to back it up to the cloud.

> **Developer knowledge base** (architecture, data model, progress, agent memory):  
> [`docs/knowledge/INDEX.md`](docs/knowledge/INDEX.md)

---

## Features

- **9 résumé templates** — Classic, Modern, Minimal, Executive, Sidebar (with a single-column
  *ATS-safe* layout), Timeline, Banner, Academic and Compact — plus role-based starter résumés
- **What you see is the PDF** — the preview is the exported A4 / US Letter PDF itself, rendered
  with `@react-pdf/renderer`
- **Exports** — PDF, Word (`.docx`), Markdown, ATS plain text, [JSON Resume](https://jsonresume.org),
  and a full backup JSON; **imports** a backup or a JSON Resume file
- **Design system** — accent and text colours, 14 built-in fonts plus any Google Font, heading
  styles, header spacing, page margins, spacing presets, date formats, contact icons, photo shape
  and size, and per-section options (columns, dates, locations, title order)
- **Cover letters** — share the résumé's design; a generator drafts one from the résumé
- **ATS checker** — a score for what the PDF prints, job-description keyword matching, and a
  STAR bullet optimiser
- **Job tracker** — list and kanban views, stages, tasks, notes, status history, CSV export
- **Boards** — Jira-style boards for anything else you track
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

Firebase is optional: without the keys below the app runs fully offline (localStorage only), and a
production build hides Google Sign-In.

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
3. Click the **Rules** tab and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

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

### 3. Run the dev server

```bash
yarn dev
```

Open [http://localhost:5173](http://localhost:5173).

### 4. Build for production

```bash
yarn build          # outputs to /dist
yarn preview        # serve the built output locally
```

---

## Project Structure

```
src/
  main.jsx, App.jsx, AppRoutes.jsx   # entry, stores, routes (HashRouter)
  pages/          # Dashboard, Editor, JobTracker / JobForm / JobDetail, Boards / Board, Terms, Privacy
  components/     # editor panels (design, sections, personal info, cover letter, ATS), preview
    ui/           # the shared UI kit (dialogs, menus, toasts, fields…)
    shell/        # the workspace shell around the Job Tracker and Boards
    job/, board/  # Job Tracker and Boards components
  hooks/          # stores (résumés, jobs, boards), auth, cloud sync, exports
  templates/pdf/  # one react-pdf file per template, the cover letter, and shared/ building blocks
  constants/      # template table, spacing, page sizes, photo options…
  utils/          # data model and normaliser, exporters (Word, Markdown, ATS text, JSON Resume),
                  # cloud-sync engine, ATS checker, cover-letter generator, job and board logic
tests/
  pdf/            # node:test suites that render real PDFs and read them back (Poppler, MuPDF, pdf.js)
  unit/           # node:test unit suites
  playwright/     # browser suites: the preview is the downloaded PDF, every control repaints it
cypress/          # end-to-end specs
docs/knowledge/   # architecture, data model, features, testing — start at INDEX.md
docs/tracking/    # bug tracker, plans and session logs
```

---

## Cloud Sync Behaviour

| Scenario | What happens |
|---|---|
| No account | All data stored in `localStorage` only, never leaves your device |
| First sign-in | Local and cloud resumes merged — newer `updatedAt` wins per resume |
| Edit while online | Debounce-writes to Firestore ~1.5 s after you stop typing |
| Edit while offline | Firestore queues writes in IndexedDB; auto-flushes on reconnect |
| Delete a resume | Removed from Firestore; ID logged so other devices don't re-pull it |
| Sign in on a second device | Cloud resumes fetched and merged with whatever is local |
| Conflict (two devices, both offline) | Last device to come online wins (last-write-wins by `updatedAt`) |

The cloud icon in every header shows live status: **green** = synced, **yellow spinner** = syncing, **grey** = offline (still works locally), **red** = sync error.

---

## Data & Privacy Summary

### Without an account
All data is stored in your browser's `localStorage` under the key `cpwtcv_v1`. Nothing is transmitted anywhere.

### With a Google account
- **What we store in Firebase:** your resume content, tied to your Google UID.
- **What we receive from Google OAuth:** your display name, email, and profile photo URL.
- **What we never store:** passwords, payment info, or browsing data.
- Firestore security rules ensure only the authenticated owner can read or write their own data.
- You can export all your data at any time via the JSON export button.
- To delete your cloud data, delete all resumes in the app or email [sairamgudiputi8@gmail.com](mailto:sairamgudiputi8@gmail.com).

Full policy: see [`/privacy`](#/privacy) in the running app or [`src/pages/PrivacyPage.jsx`](src/pages/PrivacyPage.jsx).

---

## Routes

| Path | Description |
|---|---|
| `#/` | Dashboard — all resumes |
| `#/resume/:id` | Resume editor (`?tab=coverletter` opens the cover letter) |
| `#/jobs` | Job tracker — list and kanban |
| `#/jobs/new`, `#/jobs/:id`, `#/jobs/:id/edit` | Add, view and edit a job |
| `#/boards`, `#/boards/:id` | Boards |
| `#/terms` | Terms & Conditions |
| `#/privacy` | Privacy Policy |

Uses `HashRouter` so all routes work after a page refresh without any server configuration.

---

## Scripts

```bash
yarn dev          # dev server with HMR
yarn build        # production build → /dist
yarn preview      # serve the production build locally
yarn lint         # oxlint
yarn test         # node:test — the PDF suites and the unit suites
yarn test:unit    # unit suites only
yarn test:pw      # production build + Playwright browser suites
yarn test:e2e     # e2e build + Cypress
```

The PDF suites read PDFs back with Poppler and MuPDF: install `poppler-utils` and `mupdf-tools`
(Debian/Ubuntu) first. They are heavy — CI (`.github/workflows/ci.yml`) runs them in four shards.
To run one file: `node --test tests/pdf/06-pagination.test.mjs`.

---

## Contributing

Bug reports and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

*Built by Sairam Gudiputi · [sairamgudiputi8@gmail.com](mailto:sairamgudiputi8@gmail.com)*
