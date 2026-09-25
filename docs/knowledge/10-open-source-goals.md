# 10 — Open Source / Free Sharing Goals

## Owner intent

Share CPWT-CV **for free** with fellow developers so they can:

- Use it as a personal free CV tool
- Self-host or deploy on static hosting
- Fork and extend (templates, AI, company branding)

Inspiration: FlowCV’s free positioning, without claiming FlowCV affiliation.

## Packaging checklist (recommended order)

### 1. Repository hygiene

- [x] A git repository (github.com/sairamg8/resume-writter)
- [x] `.gitignore` (`node_modules`, `dist`, `.env*`, `private/`, test artefacts, …)
- [x] `LICENSE` (MIT)
- [x] `.env.example` with empty `VITE_FIREBASE_*` placeholders
- [ ] Remove or stop tracking secrets if any ever appear

### 2. Docs for contributors

- [x] Refresh README structure + job tracker routes + test scripts
- [x] `CONTRIBUTING.md` (dev setup, PR expectations, coding style)
- [x] Link this knowledge base from README
- [ ] Clarify product name (CPWT-CV) vs folder name (`flowcv`)

### 3. Product polish before announce

- [x] Resolve Dark template inconsistency (an unknown template id, the old seed's `dark` too, prints as Classic)
- [x] Ensure app works fully offline without Firebase env (`firebaseEnabled`: no Sign In, local only)
- [x] Replace the personal demo résumé seed: the first run is an empty dashboard
- [x] Owner-specific defaults (demo accounts, the Terms/Privacy contact, the dev sign-in) come from `VITE_*` env (`src/utils/siteOwner.js`, `.env.example`); unset, nobody's
- [ ] Confirm Terms/Privacy match intended hosting domain

### 4. Distribution

- [ ] Public GitHub/GitLab repo
- [ ] Tag `v0.1.0` when stable
- [ ] Deploy demo (e.g. Cloudflare Pages / Vercel / GitHub Pages — HashRouter friendly)
- [ ] Short demo GIF or Loom in README
- [ ] Announce to developer communities (Reddit, Discord, X) — emphasize free + open

### 5. Optional roadmap after v0.1

| Idea | Value |
|------|-------|
| Job Firestore sync | Parity with resumes |
| i18n | Broader audience |
| Import from LinkedIn PDF | Viral growth |
| Plugin/template packs | Community contribution surface |

## Branding & legal notes

- Do **not** use FlowCV trademarks/logos in the product.
- “Inspired by free resume builders like FlowCV” is OK in prose.
- Keep privacy claims honest: cloud sync only when signed in; jobs remain local until you add sync.

## Success criteria (sharing)

1. A new developer can clone → `corepack enable && yarn install` → `yarn dev` and build a resume without talking to you.
2. PDF/Word export works on a clean machine.
3. LICENSE and contribution path are obvious.
4. Knowledge base stays updated so AI and humans can extend safely.
