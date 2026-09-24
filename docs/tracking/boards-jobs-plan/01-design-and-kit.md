# 01 · Design language, UI kit, workspace shell

The résumé editor and the résumé dashboard (`/`) are NOT restyled. Boards and the Job Tracker move into one
**workspace shell** so the two feel like one professional product (Jira / Linear density, calm neutrals).

## Design language

| Token | Value (Tailwind v4 classes) | Notes |
|---|---|---|
| App background | `bg-slate-50` | surfaces are white; no warm `#f5f3ef` any more in these pages |
| Surface | `bg-white border border-slate-200 rounded-xl` | cards 10–12 px radius, controls 8 px (`rounded-lg`), modals 16 px (`rounded-2xl`) |
| Text | `text-slate-900` / `-700` body / `-500` meta | **no text below 11 px**, no `text-gray-300` on white for real content (contrast) |
| Accent | indigo-600 (hover 700), focus ring `ring-indigo-500/60` | keeps the app's brand |
| Semantic | red-600 danger, amber-600 warning, emerald-600 success, sky-600 info | |
| Elevation | `shadow-sm` resting, `shadow-md` hover lift, `shadow-xl` popovers/drag overlay | |
| Type scale | 20/600 page title · 15/600 section · 14 body · 13 dense rows · 12/11 meta (500) | system-ui stack as the app |
| Spacing | 4-px grid; page gutter 16 (mobile) / 24 (desktop) | |
| Motion | 150 ms ease-out hover/press; 180 ms fade+scale(0.98→1) dialogs; 220 ms slide for drawers/sheets | all disabled under `prefers-reduced-motion` |

