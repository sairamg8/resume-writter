import { useRef } from 'react';
import { FOCUS_RING } from './Button.jsx';
import { cx } from './compose.js';

/** The look of one tab (shared with NavTabs, whose tabs are links): an underline when selected. */
export function tabClass(selected) {
  return cx(
    'relative inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-md px-1 text-[13px] font-medium transition-colors duration-150',
    'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors after:duration-150',
    'pointer-coarse:h-11',
    selected ? 'text-indigo-700 after:bg-indigo-600' : 'text-slate-500 hover:text-slate-900 after:bg-transparent hover:after:bg-slate-300',
    FOCUS_RING, 'focus-visible:ring-offset-0',
  );
}

/** A tab's count: "Comments 3". */
export function TabCount({ children }) {
  return <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold leading-4 text-slate-600">{children}</span>;
}

/** The ids tying tab `value` of the tab list `id` to its panel. */
export const tabIds = (id, value) => ({ tab: `${id}-tab-${value}`, panel: `${id}-panel-${value}` });

/**
 * A row of tabs over panels (the panels are TabPanel). Controlled: `value`, `onChange(value)`.
 *
 * - `id` (required): ties each tab to its TabPanel (same `tabsId`).
 * - `items`: `[{ value, label, icon, count, disabled }]`; `label` / `aria-label` names the list.
 * - Keyboard: ←/→ move and select (wrapping, skipping disabled tabs), Home/End jump; only the
 *   selected tab is in the Tab order (roving tabindex), as WAI-ARIA's tabs pattern says — the
 *   first enabled one while `value` matches none, so the list is never skipped by Tab.
 */
export function Tabs({ id, items, value, onChange, 'aria-label': ariaLabel, className }) {
  const refs = useRef({});
  const usable = items.filter((t) => !t.disabled);
  const tabStop = usable.some((t) => t.value === value) ? value : usable[0]?.value;

  const onKeyDown = (event) => {
    const at = usable.findIndex((t) => t.value === value);
    let next = null;
    if (!usable.length) return;
    if (event.key === 'ArrowRight') next = usable[(at + 1) % usable.length];
    else if (event.key === 'ArrowLeft') next = usable[at < 0 ? usable.length - 1 : (at - 1 + usable.length) % usable.length];
    else if (event.key === 'Home') next = usable[0];
    else if (event.key === 'End') next = usable[usable.length - 1];
    if (!next) return;
    event.preventDefault();
    onChange?.(next.value);
    refs.current[next.value]?.focus();
  };

  return (
    <div role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown} className={cx('flex items-end gap-5 overflow-x-auto', className)}>
      {items.map((tab) => {
        const selected = tab.value === value;
        const ids = tabIds(id, tab.value);
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            ref={(node) => { refs.current[tab.value] = node; }}
            id={ids.tab}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={ids.panel}
            tabIndex={tab.value === tabStop ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange?.(tab.value)}
            className={cx(tabClass(selected), 'disabled:pointer-events-none disabled:opacity-40')}
          >
            {Icon && <Icon size={15} aria-hidden="true" />}
            {tab.label}
            {tab.count != null && <TabCount>{tab.count}</TabCount>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The panel of tab `value` in the Tabs `tabsId`: rendered while selected (`current === value`), or
 * kept mounted but hidden with `keepMounted` (a form keeps its drafts).
 */
export function TabPanel({ tabsId, value, current, keepMounted = false, className, children }) {
  const selected = value === current;
  if (!selected && !keepMounted) return null;
  const ids = tabIds(tabsId, value);
  return (
    <div role="tabpanel" id={ids.panel} aria-labelledby={ids.tab} hidden={!selected} tabIndex={0} className={cx('focus-visible:outline-none', className)}>
      {children}
    </div>
  );
}
