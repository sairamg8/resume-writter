import { useRef } from 'react';

/**
 * The second level of an editor tab: the few views one tab is split into, shown one at a time —
 * Design's Template | Style | Layout | Details, the letter's Letter | Letterhead, the ATS check's
 * Checks | Job match | Parser view, Personal Info's Details | Header | Photo. The first level is the
 * Editor's tab bar (EditorModeBar); this is what keeps a tab's content apart from its settings, so
 * one tab never lays all of them out in one long column.
 *
 * - `views`: `[{ value, label }]`; `value` / `onChange(value)`: the open one (controlled).
 * - `label` names the group for assistive technology ("Design sections").
 * - The buttons share the track's width and truncate their label, so a panel dragged to 240 px never
 *   spills one past the track (the lesson of R4-DVIS-12); ←/→ move and select, Home/End jump.
 * - `sticky`: the track stays at the top of the panel's scroll box while a long view scrolls under it.
 */
export function PanelSubNav({ views, value, onChange, label, sticky = false, className = '' }) {
  const refs = useRef({});

  function onKeyDown(event) {
    const at = views.findIndex((v) => v.value === value);
    let next = null;
    if (event.key === 'ArrowRight') next = views[(at + 1) % views.length];
    else if (event.key === 'ArrowLeft') next = views[(at - 1 + views.length) % views.length];
    else if (event.key === 'Home') next = views[0];
    else if (event.key === 'End') next = views[views.length - 1];
    if (!next) return;
    event.preventDefault();
    onChange(next.value);
    refs.current[next.value]?.focus();
  }

  const track = (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex gap-0.5 p-0.5 rounded-lg bg-gray-100 ring-1 ring-inset ring-gray-200/70"
    >
      {views.map((view) => {
        const selected = view.value === value;
        return (
          <button
            key={view.value}
            ref={(node) => { refs.current[view.value] = node; }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(view.value)}
            className={`flex-1 min-w-0 truncate px-2 h-8 pointer-coarse:h-10 rounded-md text-xs font-semibold transition-colors ${
              selected ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-900/5' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {view.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={`${sticky ? 'sticky top-0 z-10 bg-white/95 backdrop-blur-sm px-4 pt-3 pb-2.5 border-b border-gray-100' : ''} ${className}`}>
      {track}
    </div>
  );
}
