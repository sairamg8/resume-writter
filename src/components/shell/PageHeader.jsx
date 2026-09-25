import { Link } from 'react-router-dom';
import { InlineEdit, cx } from '../ui/index.js';

/** "Projects › Life admin": each crumb a link but the last, which is the page itself. */
function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm text-ink-subtle">
        {items.map((crumb, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className={cx('flex items-center gap-1', last ? 'min-w-0' : 'shrink-0')}>
              {i > 0 && <span aria-hidden="true" className="shrink-0 px-0.5 text-ink-subtlest">/</span>}
              {crumb.to && !last ? (
                <Link to={crumb.to} className="rounded transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60">
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
 */
export function PageHeader({ title, onTitleChange, titleLabel = 'Title', subtitle, icon, breadcrumbs, actions, tabs, className, children }) {
  return (
    <header className={cx('sticky top-0 z-20 shrink-0 bg-white', tabs && 'border-b border-line', className)}>
      <div className={cx('flex flex-col gap-1 px-4 pt-4 md:px-8', tabs ? 'pb-1' : 'pb-3')}>
        {breadcrumbs?.length > 0 && (
          <div className="flex items-center gap-2">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-1 basis-56 items-center gap-2 md:gap-3">
            {icon}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold leading-8 tracking-tight text-ink">
                {onTitleChange
                  ? <InlineEdit value={title} onCommit={onTitleChange} label={titleLabel} className="truncate" />
                  : title}
              </h1>
              {subtitle && <p className="truncate text-[13px] leading-5 text-ink-subtlest">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
        </div>
        {children}
      </div>
      {tabs && <div className="-mb-px px-4 md:px-8">{tabs}</div>}
    </header>
  );
}
