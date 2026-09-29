import { useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, CircleHelp, Menu as MenuIcon, Plus, Search, X } from 'lucide-react';
import { Button, IconButton, Kbd, Menu, ShortcutsDialog, controlClass, cx, isImeKey, useHotkeys } from '../ui/index.js';
import { IssueTypeIcon } from '../tracker/TrackerIcons.jsx';
import { useWorkspace } from './workspaceContext.js';
import { orderProjects } from './projects.js';
import { CollectionSyncDot } from './CollectionSyncDot.jsx';
import AuthBar from '../AuthBar.jsx';
import { projectPath } from './projectViews.js';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60';

const SHORTCUTS = [
  { title: 'Global', shortcuts: [
    { combo: 'c', label: 'Create an issue' },
    { combo: '/', label: 'Search' },
    { combo: '[', label: 'Collapse or expand the sidebar' },
    { combo: '?', label: 'Show keyboard shortcuts' },
  ] },
  { title: 'Issues', shortcuts: [
    { combo: 'Enter', label: 'Open the focused issue' },
    { combo: 'Escape', label: 'Close the issue' },
    { combo: 'Space', label: 'Pick up a card to move it (arrows, then Space to drop)' },
  ] },
];

/** A top-bar link: its section's pages mark it current. */
function TopLink({ to, label, active }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'relative flex h-8 items-center rounded px-2.5 text-sm font-medium transition-colors',
        active ? 'text-brand after:absolute after:inset-x-1 after:-bottom-3 after:h-0.5 after:rounded-full after:bg-brand' : 'text-ink-subtle hover:bg-neutral-fill hover:text-ink',
        FOCUS,
      )}
    >
      {label}
    </Link>
  );
}

/**
 * The search box and its results (an issue whose key is typed in full, then projects, then issues;
 * utils/workspaceSearch), searched as the user types. Below sm the
 * bar has no room for it: a search button (or '/') opens it as a bar over the top bar, and Escape, its X, a
 * result picked or a tap elsewhere puts it away (R4-DPH-04).
 */
