import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { ISSUE_TYPES, LABEL_COLORS, PRIORITIES, RECURRENCES } from '@/constants/boards';
import { Menu, MultiSelectPopover, cx, isImeKey } from '@/components/ui';
import { IssueTypeIcon, PriorityIcon } from '@/components/tracker/TrackerIcons';
import { epicsOf } from '@/utils/boardQuery';
import { isLocalISO, issueKey } from '@/utils/boardModel';

// The pickers an issue's fields are set with — in the issue view's Details panel and in the
// Create dialog alike: each a quiet button showing the value (hover shows it can change), opening
// a menu of the choices. `value` in, `onChange(next)` out; the board supplies the lists.

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60';

/** The trigger every picker shares: the value with its icon, a caret on hover. */
function PickerButton({ label, children, className, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(
        'group flex min-h-8 w-full min-w-0 items-center gap-2 rounded px-2 py-1 text-left text-sm text-ink transition-colors hover:bg-neutral-fill',
        FOCUS, className,
      )}
      {...rest}
    >
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</span>
      <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-ink-subtlest opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 no-hover:opacity-100" />
    </button>
  );
}

const None = ({ children = 'None' }) => <span className="text-ink-subtlest">{children}</span>;

const radioItems = (options, value, onChange) => options.map((o) => ({
  id: o.id, label: o.name, checked: o.id === value, radio: true,
  onSelect: () => { if (o.id !== value) onChange(o.id); },
}));

export function TypePicker({ value, onChange, allowEpic = true, label = 'Issue type' }) {
  const types = allowEpic ? ISSUE_TYPES : ISSUE_TYPES.filter((t) => t.id !== 'epic');
  const current = ISSUE_TYPES.find((t) => t.id === value) ?? ISSUE_TYPES[0];
  return (
    <Menu
      label={label}
      placement="bottom-start"
      items={radioItems(types, current.id, onChange)}
      trigger={<PickerButton label={`${label}: ${current.name}`}><IssueTypeIcon type={current.id} decorative /> {current.name}</PickerButton>}
    />
  );
}

export function PriorityPicker({ value, onChange, label = 'Priority' }) {
  const current = PRIORITIES.find((p) => p.id === value) ?? PRIORITIES[2];
  return (
    <Menu
      label={label}
      placement="bottom-start"
      items={radioItems(PRIORITIES, current.id, onChange)}
      trigger={<PickerButton label={`${label}: ${current.name}`}><PriorityIcon priority={current.id} decorative /> {current.name}</PickerButton>}
    />
  );
}

/** The issue's labels: named pills; the popover ticks the board's labels and makes new ones. */
export function LabelsPicker({ board, value = [], onChange, onCreateLabel, label = 'Labels' }) {
  const chosen = value.map((id) => board.labels.find((l) => l.id === id)).filter(Boolean);
  const create = (name) => {
    const color = LABEL_COLORS[board.labels.length % LABEL_COLORS.length].color;
    const made = onCreateLabel?.({ name, color });
    if (made) onChange([...value, made.id]);
  };
  return (
    <MultiSelectPopover
      title="Labels"
      searchPlaceholder="Search or create labels"
      options={board.labels.map((l) => ({ value: l.id, label: l.name, color: l.color }))}
      value={value}
      onChange={onChange}
      onCreate={onCreateLabel ? create : undefined}
      trigger={(
        <PickerButton label={chosen.length ? `${label}: ${chosen.map((l) => l.name).join(', ')}` : `${label}: none`}>
          {chosen.length ? chosen.map((l) => <LabelPill key={l.id} label={l} />) : <None />}
        </PickerButton>
      )}
    />
  );
}

/** A label as the tracker shows one: its name in a grey-bordered pill, a dot of its colour. */
export function LabelPill({ label, className }) {
  return (
    <span className={cx('inline-flex h-5 max-w-full items-center gap-1 rounded-[3px] border border-line bg-white px-1.5 text-[12px] text-ink', className)} title={label.name}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
      <span className="truncate">{label.name}</span>
    </span>
  );
}

/** The epic an issue belongs to (its parent); "None" unlinks it. */
export function EpicPicker({ board, value, onChange, label = 'Parent epic' }) {
  const epics = epicsOf(board);
  const current = epics.find((e) => e.id === value) ?? null;
  const items = [
    { id: 'none', label: 'None', checked: !current, radio: true, onSelect: () => current && onChange(null) },
    ...(epics.length ? [{ type: 'separator' }] : []),
    ...epics.map((e) => ({
      id: e.id, label: `${issueKey(board, e)} ${e.title}`, checked: e.id === current?.id, radio: true,
      onSelect: () => { if (e.id !== current?.id) onChange(e.id); },
    })),
  ];
  return (
    <Menu
      label={label}
      placement="bottom-start"
      items={items}
      trigger={(
        <PickerButton label={`${label}: ${current ? current.title : 'none'}`}>
          {current ? <EpicLozenge title={current.title} /> : <None />}
        </PickerButton>
      )}
    />
  );
}

