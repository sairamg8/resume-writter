import { ChevronDown } from 'lucide-react';
import { Menu, cx } from '../ui/index.js';

/**
 * The status categories' colours: to do grey, in progress blue, done green (index.css's
 * `loz-*` colours), and the neutral / warning / danger / accent tones a lozenge can also take.
 */
export const LOZENGE_TONES = {
  todo: 'bg-loz-todo text-loz-todo-ink',
  inprogress: 'bg-loz-progress text-loz-progress-ink',
  done: 'bg-loz-done text-loz-done-ink',
  warning: 'bg-[#f8e6a0] text-[#7f5f01]',
  danger: 'bg-[#ffd5d2] text-[#ae2e24]',
  accent: 'bg-[#dfd8fd] text-[#5e4db2]',
};

const BUTTON_TONES = {
  todo: 'bg-loz-todo text-loz-todo-ink hover:bg-[#c7ccd4]',
  inprogress: 'bg-brand text-white hover:bg-brand-hover',
  done: 'bg-[#1f845a] text-white hover:bg-[#216e4e]',
  warning: 'bg-[#f8e6a0] text-[#7f5f01] hover:bg-[#f5cd47]',
  danger: 'bg-[#ffd5d2] text-[#ae2e24] hover:bg-[#fd9891]',
};

/** A status in the tracker's compact caps: `tone` a category id or a LOZENGE_TONES key. */
export function Lozenge({ tone = 'todo', children, className, title }) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex h-5 max-w-full shrink-0 items-center rounded-[3px] px-1 text-[11px] font-bold uppercase leading-none tracking-[0.02em]',
        LOZENGE_TONES[tone] ?? LOZENGE_TONES.todo, className,
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * The status picker of an issue or a job: a button in its category's colour naming the status
 * ("In Progress ▾"), opening a menu of every status as a lozenge.
 *
 * - `value`: the chosen status id; `options`: `[{ id, name, category }]` (category 'todo' |
 *   'inprogress' | 'done', or a job's 'warning' | 'danger'); `onChange(id)`.
 * - `label`: the menu's accessible name ('Status'); `size`: 'sm' | 'md'.
 */
export function StatusMenu({ value, options, onChange, label = 'Status', size = 'md', className }) {
  const current = options.find((o) => o.id === value) ?? options[0];
  if (!current) return null;
  const items = options.map((o) => ({
    id: o.id,
    label: o.name,
    checked: o.id === current.id,
    radio: true,
    onSelect: () => { if (o.id !== current.id) onChange?.(o.id); },
  }));
  return (
    <Menu
      label={label}
      placement="bottom-start"
      items={items}
      trigger={(
        <button
          type="button"
          aria-label={`${label}: ${current.name}`}
          className={cx(
            'inline-flex max-w-full items-center gap-1 rounded font-semibold transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-1',
            size === 'sm' ? 'h-6 px-2 text-[12px]' : 'h-8 px-3 text-sm',
            BUTTON_TONES[current.category] ?? BUTTON_TONES.todo, className,
          )}
        >
          <span className="truncate">{current.name}</span>
          <ChevronDown size={size === 'sm' ? 12 : 16} aria-hidden="true" className="shrink-0" />
        </button>
      )}
    />
  );
}
