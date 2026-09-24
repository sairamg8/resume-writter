import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { Portal } from './Portal.jsx';
import { Kbd } from './Kbd.jsx';
import { useFloating } from './useFloating.js';
import { cx } from './compose.js';

const TYPEAHEAD_MS = 500;
const isItem = (item) => item && item.type !== 'separator' && item.type !== 'label';
const enabled = (item) => isItem(item) && !item.disabled;

/**
 * The next enabled item from `from` in `step` direction (wrapping), or `from` when none is.
 * Exported for the unit test.
 */
export function nextEnabled(items, from, step) {
  const n = items.length;
  for (let i = 1; i <= n; i += 1) {
    const at = (((from + step * i) % n) + n) % n;
    if (enabled(items[at])) return at;
  }
  return from;
}

/** The first enabled item after `from` whose label starts with `text` (case-blind), or -1. */
export function typeaheadMatch(items, from, text) {
  const q = text.toLowerCase();
  const n = items.length;
  for (let i = 1; i <= n; i += 1) {
    const at = (from + i) % n;
    if (enabled(items[at]) && String(items[at].label ?? '').toLowerCase().startsWith(q)) return at;
  }
  return -1;
}

/**
 * One level of a Menu: a role="menu" list in a portal, positioned at `anchorRef`. Arrow keys move
 * (wrapping, skipping disabled items), Home/End jump, letters jump by typeahead, Enter/Space pick,
 * ArrowRight opens a submenu (an item with `items`) and ArrowLeft/Escape close one level. The item
 * under the pointer takes focus, so mouse and keyboard never disagree about the active item.
 */
