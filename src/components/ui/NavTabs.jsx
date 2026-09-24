import { NavLink } from 'react-router-dom';
import { tabClass, TabCount } from './Tabs.jsx';
import { cx } from './compose.js';

/**
 * Tabs that are pages: a project's Board | Backlog | Settings. Each is a router link, the current
 * one marked aria-current="page" — links, not role="tab", because each opens its own address.
 *
 * - `items`: `[{ to, label, icon, count, end }]` — `end` matches the path exactly (the Board tab at
 *   /boards/:id must not stay selected on /boards/:id/settings).
 * - `aria-label` names the navigation ("Project views").
 */
export function NavTabs({ items, 'aria-label': ariaLabel, className }) {
  return (
    <nav aria-label={ariaLabel} className={cx('flex items-end gap-5 overflow-x-auto', className)}>
      {items.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => tabClass(isActive)}>
            {Icon && <Icon size={15} aria-hidden="true" />}
            {tab.label}
            {tab.count != null && <TabCount>{tab.count}</TabCount>}
          </NavLink>
        );
      })}
    </nav>
  );
}
