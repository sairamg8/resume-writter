import { Link, NavLink, useLocation } from 'react-router-dom';
import { Briefcase, ChevronDown, ChevronRight, FileText, LayoutGrid, ListChecks, PanelLeftClose, PanelLeftOpen, Plus, Star, X } from 'lucide-react';
import { IconButton, Tooltip, cx } from '../ui/index.js';
import { orderProjects } from './projects.js';
import { PROJECT_SETTINGS, PROJECT_VIEWS, inProject, projectPath } from './projectViews.js';

const NAV = [
  { to: '/work', label: 'Your work', icon: ListChecks, match: (p) => p === '/work' },
  { to: '/boards', label: 'Projects', icon: LayoutGrid, match: (p) => p === '/boards' },
  { to: '/jobs', label: 'Job Tracker', icon: Briefcase, match: (p) => p === '/jobs' || p.startsWith('/jobs/') },
  { to: '/', label: 'Résumés', icon: FileText, match: (p) => p === '/' },
];

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60';

/** A row's look: brand blue on its subtle fill, with a bar at the left edge, when it is the page. */
const rowClass = (active, collapsed, extra) => cx(
  'group relative flex h-9 items-center gap-2.5 rounded text-sm font-medium transition-colors duration-150 pointer-coarse:h-10',
  collapsed ? 'w-10 justify-center self-center' : 'px-2',
  active
    ? 'bg-brand-subtle text-brand before:absolute before:top-2 before:bottom-2 before:-left-2 before:w-1 before:rounded-r before:bg-brand'
    : 'text-ink-subtle hover:bg-neutral-fill hover:text-ink',
  FOCUS, extra,
);

/**
 * One row of the sidebar: icon + label, or the icon alone in the collapsed rail, named there by
 * `railLabel` (aria-label and tooltip; a project adds its KEY, shown beside the name when expanded).
 * The current page is aria-current="page".
 */
function NavItem({ to, label, railLabel = label, icon: Icon, lead, trail, active, collapsed, className }) {
  const link = (
    <Link to={to} aria-current={active ? 'page' : undefined} aria-label={collapsed ? railLabel : undefined} className={rowClass(active, collapsed, className)}>
      {lead ?? (Icon && <Icon size={16} aria-hidden="true" className="shrink-0" />)}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && trail}
    </Link>
  );
  return collapsed ? <Tooltip content={railLabel} placement="right">{link}</Tooltip> : link;
}

/** A project's avatar: a lettered square in its colour. */
function ProjectMark({ project, size = 'size-6' }) {
  const color = project.color ?? '#94a3b8';
  const letter = Array.from((project.key || project.name).trim())[0]?.toUpperCase() ?? '?';
  return (
    <span aria-hidden="true" className={cx('flex shrink-0 items-center justify-center rounded text-[11px] font-bold text-white', size)} style={{ backgroundColor: color }}>
      {letter}
    </span>
  );
}

/** The views of the project the page is in, as a tree under its row (Summary … List, settings). */
function ProjectViews({ project }) {
  return (
    <ul aria-label={`${project.name} views`} className="mt-0.5 mb-1 ml-5 flex flex-col gap-0.5 border-l border-line pl-2">
      {[...PROJECT_VIEWS, PROJECT_SETTINGS].map((view) => (
        <li key={view.id} className="flex flex-col">
          <NavLink
            to={projectPath(project.id, view.path)}
            end={view.end ?? true}
            className={({ isActive }) => rowClass(isActive, false, 'h-8 text-[13px]')}
          >
            <view.icon size={15} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{view.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * What the sidebar holds — the same in the desktop column (expanded or the 64 px rail) and in the
 * phone's drawer: the four sections, the Projects group (starred first, then recent; the project
 * the page is in opens as a tree of its views; "+ Create project"), and at the bottom the collapse
 * toggle (desktop) — or the drawer's brand and close button at the top.
 */
export function SidebarContent({ projects = [], collapsed = false, onToggleCollapsed, onClose, newProjectTo = '/boards?create=1' }) {
  const { pathname } = useLocation();
  const { shown, hidden } = orderProjects(projects, collapsed ? 5 : 8);
  const current = projects.find((p) => inProject(pathname, p.id));
  // The project the page is in stays listed even when it is not among the recent ones.
  const listed = current && !shown.includes(current) ? [...shown, current] : shown;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {onClose && (
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3">
          <Link to="/" aria-label="CPWT-CV — résumés" className={cx('flex min-w-0 items-center gap-2.5 rounded-lg p-1', FOCUS)}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand text-[11px] font-bold tracking-tight text-white">CV</span>
            <span className="truncate text-[15px] font-semibold tracking-tight text-ink">CPWT-CV</span>
          </Link>
          <IconButton icon={X} label="Close navigation" onClick={onClose} className="ml-auto" tooltip={false} />
        </div>
      )}

      <nav aria-label="Workspace" className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 pt-3 pb-3">
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => (
            <li key={item.to} className="flex flex-col">
              <NavItem {...item} active={item.match(pathname) || (item.to === '/boards' && pathname.startsWith('/boards/') && !current)} collapsed={collapsed} />
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col">
          {collapsed ? (
            <div aria-hidden="true" className="mx-auto mb-2 h-px w-6 bg-line" />
          ) : (
            <h2 className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtlest">Projects</h2>
          )}
          <ul className="flex flex-col gap-0.5" aria-label={collapsed ? 'Projects' : undefined}>
            {listed.map((project) => {
              const open = project === current;
              return (
                <li key={project.id} className="flex flex-col">
                  <NavItem
                    to={projectPath(project.id)}
                    label={project.name}
                    railLabel={project.key ? `${project.name} · ${project.key}` : project.name}
                    lead={<ProjectMark project={project} />}
                    trail={(
                      <span className="flex shrink-0 items-center gap-1.5">
                        {project.starred && (
                          <>
                            <Star size={12} aria-hidden="true" className="fill-amber-400 text-amber-400" />
                            <span className="sr-only">Starred</span>
                          </>
                        )}
                        {project.key && <span className="font-mono text-[11px] font-medium text-ink-subtlest">{project.key}</span>}
                        {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" className="opacity-0 group-hover:opacity-100 no-hover:opacity-100" />}
                      </span>
                    )}
                    active={false}
                    collapsed={collapsed}
                    className={open ? 'text-ink' : undefined}
                  />
                  {open && !collapsed && <ProjectViews project={project} />}
                </li>
              );
            })}
            {hidden > 0 && !collapsed && (
              <li className="flex flex-col">
                <Link to="/boards" className={cx('flex h-8 items-center rounded px-2 text-[13px] text-ink-subtlest transition-colors hover:bg-neutral-fill hover:text-ink pointer-coarse:h-10', FOCUS)}>
                  View all projects ({projects.length})
                </Link>
              </li>
            )}
            <li className="flex flex-col">
              <NavItem
                to={newProjectTo}
                label="Create project"
                lead={<Plus size={16} aria-hidden="true" className="shrink-0" />}
                active={false}
                collapsed={collapsed}
              />
            </li>
          </ul>
        </div>
      </nav>

      {onToggleCollapsed && (
        <div className={cx('flex shrink-0 border-t border-line p-3', collapsed ? 'justify-center' : 'justify-end')}>
          <IconButton
            icon={collapsed ? PanelLeftOpen : PanelLeftClose}
            label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            shortcut="["
            tooltipPlacement={collapsed ? 'right' : 'top'}
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
          />
        </div>
      )}
    </div>
  );
}
