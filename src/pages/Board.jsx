import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, X } from 'lucide-react';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useBoardStore } from '@/hooks/useBoardStore';
import { BoardColumn } from '@/components/board/BoardColumn';
import { CardView } from '@/components/board/BoardCard';
import { BOARD_DRAG_INSTRUCTIONS } from '@/utils/cardKeys';
import { CardDetailSheet } from '@/components/board/CardDetailSheet';

/** The "Add list" column at the right edge of the board (and its own scroll-snap target on mobile). */
function AddListColumn({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const ref = useRef(null);

  useEffect(() => { if (open) ref.current?.focus(); }, [open]);

  function add() {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
    ref.current?.focus();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="snap-center shrink-0 w-[70vw] max-w-[16rem] md:w-64 flex items-center gap-1.5 self-start px-3 py-2 text-sm font-medium text-gray-500 bg-white/70 hover:bg-white border border-dashed border-gray-300 rounded-2xl transition-colors"
      >
        <Plus size={15} /> Add list
      </button>
    );
  }

  return (
    <div className="snap-center shrink-0 w-[70vw] max-w-[16rem] md:w-64 self-start bg-gray-100/70 rounded-2xl p-2">
      <input
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add();
          if (e.key === 'Escape') { setOpen(false); setText(''); }
        }}
        placeholder="List title…"
        aria-label="List title"
        className="w-full text-sm p-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <div className="flex items-center gap-2 mt-1">
        <button onClick={add} className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Add list</button>
        <button onClick={() => { setOpen(false); setText(''); }} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Cancel">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/**
 * One board — its lists and cards, with drag to reorder cards (within and across lists) and to
 * reorder lists. A single DndContext handles both: a draggable carries `data.type` ('card' or
 * 'list'), and onDragEnd branches on it. Card moves are computed end-only (no live onDragOver),
 * which keeps the store's per-board updates cheap; the index maths matches arrayMove because the
 * store's moveCard strips the card then inserts at the over card's index.
 */
