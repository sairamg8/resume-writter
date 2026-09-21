import { Calendar, CheckSquare } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { deadlineState } from '@/utils/dates';

/**
 * A card's face — labels, title, and a meta row (due date coloured by how close it is, checklist
 * progress). Presentational, so it doubles as the DragOverlay while a card is dragged (`overlay`).
 * Mirrors the Job Tracker's KanbanCard look so the two boards feel like one app.
 */
export function CardView({ card, overlay = false }) {
  const due = deadlineState(card.due);
  const checklist = card.checklist || [];
  const doneCount = checklist.filter((c) => c.done).length;
  const allDone = checklist.length > 0 && doneCount === checklist.length;
  const labels = card.labels || [];

  return (
    <div className={`bg-white border rounded-xl p-2.5 select-none ${overlay ? 'shadow-2xl border-indigo-200 rotate-1' : 'border-gray-200 shadow-sm hover:shadow-md'} transition-all`}>
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {labels.map((l, i) => (
            <span key={i} className="h-1.5 w-7 rounded-full" style={{ backgroundColor: l.color }} title={l.name} />
          ))}
        </div>
      )}
      <p className="text-sm text-gray-800 leading-snug break-words">{card.title || 'Untitled'}</p>
      {(card.due || checklist.length > 0) && (
        <div className="flex items-center gap-3 mt-2 text-[10px]">
          {card.due && (
            <span className={`inline-flex items-center gap-1 font-medium ${due === 'past' ? 'text-red-500' : due === 'soon' ? 'text-amber-500' : 'text-gray-400'}`}>
              <Calendar size={10} /> {card.due}
            </span>
          )}
          {checklist.length > 0 && (
            <span className={`inline-flex items-center gap-1 ${allDone ? 'text-indigo-500' : 'text-gray-400'}`}>
              <CheckSquare size={10} /> {doneCount}/{checklist.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A draggable, sortable card in a list. The whole card is the drag handle; a plain tap (no drag
 * started) opens the detail sheet — the sensors' activation constraints (a small move on mouse, a
 * press-and-hold on touch) keep a tap from being read as a drag, and a drag from being read as a tap.
 */
export function SortableCard({ card, listId, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', listId },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onOpen(card.id, listId)}
      className={`cursor-pointer ${isDragging ? 'opacity-40' : ''}`}
    >
      <CardView card={card} />
    </div>
  );
}
