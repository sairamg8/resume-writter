import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ISSUE_TYPES, PRIORITIES } from '@/constants/boards';
import { Menu, MultiSelectPopover, SearchInput, cx } from '@/components/ui';
import { epicsOf, liveFilters } from '@/utils/boardQuery';

export const EMPTY_FILTERS = { text: '', types: [], priorities: [], labelIds: [], epicIds: [], due: '' };

/** Whether any filter is set. */
export const hasFilters = (f) => Boolean(f.text?.trim() || f.types.length || f.priorities.length || f.labelIds.length || f.epicIds.length || f.due);

const QUICK = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'week', label: 'Due this week' },
];

export const GROUPS = [
  { id: 'none', label: 'None' },
  { id: 'epic', label: 'Epic' },
  { id: 'priority', label: 'Priority' },
  { id: 'type', label: 'Issue type' },
];

/** A filter's button: its name, and how many values are ticked (then drawn selected). */
function FilterButton({ label, count, className, ...rest }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex h-8 shrink-0 items-center gap-1 rounded px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60',
        count ? 'bg-brand-subtle text-brand hover:bg-brand-subtle-hover' : 'text-ink-subtle hover:bg-neutral-fill hover:text-ink',
        className,
      )}
      {...rest}
    >
      {label}
      {count > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] leading-4 text-white">{count}</span>}
      <ChevronDown size={14} aria-hidden="true" />
    </button>
  );
}

/**
 * The bar over a project's issues (the board, the list, the calendar): search, the Epic / Type /
 * Label / Priority filters, the quick filters, "Clear filters", and — where the view has lanes —
 * "Group by". `filters` in boardQuery.filterIssues' shape; `onChange(next)`. `withEpics`: the view
 * lists epics (the list, the calendar), so Type offers Epic too — without it a ticked type hid every
 * epic there, with no way to list the epics alone. The board and the backlog show no epics.
 *
 * Below md the search sits beside one "Filters" button (with how many are set) that shows the rest
 * under it: wrapped over three or four rows they took about 150px of a phone's height, above a
 * board that scrolls in what is left (R4-DPH-06). From md up it is the one row it always was.
 */
export function BoardToolbar({ board, filters: raw, onChange, groupBy, onGroupBy, right, withEpics = false }) {
  const [open, setOpen] = useState(false);
  // An epic or label deleted since it was ticked is neither counted nor kept by the next change.
  const filters = liveFilters(board, raw);
  const set = (patch) => onChange({ ...filters, ...patch });
  const epics = epicsOf(board);
  // The values ticked and the quick filter; the search needs no count, its text is in the box.
  const activeCount = filters.epicIds.length + filters.types.length + filters.labelIds.length + filters.priorities.length + (filters.due ? 1 : 0);
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 md:px-8">
      <SearchInput
        value={filters.text}
        onChange={(text) => set({ text })}
        placeholder="Search this project"
        aria-label="Search this project"
        size="sm"
        className="mr-1 min-w-0 flex-1 md:w-52 md:flex-initial"
      />
      <FilterButton label="Filters" count={activeCount} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="md:hidden" />
      {/* Below md a row of its own under the search, while "Filters" is open. From md up `contents`
          takes this wrapper out of the layout: its children are the toolbar's, as before. */}
      <div className={cx('flex w-full flex-wrap items-center gap-1.5 md:contents', !open && 'max-md:hidden')}>
        {epics.length > 0 && (
          <MultiSelectPopover
            title="Epic"
            options={[...epics.map((e) => ({ value: e.id, label: e.title })), { value: 'none', label: 'Issues without an epic' }]}
            value={filters.epicIds}
            onChange={(epicIds) => set({ epicIds })}
            trigger={<FilterButton label="Epic" count={filters.epicIds.length} />}
          />
        )}
        <MultiSelectPopover
          title="Type"
          options={ISSUE_TYPES.filter((t) => withEpics || t.id !== 'epic').map((t) => ({ value: t.id, label: t.name, color: t.color }))}
          value={filters.types}
          onChange={(types) => set({ types })}
          trigger={<FilterButton label="Type" count={filters.types.length} />}
        />
        {board.labels.length > 0 && (
          <MultiSelectPopover
            title="Label"
            options={board.labels.map((l) => ({ value: l.id, label: l.name, color: l.color }))}
            value={filters.labelIds}
            onChange={(labelIds) => set({ labelIds })}
            trigger={<FilterButton label="Label" count={filters.labelIds.length} />}
          />
        )}
        <MultiSelectPopover
          title="Priority"
          options={PRIORITIES.map((p) => ({ value: p.id, label: p.name, color: p.color }))}
          value={filters.priorities}
          onChange={(priorities) => set({ priorities })}
          trigger={<FilterButton label="Priority" count={filters.priorities.length} />}
        />
        <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-line sm:block" />
        {QUICK.map((q) => (
          <button
            key={q.id}
            type="button"
            aria-pressed={filters.due === q.id}
            onClick={() => set({ due: filters.due === q.id ? '' : q.id })}
            className={cx(
              'h-8 shrink-0 rounded px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60',
              filters.due === q.id ? 'bg-brand-subtle text-brand hover:bg-brand-subtle-hover' : 'text-ink-subtle hover:bg-neutral-fill hover:text-ink',
            )}
          >
            {q.label}
          </button>
        ))}
        {hasFilters(filters) && (
          <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="h-8 shrink-0 rounded px-2.5 text-sm font-medium text-ink-subtle underline-offset-2 hover:text-ink hover:underline">
            Clear filters
          </button>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {right}
          {onGroupBy && (
            <Menu
              label="Group by"
              items={GROUPS.map((g) => ({ id: g.id, label: g.label, checked: g.id === groupBy, radio: true, onSelect: () => onGroupBy(g.id) }))}
              trigger={<FilterButton label={`Group by: ${GROUPS.find((g) => g.id === groupBy)?.label ?? 'None'}`} count={0} />}
            />
          )}
        </span>
      </div>
    </div>
  );
}
