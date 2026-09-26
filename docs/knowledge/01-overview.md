# 01 — Project Overview

## What this is

**CPWT-CV** is a browser-based **resume builder**, **cover letter builder**, and **job application tracker**. It is inspired by free tools like [FlowCV](https://flowcv.com/) but is an independent project (not affiliated with FlowCV).

Primary differentiators for developers/users:

- Offline-first: data stays in the browser until optional Google sign-in
- Free forever model (no paywall in this codebase)
- Export to PDF, Word, Markdown, ATS plain text, JSON Resume and a JSON backup
- Built-in job tracker (beyond classic FlowCV-style resume-only UX)
- Open implementation (React) intended for free sharing

## Product name matrix

| Context | Name |
|---------|------|
| UI brand string | CPWT-CV |
| npm `package.json` name | `flowcv` |
| localStorage prefix | `cpwtcv_*` |
| Email contact (privacy/terms) | the build's `VITE_CONTACT_EMAIL` (`src/utils/siteOwner.js`); unset, the pages name none |
| Inspiration | FlowCV (flowcv.com) |

## Tech stack summary

See [AGENT_MEMORY.md](../tracking/AGENT_MEMORY.md) for the locked table. High level:

- SPA with client-side hash routing (deployable on any static host)
- No custom backend server — Firebase is optional BaaS
- Heavy client rendering: the live preview is the exported PDF itself (react-pdf, painted by pdf.js)

## Privacy model (product promise)

| Mode | Behavior |
|------|----------|
| Signed out | `localStorage` only; no resume upload |
| Signed in (Google) | Resumes mirrored to Firestore under the user’s UID; OAuth name/email/photo used for account UI |
| Jobs | Always local-only today |

Security rules: `firestore.rules` — only `request.auth.uid == uid` may read/write `users/{uid}/**`;
a published résumé (`public/{shareId}`, Share a public link) is readable by anyone who has its id and
written only by its owner.

## Feature pillars

1. **Compose** — multi-resume dashboard, rich sections, photo, contact fields  
2. **Design** — templates + typography/color/spacing system  
3. **Export** — PDF (react-pdf), DOCX, Markdown, ATS text, JSON Resume, JSON backup  
4. **Track** — job applications with pipeline statuses, and boards of cards  
5. **Sync** — optional cross-device resume backup  

## Audience for open source

Fellow developers who want:

- A free self-hosted or cloud-hosted CV tool
- A reference implementation of resume PDF generation in React
- A base to fork (templates, ATS defaults, job board integrations, etc.)

## Out of scope (current codebase)

- Server-side rendering / multi-tenant SaaS billing
- Recruiter ATS product
- Native mobile apps
- Cloud sync for job applications
- Official FlowCV API compatibility