function QuickSearch({ search }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();
  const results = open && search ? search(query) : [];
  // The highlighted row, within the list as it is now: the list can shrink while it is open (an issue
  // deleted, a sync, another tab), and an index past its end made Enter do nothing (R4-LO-25).
  const at = Math.max(0, Math.min(active, results.length - 1));
  // Shown, then focused, in one go: below sm the box is display:none until the phone bar opens, and
  // iOS raises the keyboard only for a focus the tap itself makes. '/' opens it too, so a narrow
  // window or a phone with a keyboard does not focus a box that is not shown (R4-DPH-04).
  const openAndFocus = () => {
    flushSync(() => setPhoneOpen(true));
    inputRef.current?.focus();
  };
  useHotkeys({ '/': () => { openAndFocus(); inputRef.current?.select(); } });
  // The panel scrolls when its rows do not fit (R5-JOB-03): the arrow keys and typing keep the
  // highlighted row in view, so Enter never opens a result the user cannot see. Only those: a row
  // highlighted by the pointer is never scrolled, or resting it on a row cut off at the panel's edge
  // scrolled the list, the browser's mouse move after the scroll highlighted the next row, and the
  // list crept to its end on its own (R5-JOB-03 review).
  const keyed = useRef(false);
  useEffect(() => {
    if (!keyed.current) return;
    keyed.current = false;
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  });

  const go = (hit) => {
    if (!hit) return;
    setQuery('');
    setOpen(false);
    setPhoneOpen(false);
    inputRef.current?.blur();
    navigate(hit.to);
  };
  const close = () => { setQuery(''); setOpen(false); setPhoneOpen(false); inputRef.current?.blur(); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') keyed.current = true;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.max(0, Math.min(at + 1, results.length - 1))); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(at - 1, 0)); }
    if (e.key === 'Enter' && !isImeKey(e)) { e.preventDefault(); go(results[at]); }
    if (e.key === 'Escape' && !isImeKey(e)) close();
  };

  return (
    <>
      <IconButton icon={Search} label="Search" onClick={openAndFocus} className="sm:hidden" tooltip={false} />
      <div
        className={cx(
          'relative w-full max-w-[20rem] sm:block',
          // On a phone, opened: fixed over the top bar's row (its h-8 box 12 px from the top of the
          // 56 px bar), as wide as the screen but for the bar's 8 px gutters.
          phoneOpen ? 'max-sm:fixed max-sm:inset-x-2 max-sm:top-3 max-sm:z-40 max-sm:w-auto max-sm:max-w-none' : 'hidden',
        )}
      >
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-subtlest" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search issues and projects"
          aria-expanded={results.length > 0}
          aria-controls={results.length ? listId : undefined}
          aria-activedescendant={results.length ? `${listId}-${at}` : undefined}
          placeholder="Search"
          value={query}
          onChange={(e) => { keyed.current = true; setQuery(e.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => { setOpen(false); setPhoneOpen(false); }, 120)}
          onKeyDown={onKeyDown}
          // The kit's control, as the page toolbars' SearchInput draws it (R4-DVIS-15): its border and
          // 13 px text, 16 px on touch screens, where iOS Safari zooms into any smaller field (R4-DPH-11).
          className={cx(controlClass({ size: 'sm' }), 'h-8 pr-8 pl-8')}
        />
        {/* The kit's key cap, hidden below md as SearchInput's is (no keyboard to press it on a phone or
            a tablet); the wrapper keeps it silent to screen readers, as the bare cap was. */}
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2 max-md:hidden">
          <Kbd>/</Kbd>
        </span>
        {phoneOpen && (
          <button
            type="button"
            aria-label="Close search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={close}
            className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 sm:hidden"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
        {open && query.trim() && (
          // At most 24rem, or what is left of the window under the box (it starts ~52 px down), and it
          // scrolls inside: 8 two-line rows ran past a short window's bottom, where the shell clips
          // them and nothing could reach them (R5-JOB-03).
          <div className="absolute top-10 right-0 left-0 z-50 max-h-[min(24rem,calc(100dvh-4.5rem))] overflow-y-auto overscroll-contain rounded-md border border-line bg-white py-1 shadow-xl">
            {results.length === 0 ? (
              <p className="px-3 py-3 text-sm text-ink-subtlest">No issues or projects match “{query.trim()}”.</p>
            ) : (
              <ul ref={listRef} id={listId} role="listbox" aria-label="Search results">
                {results.map((hit, i) => (
                  <li
                    key={`${hit.kind}-${hit.id}`}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === at}
                    onMouseDown={(e) => { e.preventDefault(); go(hit); }}
                    onMouseEnter={() => { keyed.current = false; setActive(i); }}
                    className={cx('flex cursor-pointer items-center gap-2.5 px-3 py-1.5', i === at ? 'bg-brand-subtle' : 'hover:bg-hovered')}
                  >
                    {hit.kind === 'issue'
                      ? <IssueTypeIcon type={hit.type} />
                      : <span aria-hidden="true" className="size-4 shrink-0 rounded-[3px]" style={{ backgroundColor: hit.color || '#94a3b8' }} />}
                    <span className="min-w-0 flex-1">
                      <span className={cx('block truncate text-sm text-ink', hit.done && 'line-through decoration-ink-subtlest')}>{hit.title}</span>
                      <span className="block truncate text-[11px] text-ink-subtlest">{hit.kind === 'issue' ? `${hit.key} · ${hit.subtitle}` : `Project · ${hit.subtitle}`}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * The workspace's top bar, across the whole window over the sidebar and the page: the menu
 * button (phones), the brand, Your work · Projects ▾ · Job Tracker · Résumés, the Create button
 * (a new issue — on the Job Tracker's pages, a new job), the quick search (`/`; on a phone behind a
 * search button), the jobs' and boards' cloud icon (CollectionSyncDot, signed in only), the
 * keyboard-shortcuts help (`?`) and the account: the Dashboard's and Editor's AuthBar, compact — Sign
 * in with Google while signed out, the avatar and its Sign out menu while signed in. The jobs and the
 * boards sync with the account, yet these pages had no way to sign in or out (R4-DUX-07).
 *
 * - `onCreate()`: open the create-issue dialog; `search(query)` → results (utils/workspaceSearch).
 * - `auth`: the account (useAuth). No résumé sync is passed: AuthBar's own cloud icon stays away,
 *   CollectionSyncDot shows these pages' sync.
 */
export function TopBar({ projects = [], onCreate, search, auth }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const [helpOpen, setHelpOpen] = useState(false);
  const inJobs = pathname === '/jobs' || pathname.startsWith('/jobs/');
  const create = () => (inJobs ? navigate('/jobs/new') : onCreate?.());
  useHotkeys({ c: create, '?': () => setHelpOpen(true) });

  const { shown } = orderProjects(projects, 6);
  const projectItems = [
    ...(shown.length ? [{ type: 'label', label: 'Recent' }] : []),
    ...shown.map((p) => ({ id: p.id, label: p.key ? `${p.name} (${p.key})` : p.name, onSelect: () => navigate(projectPath(p.id)) })),
    ...(shown.length ? [{ type: 'separator' }] : []),
    { id: 'all', label: 'View all projects', onSelect: () => navigate('/boards') },
    { id: 'new', label: 'Create project', icon: Plus, onSelect: () => navigate('/boards?create=1') },
  ];

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-1 border-b border-line bg-white px-2 sm:gap-2 sm:px-3">
      {workspace && <IconButton icon={MenuIcon} label="Open navigation" onClick={workspace.openNav} className="md:hidden" tooltip={false} />}
      <Link to="/" aria-label="CPWT-CV — résumés" className={cx('flex shrink-0 items-center gap-2 rounded p-1 pr-2', FOCUS)}>
        <span className="flex size-7 items-center justify-center rounded-md bg-brand text-[11px] font-bold tracking-tight text-white">CV</span>
        <span className="hidden text-[15px] font-semibold tracking-tight text-ink sm:inline">CPWT-CV</span>
      </Link>
      <nav aria-label="Top" className="hidden items-center gap-0.5 lg:flex">
        <TopLink to="/work" label="Your work" active={pathname === '/work'} />
        <Menu
          label="Projects"
          placement="bottom-start"
          items={projectItems}
          trigger={(
            <button
              type="button"
              className={cx(
                'relative flex h-8 items-center gap-1 rounded px-2.5 text-sm font-medium transition-colors',
                pathname.startsWith('/boards') ? 'text-brand after:absolute after:inset-x-1 after:-bottom-3 after:h-0.5 after:rounded-full after:bg-brand' : 'text-ink-subtle hover:bg-neutral-fill hover:text-ink',
                FOCUS,
              )}
            >
              Projects <ChevronDown size={14} aria-hidden="true" />
            </button>
          )}
        />
        <TopLink to="/jobs" label="Job Tracker" active={inJobs} />
        <TopLink to="/" label="Résumés" active={false} />
      </nav>
      <Button variant="primary" size="md" leftIcon={Plus} onClick={create} className="ml-1" title={inJobs ? 'Add a job (c)' : 'Create an issue (c)'}>
        <span className="hidden sm:inline">{inJobs ? 'Add job' : 'Create'}</span>
        <span className="sr-only sm:hidden">{inJobs ? 'Add job' : 'Create'}</span>
      </Button>
      <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1">
        <QuickSearch search={search} />
        <CollectionSyncDot />
        <IconButton icon={CircleHelp} label="Keyboard shortcuts" shortcut="?" onClick={() => setHelpOpen(true)} />
        {/* isOnline: the offline state is CollectionSyncDot's to show, from the browser's flag. */}
        {auth && <AuthBar {...auth} isOnline compact />}
      </div>
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} groups={SHORTCUTS} />
    </header>
  );
}