/** An epic's name in purple, the way a card and a row name the epic an issue belongs to. */
export function EpicLozenge({ title, className }) {
  return (
    <span className={cx('inline-flex h-5 max-w-full items-center rounded-[3px] bg-[#dfd8fd] px-1.5 text-[11px] font-bold uppercase tracking-[0.02em] text-[#5e4db2]', className)} title={`Epic: ${title}`}>
      <span className="truncate">{title}</span>
    </span>
  );
}

/** A scrum project's sprint for the issue: the backlog, or a sprint that is not closed. */
export function SprintPicker({ board, value, onChange, label = 'Sprint' }) {
  const sprints = board.sprints.filter((s) => s.state !== 'closed' || s.id === value);
  const current = sprints.find((s) => s.id === value) ?? null;
  const items = [
    { id: 'backlog', label: 'Backlog', checked: !current, radio: true, onSelect: () => current && onChange(null) },
    ...sprints.map((s) => ({
      id: s.id, label: s.state === 'active' ? `${s.name} (active)` : s.name, checked: s.id === current?.id, radio: true,
      onSelect: () => { if (s.id !== current?.id) onChange(s.id); },
    })),
  ];
  return (
    <Menu
      label={label}
      placement="bottom-start"
      items={items}
      trigger={<PickerButton label={`${label}: ${current ? current.name : 'backlog'}`}>{current ? current.name : <None>Backlog</None>}</PickerButton>}
    />
  );
}

export function RecurrencePicker({ value, onChange, label = 'Repeats' }) {
  const current = RECURRENCES.find((r) => r.id === value) ?? RECURRENCES[0];
  return (
    <Menu
      label={label}
      placement="bottom-start"
      items={radioItems(RECURRENCES, current.id, onChange)}
      trigger={<PickerButton label={`${label}: ${current.name}`}>{current.id === 'none' ? <None>{current.name}</None> : current.name}</PickerButton>}
    />
  );
}

/** What DateInput hands on: '' (cleared) or a real day in a four-digit year. */
const isWholeDay = (v) => v === '' || (isLocalISO(v) && Number(v.slice(0, 4)) >= 1000);

/**
 * A day ('YYYY-MM-DD'), picked with the browser's own date picker; '' clears it. While a year is
 * typed, Chrome and Edge report every keystroke as a day ('0002-09-26' after the first digit).
 * Handed on, the store refused it, or cleared the day already set, and the field, held to the
 * store's value, lost every segment. So what is typed stays here until it is a whole day, and
 * leaving the field with half a year typed puts the saved day back.
 */
export function DateInput({ value, onChange, label, className }) {
  const [draft, setDraft] = useState(null);
  // A new value from outside (another issue, an undo) replaces what was being typed.
  const [shown, setShown] = useState(value);
  if (shown !== value) { setShown(value); setDraft(null); }
  return (
    <input
      type="date"
      aria-label={label}
      value={draft ?? (value || '')}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        if (isWholeDay(v)) onChange(v);
      }}
      onBlur={() => setDraft(null)}
      className={cx(
        'h-8 w-full min-w-0 rounded border border-transparent bg-transparent px-2 text-sm text-ink transition-colors hover:bg-neutral-fill focus:border-brand focus:bg-white focus:outline-none',
        !value && 'text-ink-subtlest', className,
      )}
    />
  );
}

/** Story points: a number ≥ 0, blank for none — kept as typed until Enter or leaving the field. */
export function PointsInput({ value, onChange, label = 'Story points', className }) {
  const [draft, setDraft] = useState(null);
  const commit = () => {
    if (draft === null) return;
    const text = draft.trim();
    const n = Number(text);
    if (text === '') onChange(null);
    else if (Number.isFinite(n) && n >= 0 && n !== value) onChange(n);
    setDraft(null);
  };
  return (
    <input
      type="number"
      min="0"
      step="0.5"
      inputMode="decimal"
      aria-label={label}
      placeholder="None"
      value={draft ?? (value ?? '')}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        // The Enter that picks an input method's word (a full-width digit) is not a save.
        if (e.key === 'Enter' && !isImeKey(e)) { e.preventDefault(); commit(); }
        if (e.key === 'Escape' && draft !== null && !isImeKey(e)) { e.stopPropagation(); setDraft(null); }
      }}
      className={cx(
        'h-8 w-full min-w-0 rounded border border-transparent bg-transparent px-2 text-sm text-ink placeholder:text-ink-subtlest transition-colors hover:bg-neutral-fill focus:border-brand focus:bg-white focus:outline-none',
        className,
      )}
    />
  );
}

/** A button that adds something ("+ Add label"), quiet until hovered. */
export function AddButton({ children, icon: Icon = Plus, ...rest }) {
  return (
    <button type="button" className={cx('inline-flex h-8 items-center gap-1.5 rounded px-2 text-sm font-medium text-ink-subtle transition-colors hover:bg-neutral-fill hover:text-ink', FOCUS)} {...rest}>
      <Icon size={16} aria-hidden="true" /> {children}
    </button>
  );
}
