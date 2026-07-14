# CPWT-CV

A browser-based resume and cover letter builder. Create, design, and export professional resumes with optional Google account sync — your data stays in your browser until you choose to back it up to the cloud.

> **Developer knowledge base** (architecture, data model, progress, agent memory):  
> [`docs/knowledge/INDEX.md`](docs/knowledge/INDEX.md)

---

## Features

- **5 resume templates** — Classic, Minimal, Sidebar, Modern, Dark
- **Cover letter builder** — matches your resume's design settings
- **PDF & Word export** — print-quality A4 PDF and `.docx` download
- **JSON import / export** — backup and restore any resume
- **Design system** — accent colour, fonts (14 built-in + custom Google Fonts), heading styles, margins, spacing, per-section overrides
- **Drag-and-drop** — reorder sections and items
- **Google Sign-In + cloud sync** — resumes sync across devices via Firebase Firestore, with full offline-first support
- **URL routing** — each resume has its own URL; browser back/forward and refresh all work
- **Terms & Privacy pages** — accessible at `/terms` and `/privacy`

---

## Tech Stack

| Layer | Library |
|---|---|
| UI framework | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| Drag and drop | dnd-kit |
| Auth + cloud | Firebase v12 (Auth + Firestore) |
| Word export | docx + file-saver |
| Icons | lucide-react |
| Linting | oxlint |

---

## Local Development Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd flowcv
npm install
```

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
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 4. Build for production

```bash
npm run build       # outputs to /dist
npm run preview     # serve the built output locally
```

---

## Project Structure

```
src/
  App.jsx                  # Root router, dashboard, editor
  main.jsx                 # React entry point + HashRouter
  components/
    AuthBar.jsx            # Google sign-in button, avatar, sync status
    CoverLetterPanel.jsx   # Cover letter settings editor
    DesignPanel.jsx        # Design / template settings
    PersonalInfoEditor.jsx # Personal info form
    RichTextEditor.jsx     # Rich text editor for descriptions
    SectionEditor.jsx      # Section + item editors, drag-and-drop
  hooks/
    useAuth.js             # Firebase Auth state + Google sign-in
    useCloudSync.js        # Firestore sync, offline detection, merge logic
    useResumeStore.js      # All resume state, localStorage persistence
  pages/
    TermsPage.jsx          # Terms & Conditions
    PrivacyPage.jsx        # Privacy Policy
  templates/
    ClassicTemplate.jsx
    MinimalTemplate.jsx
    SidebarTemplate.jsx
    ModernTemplate.jsx
    DarkTemplate.jsx
    CoverLetterTemplate.jsx
  utils/
    defaultData.js         # ATS_DEFAULTS, default resume data, section factories
    firebase.js            # Firebase app init (Auth + Firestore with offline cache)
    fonts.js               # Built-in fonts + custom Google Font management
    pdfExport.js           # Print-based A4 PDF export
    wordExport.js          # .docx export via docx library
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
| `#/resume/:id` | Resume editor |
| `#/terms` | Terms & Conditions |
| `#/privacy` | Privacy Policy |

Uses `HashRouter` so all routes work after a page refresh without any server configuration.

---

## Scripts

```bash
npm run dev      # start dev server with HMR
npm run build    # production build → /dist
npm run preview  # preview production build locally
npm run lint     # run oxlint
```

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

*Built by Sairam Gudiputi · [sairamgudiputi8@gmail.com](mailto:sairamgudiputi8@gmail.com)*
