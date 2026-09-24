import { Link, useLocation } from 'react-router-dom';
import { Briefcase, FileText, ListChecks, PanelLeftClose, PanelLeftOpen, Plus, SquareKanban, Star, X } from 'lucide-react';
import { IconButton, Tooltip, cx } from '../ui/index.js';
import { orderProjects } from './projects.js';

const NAV = [
  { to: '/', label: 'Résumés', icon: FileText, match: (p) => p === '/' },
  { to: '/jobs', label: 'Job Tracker', icon: Briefcase, match: (p) => p === '/jobs' || p.startsWith('/jobs/') },
  { to: '/boards', label: 'Boards', icon: SquareKanban, match: (p) => p === '/boards' },
  { to: '/work', label: 'Your work', icon: ListChecks, match: (p) => p === '/work' },
];

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60';

/** A project's path, and whether `pathname` is inside it (its board, backlog or settings). */
const projectPath = (id) => `/boards/${encodeURIComponent(id)}`;
const inProject = (pathname, id) => pathname === projectPath(id) || pathname.startsWith(`${projectPath(id)}/`);

/**
 * One row of the sidebar: icon + label, or the icon alone in the collapsed rail, named there by
 * `railLabel` (aria-label and tooltip; a project adds its KEY, shown beside the name when expanded).
 * The current page is aria-current="page", drawn indigo on indigo-50.
 */
function NavItem({ to, label, railLabel = label, icon: Icon, lead, trail, active, collapsed }) {
  const link = (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? railLabel : undefined}
      className={cx(
        'group flex h-8 items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors duration-150 pointer-coarse:h-10',
        collapsed ? 'w-10 justify-center self-center' : 'px-2',
        active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        FOCUS,
      )}
    >
      {lead ?? (Icon && <Icon size={16} aria-hidden="true" className={cx('shrink-0', active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600')} />)}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && trail}
    </Link>
  );
  return collapsed ? <Tooltip content={railLabel} placement="right">{link}</Tooltip> : link;
}

/** A project's mark: a colour dot beside its name, or a lettered colour square in the rail. */
function ProjectMark({ project, collapsed }) {
  const color = project.color ?? '#94a3b8';
  if (!collapsed) return <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />;
  const letter = Array.from((project.key || project.name).trim())[0]?.toUpperCase() ?? '?';
  return (
    <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold text-white shadow-sm" style={{ backgroundColor: color }}>
      {letter}
    </span>
  );
}

/**
 * What the sidebar holds — the same in the desktop column (expanded or the 64 px rail) and in the
 * phone's drawer: the brand (→ the résumés), the four sections, the Projects group (starred first,
 * then recent; "+ New project"), and at the bottom the collapse toggle (desktop) — or the drawer's
 * close button at the top.
 */
export function SidebarContent({ projects = [], collapsed = false, onToggleCollapsed, onClose, newProjectTo = '/boards?create=1' }) {
  const { pathname } = useLocation();
  const { shown, hidden } = orderProjects(projects, collapsed ? 5 : 8);
  const projectActive = shown.some((p) => inProject(pathname, p.id));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cx('flex h-14 shrink-0 items-center gap-2', collapsed ? 'justify-center px-2' : 'px-3')}>
        <Link to="/" aria-label="CPWT-CV — résumés" className={cx('flex min-w-0 items-center gap-2.5 rounded-lg p-1', FOCUS)}>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[11px] font-bold tracking-tight text-white shadow-sm">CV</span>
          {!collapsed && <span className="truncate text-[15px] font-semibold tracking-tight text-slate-900">CPWT-CV</span>}
        </Link>
        {onClose && <IconButton icon={X} label="Close navigation" onClick={onClose} className="ml-auto" tooltip={false} />}
      </div>

      <nav aria-label="Workspace" className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 pb-3">
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = item.to === '/boards'
              ? item.match(pathname) || (pathname.startsWith('/boards/') && !projectActive)
              : item.match(pathname);
            return (
              <li key={item.to} className="flex flex-col">
                <NavItem {...item} active={active} collapsed={collapsed} />
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex flex-col">
          {collapsed ? (
            <div aria-hidden="true" className="mx-auto mb-2 h-px w-6 bg-slate-200" />
          ) : (
            <h2 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Projects</h2>
          )}
          <ul className="flex flex-col gap-0.5" aria-label={collapsed ? 'Projects' : undefined}>
            {shown.map((project) => (
              <li key={project.id} className="flex flex-col">
                <NavItem
                  to={projectPath(project.id)}
                  label={project.name}
                  railLabel={project.key ? `${project.name} · ${project.key}` : project.name}
                  lead={<ProjectMark project={project} collapsed={collapsed} />}
                  trail={(
                    <span className="flex shrink-0 items-center gap-1.5">
                      {project.starred && (
                        <>
                          <Star size={12} aria-hidden="true" className="fill-amber-400 text-amber-400" />
                          <span className="sr-only">Starred</span>
                        </>
                      )}
                      {project.key && <span className="font-mono text-[11px] font-medium text-slate-500">{project.key}</span>}
                    </span>
                  )}
                  active={inProject(pathname, project.id)}
                  collapsed={collapsed}
                />
              </li>
            ))}
            {hidden > 0 && !collapsed && (
              <li className="flex flex-col">
                <Link to="/boards" className={cx('flex h-8 items-center rounded-md px-2 text-[13px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 pointer-coarse:h-10', FOCUS)}>
                  View all projects ({projects.length})
                </Link>
              </li>
            )}
            <li className="flex flex-col">
              <NavItem
                to={newProjectTo}
                label="New project"
                lead={<Plus size={16} aria-hidden="true" className="shrink-0 text-slate-400 group-hover:text-slate-600" />}
                active={false}
                collapsed={collapsed}
              />
            </li>
          </ul>
        </div>
      </nav>

      {onToggleCollapsed && (
        <div className={cx('flex shrink-0 border-t border-slate-100 p-3', collapsed ? 'justify-center' : 'justify-end')}>
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
