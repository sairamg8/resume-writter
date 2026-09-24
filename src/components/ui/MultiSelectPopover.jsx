import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { Popover } from './Popover.jsx';
import { cx } from './compose.js';

/** The options whose label holds `query` (case-blind), in their order. Exported for the unit test. */
export function filterOptions(options, query) {
  const q = query.trim().toLowerCase();
  return q ? options.filter((o) => String(o.label).toLowerCase().includes(q)) : options;
}

/** Whether "Create “query”" is offered: there is text, and no option is already called that. */
export function canCreate(options, query) {
  const q = query.trim().toLowerCase();
  return !!q && !options.some((o) => String(o.label).trim().toLowerCase() === q);
}

/**
 * A checkable list in a popover, with a search box and an optional "Create" row — an issue's
 * labels, the job tracker's status filter.
 *
 * - `trigger`: the element that opens it (a Button or Chip); `options`: `[{ value, label, color,
 *   icon, count }]` (`color` a dot, `count` a number at the right); `value`: the chosen values;
 *   `onChange(values)` after each tick, in the options' order.
 * - `onCreate(name)` adds the "Create “name”" row (Enter on it or a click), shown when no option has
 *   that name; the caller adds the option and usually ticks it.
 * - `title` over the list; a "Clear" link while anything is ticked (`clearable`, true).
 * - `searchPlaceholder`, `emptyText` ('No matches'), `placement`, `width` (264 px).
 * - Keyboard: typing filters, ↑/↓ move, Enter ticks, Escape clears the search, then closes.
 *   The search box is a combobox over a multi-select listbox (aria-activedescendant).
 */
export function MultiSelectPopover({
  trigger, options = [], value = [], onChange, onCreate, title, clearable = true, searchPlaceholder = 'Search…',
  emptyText = 'No matches', placement = 'bottom-start', width = 264, open, onOpenChange,
}) {
  return (
    <Popover trigger={trigger} placement={placement} open={open} onOpenChange={onOpenChange} label={title ?? searchPlaceholder}>
      <div style={{ width }} className="max-w-full">
        <PickerBody
          options={options} value={value} onChange={onChange} onCreate={onCreate} title={title}
          clearable={clearable} searchPlaceholder={searchPlaceholder} emptyText={emptyText}
        />
      </div>
    </Popover>
  );
}

function PickerBody({ options, value, onChange, onCreate, title, clearable, searchPlaceholder, emptyText }) {
  const [query, setQuery] = useState('');
  const [activeRaw, setActive] = useState(0);
  const listRef = useRef(null);
  const id = useId();
  const shown = useMemo(() => filterOptions(options, query), [options, query]);
  const creatable = !!onCreate && canCreate(options, query);
  const rows = creatable ? [...shown, { create: true, label: query.trim() }] : shown;
  const chosen = new Set(value);
  const active = Math.min(activeRaw, Math.max(rows.length - 1, 0));
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const toggle = (option) => {
    const next = chosen.has(option.value) ? value.filter((v) => v !== option.value) : [...value, option.value];
    const order = new Map(options.map((o, i) => [o.value, i]));
    onChange?.([...next].sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9)));
  };
  const pick = (row) => {
    if (!row) return;
    if (row.create) {
      onCreate(row.label);
      setQuery('');
      setActive(0);
    } else toggle(row);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (rows.length) setActive((active + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(rows[active]);
    } else if (event.key === 'Escape' && query) {
      event.preventDefault();
      event.stopPropagation();
      setQuery('');
    }
  };

  const optionId = (i) => `${id}-opt-${i}`;
  return (
    <div className="flex max-h-[inherit] flex-col">
      {(title || (clearable && value.length > 0)) && (
        <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
          {title && <span className="text-xs font-semibold text-slate-500">{title}</span>}
          {clearable && value.length > 0 && (
            <button type="button" onClick={() => onChange?.([])} className="ml-auto rounded text-xs font-medium text-indigo-600 hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60">
              Clear
            </button>
          )}
        </div>
      )}
      <div className="relative m-2 mb-1 flex items-center">
        <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 text-slate-400" />
        <input
          data-autofocus
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={rows.length ? optionId(active) : undefined}
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pr-2 pl-8 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 pointer-coarse:h-10 pointer-coarse:text-base"
        />
      </div>
      <ul ref={listRef} id={`${id}-list`} role="listbox" aria-multiselectable="true" aria-label={title ?? searchPlaceholder} className="max-h-64 overflow-y-auto p-1 pt-0">
        {rows.map((row, i) => {
          const selected = !row.create && chosen.has(row.value);
          const Icon = row.icon;
          return (
            <li
              key={row.create ? '__create' : String(row.value)}
              id={optionId(i)}
              data-index={i}
              role="option"
              aria-selected={row.create ? undefined : selected}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(row)}
              onPointerMove={() => { if (active !== i) setActive(i); }}
              className={cx(
                'flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[13px] text-slate-700 pointer-coarse:min-h-11',
                i === active && 'bg-slate-100 text-slate-900',
              )}
            >
              {row.create ? (
                <>
                  <Plus size={14} aria-hidden="true" className="shrink-0 text-indigo-600" />
                  <span className="min-w-0 truncate">Create <span className="font-semibold">“{row.label}”</span></span>
                </>
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className={cx(
                      'flex size-4 shrink-0 items-center justify-center rounded border transition-colors duration-100',
                      selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white',
                    )}
                  >
                    {selected && <Check size={11} strokeWidth={3} />}
                  </span>
                  {row.color && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />}
                  {Icon && <Icon size={14} aria-hidden="true" className="shrink-0 text-slate-400" />}
                  <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  {row.count != null && <span className="shrink-0 text-xs tabular-nums text-slate-500">{row.count}</span>}
                </>
              )}
            </li>
          );
        })}
        {rows.length === 0 && <li role="presentation" className="px-2 py-6 text-center text-[13px] text-slate-500">{emptyText}</li>}
      </ul>
    </div>
  );
}
