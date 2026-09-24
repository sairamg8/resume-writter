import { useRef } from 'react';
import { Tooltip } from './Tooltip.jsx';
import { cx } from './compose.js';

/**
 * A small set of mutually exclusive options in a pill track — Board | Table, Kanban | Scrum.
 * Radio-group semantics: `role="radiogroup"`, each option `role="radio"` with aria-checked,
 * ←/→ (and ↑/↓) move and select (wrapping), Home/End jump to the first / last; only the selected
 * option is in the Tab order — the first one while none is (a value that matches no option).
 *
 * - `value`, `onChange(value)`; `options`: `[{ value, label, icon }]`.
 * - `iconOnly`: shows only the icons, the label becoming each option's aria-label and tooltip.
 * - `aria-label` names the group ("View"); `size`: 'sm' (28 px) | 'md' (32 px, default).
 */
export function SegmentedControl({ value, onChange, options, iconOnly = false, size = 'md', 'aria-label': ariaLabel, className }) {
  const refs = useRef({});

  const at = options.findIndex((o) => o.value === value);
  // Roving tabindex: the selected option, else the first, so the group is always reachable by Tab.
  const tabStop = at >= 0 ? at : 0;

  const onKeyDown = (event) => {
    if (!options.length) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    let next = null;
    if (step) {
      const from = at >= 0 ? at : step > 0 ? -1 : options.length;
      next = options[(from + step + options.length) % options.length];
    } else if (event.key === 'Home') next = options[0];
    else if (event.key === 'End') next = options[options.length - 1];
    if (!next) return;
    event.preventDefault();
    onChange?.(next.value);
    refs.current[next.value]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cx('inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 ring-1 ring-inset ring-slate-200/60', className)}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        const Icon = option.icon;
        const button = (
          <button
            key={option.value}
            ref={(node) => { refs.current[option.value] = node; }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={iconOnly ? option.label : undefined}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => onChange?.(option.value)}
            className={cx(
              'relative inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-[color,background-color,box-shadow] duration-150',
              "after:absolute after:content-[''] after:-inset-y-1 after:inset-x-0 pointer-coarse:after:-inset-y-2",
              size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]',
              iconOnly ? (size === 'sm' ? 'w-7' : 'w-8') : 'px-2.5',
              checked ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-900',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60',
            )}
          >
            {Icon && <Icon size={15} aria-hidden="true" />}
            {!iconOnly && option.label}
          </button>
        );
        return iconOnly ? <Tooltip key={option.value} content={option.label}>{button}</Tooltip> : button;
      })}
    </div>
  );
}