export function Board() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useBoardStore();
  const board = store.boards.find((b) => b.id === id);

  const [active, setActive] = useState(null); // { type, id } of the dragged item
  const [open, setOpen] = useState(null); // { cardId, listId } of the card whose sheet is open
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  // Mouse drags on a small move (snappy on desktop; a plain click stays under 8px and opens the
  // card). Touch drags only on a press-and-hold, so a normal swipe still scrolls the columns and a
  // list still scrolls its cards, and a tap opens the card — the plan's mobile fix.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  if (!board) {
    return (
      <div className="min-h-screen bg-[#f5f3ef] flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-gray-500">This board doesn’t exist.</p>
        <button onClick={() => navigate('/boards')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Back to boards</button>
      </div>
    );
  }

  const findListOf = (cardId) => board.lists.find((l) => l.cards.some((c) => c.id === cardId));
  const activeCard = active?.type === 'card' ? board.lists.flatMap((l) => l.cards).find((c) => c.id === active.id) : null;
  const activeList = active?.type === 'list' ? board.lists.find((l) => l.id === active.id) : null;
  const openList = open ? board.lists.find((l) => l.id === open.listId) : null;
  const openCard = openList?.cards.find((c) => c.id === open.cardId) || null;

  function onDragStart({ active: a }) {
    setActive({ type: a.data.current?.type, id: a.id });
  }

  function onDragEnd({ active: a, over }) {
    setActive(null);
    if (!over) return;
    const type = a.data.current?.type;

    if (type === 'list') {
      if (a.id === over.id) return;
      const overListId = over.data.current?.type === 'list' ? over.id : over.data.current?.listId;
      const toIndex = board.lists.findIndex((l) => l.id === overListId);
      if (toIndex !== -1) store.moveList(board.id, a.id, toIndex);
      return;
    }

    // A card.
    const fromList = findListOf(a.id);
    if (!fromList) return;
    if (over.data.current?.type === 'card') {
      const toListId = over.data.current.listId;
      if (fromList.id === toListId && over.id === a.id) return;
      const toList = board.lists.find((l) => l.id === toListId);
      const toIndex = toList.cards.findIndex((c) => c.id === over.id);
      store.moveCard(board.id, { cardId: a.id, toListId, toIndex });
    } else {
      // Dropped on a list's empty space (over is the column) → append there.
      const toListId = over.data.current?.type === 'list' ? over.id : fromList.id;
      store.moveCard(board.id, { cardId: a.id, toListId, toIndex: null });
    }
  }

  function commitTitle() {
    setTitleEditing(false);
    const t = titleDraft.trim();
    if (t && t !== board.title) store.updateBoard(board.id, { title: t });
  }

  return (
    <div className="min-h-screen h-screen bg-[#f5f3ef] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="px-3 sm:px-5 py-3 flex items-center gap-2.5">
          <button onClick={() => navigate('/boards')} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0" title="Back to boards">
            <ArrowLeft size={16} />
          </button>
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: board.color }} />
          {titleEditing ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setTitleEditing(false);
              }}
              aria-label="Board title"
              className="min-w-0 text-lg font-bold text-gray-900 bg-white border border-indigo-300 rounded px-2 py-0.5 focus:outline-none"
            />
          ) : (
            <button
              onClick={() => { setTitleDraft(board.title); setTitleEditing(true); }}
              className="min-w-0 text-lg font-bold text-gray-900 truncate hover:bg-gray-100 rounded px-1"
              title="Rename board"
            >
              {board.title || 'Untitled board'}
            </button>
          )}
          <button
            onClick={() => { if (confirm(`Delete "${board.title || 'this board'}"?`)) { store.deleteBoard(board.id); navigate('/boards'); } }}
            className="ml-auto p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
            title="Delete board"
            aria-label="Delete board"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Mobile list tabs — tap to scroll a column into view */}
      {board.lists.length > 0 && (
        <div className="md:hidden bg-white border-b border-gray-100 overflow-x-auto shrink-0">
          <div className="flex gap-1.5 px-3 py-2">
            {board.lists.map((l) => (
              <button
                key={l.id}
                onClick={() => document.getElementById(`board-col-${l.id}`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })}
                className="shrink-0 text-[11px] font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1 transition-colors"
              >
                {l.title || 'Untitled'} <span className="text-gray-400">{l.cards.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Board */}
      <DndContext sensors={sensors} accessibility={{ screenReaderInstructions: BOARD_DRAG_INSTRUCTIONS }} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 items-start px-3 sm:px-5 py-4 h-full snap-x snap-mandatory md:snap-none">
            <SortableContext items={board.lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
              {board.lists.map((list) => (
                <BoardColumn
                  key={list.id}
                  list={list}
                  onOpenCard={(cardId, listId) => setOpen({ cardId, listId })}
                  onAddCard={(listId, title) => store.addCard(board.id, listId, { title })}
                  onRenameList={(title) => store.updateList(board.id, list.id, { title })}
                  onDeleteList={() => { if (list.cards.length === 0 || confirm(`Delete "${list.title || 'this list'}" and its ${list.cards.length} card(s)?`)) store.deleteList(board.id, list.id); }}
                />
              ))}
            </SortableContext>
            <AddListColumn onAdd={(title) => store.addList(board.id, title)} />
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeCard ? (
            <div className="w-[85vw] max-w-xs md:w-72"><CardView card={activeCard} overlay /></div>
          ) : activeList ? (
            <div className="w-72 bg-gray-100/90 rounded-2xl p-2 shadow-2xl">
              <div className="text-sm font-semibold text-gray-700 px-2 py-1">{activeList.title || 'Untitled'}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {openCard && (
        <CardDetailSheet
          card={openCard}
          listTitle={openList?.title}
          onClose={() => setOpen(null)}
          onChange={(patch) => store.updateCard(board.id, open.listId, open.cardId, patch)}
          onDelete={() => { store.deleteCard(board.id, open.listId, open.cardId); setOpen(null); }}
        />
      )}
    </div>
  );
}
