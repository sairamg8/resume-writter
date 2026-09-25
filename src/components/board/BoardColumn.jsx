import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { MoreHorizontal } from 'lucide-react';
import { Button, Dialog, IconButton, Menu, TextField, cx } from '@/components/ui';
import { COLUMN_CATEGORIES } from '@/constants/boards';
import { InlineCreate } from './InlineCreate';

/**
 * A board column (a status): its name in caps, how many issues it holds (and its WIP limit —
 * red once over), a ⋯ menu for the column, the cards in rank order, and "+ Create issue" at the
 * foot. The column's body is a droppable (`data.type` 'list'), so a card dropped on its empty
 * space lands at its foot. With swimlanes the page renders one per lane (`droppableId` differs,
 * `showHeader` only in the header row).
 */
export function BoardColumn({
  list, droppableId = list.id, cards, renderCard, showHeader = true, onCreate, menu, className,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId, data: { type: 'list', listId: list.id } });
  const ids = cards.map((c) => c.id);
  return (
    <section
      data-column={list.id}
      aria-label={showHeader ? `${list.title || 'Untitled'} column` : undefined}
      className={cx('flex w-[272px] shrink-0 snap-center flex-col rounded-md bg-sunken', className)}
    >
      {showHeader && (
        <header className="group/col flex h-11 items-center gap-2 px-3">
          <h2 className="min-w-0 truncate text-[12px] font-semibold uppercase tracking-[0.03em] text-ink-subtle">{list.title || 'Untitled'}</h2>
          <span
            className={cx('shrink-0 text-[12px] font-semibold', list.wip === 'over' ? 'rounded-[3px] bg-[#ffd5d2] px-1 text-[#ae2e24]' : 'text-ink-subtlest')}
            title={list.limit ? `${list.cards.length} issues, limit ${list.limit}` : `${list.cards.length} issues`}
          >
            {list.limit ? `${list.cards.length}/${list.limit}` : list.cards.length}
          </span>
          {list.limit && list.wip !== 'over' && <span className="shrink-0 text-[11px] font-semibold uppercase text-ink-subtlest">Max {list.limit}</span>}
          <span className="ml-auto">{menu}</span>
        </header>
      )}
      <div
        ref={setNodeRef}
        className={cx('flex min-h-24 flex-1 flex-col gap-1 px-1 pb-1 transition-colors', isOver && 'rounded-b-md bg-brand-subtle/60', !showHeader && 'pt-1')}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1">
            {cards.map((card) => <li key={card.id}>{renderCard(card)}</li>)}
          </ul>
        </SortableContext>
        {onCreate && <InlineCreate onCreate={onCreate} className="mt-0.5" />}
      </div>
    </section>
  );
}

/** A column's ⋯ menu: rename, WIP limit, category (what it means), move left / right, delete. */
export function ColumnMenu({ column, index, count, onRename, onLimit, onCategory, onMove, onDelete }) {
  return (
    <Menu
      label={`${column.title || 'Untitled'} column actions`}
      items={[
        { id: 'rename', label: 'Rename', onSelect: onRename },
        { id: 'limit', label: column.wipLimit ? `Change limit (${column.wipLimit})` : 'Set column limit', onSelect: onLimit },
        {
          id: 'category', label: 'Status category',
          items: COLUMN_CATEGORIES.map((c) => ({ id: c.id, label: c.name, checked: c.id === column.category, radio: true, onSelect: () => c.id !== column.category && onCategory(c.id) })),
        },
        { type: 'separator' },
        { id: 'left', label: 'Move left', disabled: index === 0, onSelect: () => onMove(index - 1) },
        { id: 'right', label: 'Move right', disabled: index === count - 1, onSelect: () => onMove(index + 1) },
        { type: 'separator' },
        { id: 'delete', label: 'Delete column', danger: true, disabled: count <= 1, onSelect: onDelete },
      ]}
      trigger={<IconButton icon={MoreHorizontal} label={`${column.title || 'Untitled'} column actions`} size="sm" tooltip={false} className="opacity-0 group-hover/col:opacity-100 no-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100" />}
    />
  );
}

/** The fields ColumnDialog edits, kept as typed until saved. */
function ColumnForm({ column, mode, onSave, onClose }) {
  const [value, setValue] = useState(mode === 'rename' ? column.title : column.wipLimit ?? '');
  const save = (e) => {
    e.preventDefault();
    if (mode === 'rename') {
      if (value.trim()) onSave({ title: value.trim() });
      return;
    }
    const n = Number(value);
    onSave({ wipLimit: String(value).trim() === '' || n <= 0 ? null : Math.floor(n) });
  };
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {mode === 'rename' ? (
        <TextField label="Column name" data-autofocus value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} required />
      ) : (
        <TextField
          label="Maximum issues"
          hint="The column's count turns red once it holds more. Leave it blank for no limit."
          type="number"
          min="1"
          data-autofocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit">Save</Button>
      </div>
    </form>
  );
}

/** Rename a column, or set its WIP limit (`mode` 'rename' | 'limit'); nothing while `column` is null. */
export function ColumnDialog({ column, mode, onSave, onClose }) {
  return (
    <Dialog open={!!column} onClose={onClose} title={mode === 'limit' ? 'Set column limit' : 'Rename column'} size="sm">
      {column && <ColumnForm key={`${column.id}-${mode}`} column={column} mode={mode} onSave={onSave} onClose={onClose} />}
    </Dialog>
  );
}
