import { useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableCard } from '@/components/board/BoardCard';
import { AddCard } from '@/components/board/AddCard';

/**
 * A list column. The column itself is sortable (drag it by the grip to reorder columns) and, via
 * the same node, a droppable target — so a card dropped on the column's empty space lands here
 * (Board's onDragEnd appends it). Cards inside are their own vertical SortableContext. Width is
 * phone-first: ~85vw with scroll-snap so one column fills the screen and the next peeks, widening
 * to a fixed 18rem from md up. The count reads `n/limit` for a column with a WIP limit (boardView),
 * red when the column holds more than its limit.
 */
export function BoardColumn({ list, onOpenCard, onAddCard, onRenameList, onDeleteList }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { type: 'list' },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(list.title);
  const cardIds = list.cards.map((c) => c.id);

  function commit() {
    setEditing(false);
    const t = draft.trim();
    if (t && t !== list.title) onRenameList(t);
    else setDraft(list.title);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`board-col-${list.id}`}
      className={`snap-center shrink-0 w-[85vw] max-w-xs md:w-72 flex flex-col max-h-full bg-gray-100/70 rounded-2xl p-2 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-1.5 px-1 py-1 mb-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none shrink-0"
          title="Drag to reorder list"
          aria-label="Drag to reorder list"
        >
          <GripVertical size={14} />
        </button>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') { setDraft(list.title); setEditing(false); }
            }}
            aria-label="List title"
            className="flex-1 min-w-0 text-sm font-semibold bg-white rounded px-1.5 py-0.5 border border-indigo-300 focus:outline-none"
          />
        ) : (
          <span
            onDoubleClick={() => { setDraft(list.title); setEditing(true); }}
            className="flex-1 min-w-0 text-sm font-semibold text-gray-700 truncate cursor-text"
            title="Double-click to rename"
          >
            {list.title || 'Untitled'}
          </span>
        )}
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${list.wip === 'over' ? 'text-red-700 bg-red-100' : 'text-gray-400 bg-gray-200/70'}`}
          title={list.limit != null ? `Work-in-progress limit: ${list.limit}` : undefined}
        >
          {list.limit != null ? `${list.cards.length}/${list.limit}` : list.cards.length}
        </span>
        <button onClick={onDeleteList} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded shrink-0" title="Delete list" aria-label="Delete list">
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex flex-col gap-2 flex-1 min-h-[2rem] overflow-y-auto px-0.5 pb-0.5">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {list.cards.map((card) => (
            <SortableCard key={card.id} card={card} listId={list.id} onOpen={onOpenCard} />
          ))}
        </SortableContext>
      </div>

      <AddCard onAdd={(title) => onAddCard(list.id, title)} />
    </div>
  );
}
