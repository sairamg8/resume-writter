import { useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Menu } from 'lucide-react';
import { IconButton, InlineEdit, cx } from '../ui/index.js';
import { useWorkspace } from './workspaceContext.js';

/** "Projects › Life admin": each crumb a link but the last, which is the page itself. */
function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-xs font-medium text-slate-500">
        {items.map((crumb, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className={cx('flex items-center gap-1', last ? 'min-w-0' : 'shrink-0')}>
              {i > 0 && <ChevronRight size={12} aria-hidden="true" className="shrink-0 text-slate-400" />}
              {crumb.to && !last ? (
                <Link to={crumb.to} className="rounded transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60">
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate" aria-current={last ? 'page' : undefined}>{crumb.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The top bar of a workspace page, sticky at the top of the shell's scroll box.
 *
 * - `title` (the page's h1); with `onTitleChange(next)` it is an InlineEdit (click to rename a
 *   project) named by `titleLabel`. `subtitle`: one muted line under it. `icon`: a node before it
 *   (an Avatar, a project's colour square).
 * - `breadcrumbs`: `[{ label, to }]` above the title — the last one is the page (no link).
 * - `actions`: buttons on the right (they wrap under the title on a phone).
 * - `tabs`: a row under the title that sits on the header's bottom border — a `<NavTabs>` or `<Tabs>`.
 * - `children`: anything else under the title row (a filter bar that should stick with it).
 * - On a phone (below md) a menu button at the left opens the workspace's navigation drawer.
 */
export function PageHeader({ title, onTitleChange, titleLabel = 'Title', subtitle, icon, breadcrumbs, actions, tabs, className, children }) {
  const workspace = useWorkspace();
  const register = workspace?.registerHeader;
  // Before paint, so the shell's fallback top bar never flashes under a real header.
  useLayoutEffect(() => register?.(), [register]);

  return (
    <header className={cx('sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur-md', className)}>
      <div className={cx('flex flex-col gap-1 px-4 pt-3 md:px-6', tabs ? 'pb-2' : 'pb-3')}>
        {breadcrumbs?.length > 0 && (
          <div className="flex items-center gap-2">
            {workspace && <span className="w-8 shrink-0 md:hidden" aria-hidden="true" />}
            <Breadcrumbs items={breadcrumbs} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-1 basis-56 items-center gap-2 md:gap-3">
            {workspace && (
              <IconButton icon={Menu} label="Open navigation" onClick={workspace.openNav} className="-ml-1.5 md:hidden" tooltip={false} />
            )}
            {icon}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold leading-7 tracking-tight text-slate-900">
                {onTitleChange
                  ? <InlineEdit value={title} onCommit={onTitleChange} label={titleLabel} className="truncate" />
                  : title}
              </h1>
              {subtitle && <p className="truncate text-[13px] leading-5 text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
        </div>
        {children}
      </div>
      {tabs && <div className="-mb-px px-4 md:px-6">{tabs}</div>}
    </header>
  );
}