export function MenuList({
  id, rootId, items, anchorRef, placement, labelledBy, label, autoFocus = 'first', minWidth = 200,
  level = 0, onClose, onCloseAll,
}) {
  const listRef = useRef(null);
  const itemRefs = useRef([]);
  const [active, setActive] = useState(-1);
  const [submenu, setSubmenu] = useState({ index: -1, focus: 'none' });
  const subAnchorRef = useRef(null);
  const typed = useRef({ text: '', at: 0 });
  const hovered = useRef(-1);
  const hoverTimer = useRef(0);
  const { style } = useFloating(true, anchorRef, listRef, { placement, offset: level ? -4 : 6 });

  useLayoutEffect(() => {
    if (autoFocus === 'none') return;
    if (autoFocus === 'first' || autoFocus === 'last') {
      const start = autoFocus === 'first' ? nextEnabled(items, -1, 1) : nextEnabled(items, items.length, -1);
      if (enabled(items[start])) {
        setActive(start);
        itemRefs.current[start]?.focus({ preventScroll: true });
        return;
      }
    }
    listRef.current?.focus({ preventScroll: true });
    // Focus is placed once, when the list opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const focusAt = (index) => {
    setActive(index);
    itemRefs.current[index]?.focus({ preventScroll: false });
  };

  /** Opens the submenu of item `index` (-1 closes it); `focus` 'first' from the keyboard, 'none' on hover. */
  const openSub = (index, focus) => {
    subAnchorRef.current = index >= 0 ? itemRefs.current[index] : null;
    setSubmenu((cur) => (cur.index === index && cur.focus === focus ? cur : { index, focus }));
  };

  const choose = (item, index) => {
    if (!enabled(item)) return;
    if (item.items?.length) {
      clearTimeout(hoverTimer.current);
      openSub(index, 'first');
      return;
    }
    onCloseAll({ restoreFocus: true });
    item.onSelect?.();
  };

  const onKeyDown = (event) => {
    const { key } = event;
    const from = active < 0 ? (key === 'ArrowUp' ? items.length : -1) : active;
    if (key === 'ArrowDown' || key === 'ArrowUp') focusAt(nextEnabled(items, from, key === 'ArrowDown' ? 1 : -1));
    else if (key === 'Home') focusAt(nextEnabled(items, -1, 1));
    else if (key === 'End') focusAt(nextEnabled(items, items.length, -1));
    else if (key === 'ArrowRight' && enabled(items[active]) && items[active].items?.length) openSub(active, 'first');
    else if ((key === 'ArrowLeft' && level > 0) || key === 'Escape') onClose({ restoreFocus: true });
    else if (key === 'Tab') onCloseAll({ restoreFocus: true, move: event.shiftKey ? 'prev' : 'next' });
    else if (key.length === 1 && /\S/.test(key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < TYPEAHEAD_MS ? typed.current.text : '') + key, at: now };
      const match = typeaheadMatch(items, active, typed.current.text);
      if (match >= 0) focusAt(match);
    } else return;
    event.preventDefault();
    // Handled here: a dialog underneath must not also take this Escape or arrow.
    event.stopPropagation();
  };

  const hover = (index) => {
    if (hovered.current === index) return;
    hovered.current = index;
    if (enabled(items[index])) focusAt(index);
    clearTimeout(hoverTimer.current);
    const opens = enabled(items[index]) && items[index].items?.length > 0;
    hoverTimer.current = setTimeout(() => openSub(opens ? index : -1, 'none'), 120);
  };

  const hasChecks = items.some((item) => isItem(item) && typeof item.checked === 'boolean');
  return (
    <Portal>
      <div
        ref={listRef}
        id={id}
        role="menu"
        tabIndex={-1}
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        data-menu-root={rootId}
        onKeyDown={onKeyDown}
        style={{ ...style, minWidth }}
        className="z-[70] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl outline-none animate-ui-pop-in"
      >
        {items.map((item, index) => {
          if (item?.type === 'separator') return <div key={`sep-${index}`} role="separator" className="-mx-1 my-1 h-px bg-slate-100" />;
          if (item?.type === 'label') {
            return (
              <div key={`label-${index}`} role="presentation" className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {item.label}
              </div>
            );
          }
          const Icon = item.icon;
          const checkable = typeof item.checked === 'boolean';
          const role = checkable ? (item.radio ? 'menuitemradio' : 'menuitemcheckbox') : 'menuitem';
          return (
            <button
              key={item.id ?? `${index}-${item.label}`}
              ref={(node) => { itemRefs.current[index] = node; }}
              type="button"
              role={role}
              tabIndex={-1}
              aria-checked={checkable ? item.checked : undefined}
              aria-disabled={item.disabled || undefined}
              aria-haspopup={item.items?.length ? 'menu' : undefined}
              aria-expanded={item.items?.length ? submenu.index === index : undefined}
              onClick={() => choose(item, index)}
              onPointerMove={() => hover(index)}
              className={cx(
                'flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] leading-5 outline-none transition-colors duration-100 pointer-coarse:min-h-11',
                item.disabled ? 'cursor-default text-slate-400' : item.danger ? 'text-red-600 focus:bg-red-50' : 'text-slate-700 focus:bg-slate-100 focus:text-slate-900',
                submenu.index === index && 'bg-slate-100',
              )}
            >
              {hasChecks && (
                <span className="flex w-4 shrink-0 justify-center" aria-hidden="true">
                  {item.checked && <Check size={14} className="text-indigo-600" />}
                </span>
              )}
              {Icon && <Icon size={15} aria-hidden="true" className={cx('shrink-0', item.danger ? 'text-red-500' : 'text-slate-400')} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.label}</span>
                {item.description && <span className="block truncate text-xs text-slate-500">{item.description}</span>}
              </span>
              {item.shortcut && <Kbd combo={item.shortcut} className="ml-3 shrink-0" />}
              {item.items?.length > 0 && <ChevronRight size={14} aria-hidden="true" className="-mr-0.5 shrink-0 text-slate-400" />}
            </button>
          );
        })}
      </div>
      {submenu.index >= 0 && items[submenu.index]?.items?.length > 0 && (
        <MenuList
          key={submenu.index}
          id={`${id}-sub-${submenu.index}`}
          rootId={rootId}
          items={items[submenu.index].items}
          anchorRef={subAnchorRef}
          placement="right-start"
          label={items[submenu.index].label}
          autoFocus={submenu.focus}
          level={level + 1}
          minWidth={180}
          onClose={({ restoreFocus }) => {
            const at = submenu.index;
            openSub(-1, 'none');
            if (restoreFocus) focusAt(at);
          }}
          onCloseAll={onCloseAll}
        />
      )}
    </Portal>
  );
}