- Every interactive element: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60`.
- Hit targets ≥ 36 px on desktop, ≥ 44 px on touch (`pointer: coarse`).
- Icons: `lucide-react` (already a dependency) at 14–16 px; icon-only buttons always have `aria-label` + tooltip.
- Hover-revealed controls use `opacity-0 group-hover:opacity-100 no-hover:opacity-100 focus-within:opacity-100`
  (the `no-hover` variant is in `src/index.css`; `tests/unit/touch-reveal.unit.mjs` enforces it).
- Colour is never the only signal: labels carry names, status carries text, priority carries an icon + tooltip.

## The kit — `src/components/ui/` (KIT agent)

One file per component, each ≤ 300 lines, plus `index.js` re-exporting all of them. Accessible by default.

| Component | Contract |
|---|---|
| `Button` | `variant` primary/secondary/ghost/danger/subtle, `size` sm/md, `leftIcon`, `loading`, forwards ref, `type="button"` default |
| `IconButton` | icon-only, required `label` (→ `aria-label` + `Tooltip`) |
| `Tooltip` | hover/focus, 400 ms delay, `role="tooltip"`, `aria-describedby`; no-op on touch |
| `Dialog` | portal, overlay, **focus trap**, Escape + overlay click close (configurable), restores focus to the opener, `aria-modal`, `aria-labelledby`; `size` sm/md/lg/xl/full; becomes a bottom sheet below `md` when `sheet` |
| `ConfirmDialog` + `useConfirm()` | promise API: `await confirm({ title, body, confirmLabel, tone: 'danger' })` → boolean. Replaces `window.confirm` |
| `Toast` + `ToastProvider` + `useToast()` | `toast({ title, description, action: { label: 'Undo', onClick }, tone })`, auto-dismiss 5 s, pause on hover, `role="status"` live region, stacked bottom-right (bottom-center on mobile) |
| `Menu` (dropdown) | trigger + items (`icon`, `label`, `shortcut`, `danger`, `disabled`, separators, sub-labels), arrow-key navigation, typeahead, Escape, click-outside; positions itself inside the viewport |
| `Popover` | generic anchored panel (used by pickers/filters); same dismissal rules as Menu |
| `Select` | styled native `<select>` wrapper (label, hint, error) — keep native for a11y and mobile |
| `MultiSelectPopover` | checkable list with search box + "create" row (labels, filters) |
| `TextField` / `TextArea` | label, hint, error, leading icon, `autoGrow` for TextArea |
| `InlineEdit` | click/Enter to edit, Enter commits, Escape reverts, blur commits, blank → revert (never saves ''), `multiline` option |
| `Badge` / `Chip` | tones; `Chip` removable (`onRemove` with label) |
| `Avatar` | initials + deterministic colour from a string; sizes |
| `Tabs` | `role="tablist"`/`tab`/`tabpanel`, arrow keys, `aria-selected`, controlled |
| `SegmentedControl` | radio-group semantics (view toggles) |
| `SearchInput` | icon, clear button, `/` hotkey focus option, Escape clears |
| `EmptyState` | icon, title, body, action |
| `Kbd` | keyboard-key glyph |
| `Skeleton` | shimmer block (reduced-motion aware) |
| `ProgressBar` | value/max, `aria-valuenow` |
| `DatePill` | ISO `YYYY-MM-DD` → "Sep 24" / "Today" / "Tomorrow" / "Yesterday" / "3d overdue", tone by `deadlineState` (`src/utils/dates.js`) |

Hooks: `src/hooks/useHotkeys.js` (single-key shortcuts ignored while typing in inputs/textareas/contenteditable,
`?` help), `src/hooks/useUrlState.js` (read/write one search param, replace not push).

## Workspace shell — `src/components/shell/` (KIT agent)

- `WorkspaceLayout.jsx`: a layout route element — `Sidebar` + `<main>` with `<Outlet/>`, `ToastProvider` and the
  confirm host mounted once. Full viewport height (`h-dvh`), main scrolls (`overflow-y-auto`), pages may opt into
  a fixed-height layout (the board view does its own horizontal scrolling).
- `Sidebar.jsx`: 248 px, collapsible to a 64 px icon rail (state remembered in localStorage, try/catch);
  below `md` an off-canvas drawer opened from a hamburger in `PageHeader`. Contents: brand (→ `/`), nav
  **Résumés** (`/`), **Job Tracker** (`/jobs`), **Boards** (`/boards`), **Your work** (`/work`); then a
  **Projects** group listing starred boards first, then recent (colour dot + name + KEY), "+ New project".
  Reads boards through a tiny selector prop/callback so KIT does not depend on the v2 store shape: the layout
  accepts `projects` = `[{ id, name, key, color, starred }]` computed in `AppRoutes` from `useBoardStore()`
  (keep that mapping defensive: v1 boards have `title` and no `key` → show title, no key).
- `PageHeader.jsx`: sticky top bar inside `<main>`: breadcrumbs (`[{ label, to }]`), title (optionally
  `InlineEdit`), subtitle, right-side `actions` slot, optional `tabs` row under it. Mobile: hamburger at left.
- Active nav item: `aria-current="page"`, indigo text + subtle indigo-50 background.

## Routes (`src/AppRoutes.jsx`)

`/` (Dashboard), `/resume/:id`, `/terms`, `/privacy` stay outside the shell. Inside a `<Route element={<WorkspaceLayout/>}>`:

| Path | Page | Owner |
|---|---|---|
| `/jobs` | JobTracker (`?view=board|table`, `?q=`, `?status=a,b`, `?sort=`) | JOBS-UI |
| `/jobs/new`, `/jobs/:id/edit` | JobForm | JOBS-UI |
| `/jobs/:id` | JobDetail (`?tab=`) | JOBS-UI |
| `/boards` | Projects (list + create) | BOARDS-UI-B |
| `/work` | Your work (across projects) | BOARDS-UI-B |
| `/boards/:id` | Board view | BOARDS-UI-A |
| `/boards/:id/backlog` | Backlog (scrum) / List (kanban) | BOARDS-UI-B |
| `/boards/:id/settings` | Project settings | BOARDS-UI-B |

Any board-area page opens the issue modal from `?issue=KEY-12` (shareable, Back closes it).
KIT registers `/work`, `/boards/:id/backlog`, `/boards/:id/settings` pointing at the existing `Boards`/`Board`
pages as placeholders only if needed to keep the build green; BOARDS-UI-B replaces them.
