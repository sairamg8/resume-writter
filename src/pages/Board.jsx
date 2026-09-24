import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ListTodo, Plus, Trash2, X } from 'lucide-react';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useBoardStore } from '@/hooks/useBoardStore';
import { BoardColumn } from '@/components/board/BoardColumn';
import { CardView } from '@/components/board/BoardCard';
import { CardDetailSheet } from '@/components/board/CardDetailSheet';
import { BoardStorageNotice } from '@/components/board/BoardStorageNotice';
import { boardLists, boardSprint, dropTarget, hiddenDoneCount } from '@/utils/boardView';

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
 * One board (a v2 project) — its columns as lists and its issues as cards, with drag to reorder
 * cards (within and across lists) and to reorder lists. A single DndContext handles both: a
 * draggable carries `data.type` ('card' or 'list'). Moves are computed end-only (no live
 * onDragOver), which keeps the store's per-board updates cheap; where a drop lands is
 * boardView.dropTarget's, which the store's moveColumn / moveIssue then make.
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

  // One time for the render and its drops: which done cards hideDoneAfterDays keeps off the board.
  const now = Date.now();
  const lists = boardLists(board, { now });
  const sprint = boardSprint(board);
  const hiddenDone = hiddenDoneCount(board, { now });
  const activeCard = active?.type === 'card' ? lists.flatMap((l) => l.cards).find((c) => c.id === active.id) : null;
  const activeList = active?.type === 'list' ? lists.find((l) => l.id === active.id) : null;
  // Found by id alone: a move made elsewhere (another tab) may have changed its column meanwhile.
  const openList = open ? lists.find((l) => l.cards.some((c) => c.id === open.cardId)) : null;
  const openCard = openList?.cards.find((c) => c.id === open.cardId) || null;

  function onDragStart({ active: a }) {
    setActive({ type: a.data.current?.type, id: a.id });
  }

  function onDragEnd({ active: a, over }) {
    setActive(null);
    const move = dropTarget(board, { id: a.id, type: a.data.current?.type }, over && { id: over.id, data: over.data.current }, { now });
    if (move?.kind === 'column') store.moveColumn(board.id, move.columnId, move.toIndex);
    if (move?.kind === 'issue') store.moveIssue(board.id, move.issueId, move.target);
  }

  /**
   * Delete a list. Its cards are never lost: they move to the list beside it (the store refuses
   * to delete a list that holds cards without a target, and never deletes the last one).
   */
  function deleteList(list) {
    const index = lists.indexOf(list);
    const target = lists[index + 1] ?? lists[index - 1];
    if (!target) {
      alert('A board needs at least one list.');
      return;
    }
    const n = list.cards.length;
    if (n === 0 || confirm(`Delete "${list.title || 'this list'}"? Its ${n} card${n === 1 ? '' : 's'} will move to "${target.title || 'Untitled'}".`)) {
      store.deleteColumn(board.id, list.id, target.id);
    }
  }

  /**
   * The board's label for a colour the sheet picked (`{ name, color }`, the palette's): the first
   * one of that colour, else a new one. Its palette name may be another colour's label's already
   * (addLabel would hand that one back), so the new one then takes the next free "Name 2", "Name 3"…
   */
  function labelFor({ name, color }) {
    const found = board.labels.find((x) => x.color === color);
    if (found) return found;
    const taken = (n) => board.labels.some((x) => x.name.toLowerCase() === n.toLowerCase());
    let free = name || color;
    for (let n = 2; taken(free); n++) free = `${name || color} ${n}`;
    return store.addLabel(board.id, { name: free, color });
  }

  /**
   * The card sheet's change as an issue patch: the sheet picks labels by colour ({ name, color }),
   * an issue holds the ids of the board's labels — a colour the board has no label for yet gets one.
   */
  function changeCard(cardId, patch) {
    if (!('labels' in patch)) {
      store.updateIssue(board.id, cardId, patch);
      return;
    }
    const { labels, ...rest } = patch;
    const labelIds = labels.map((l) => (l.id ? l : labelFor(l))?.id).filter(Boolean);
    store.updateIssue(board.id, cardId, { ...rest, labelIds });
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
            onClick={() => navigate(`/boards/${encodeURIComponent(board.id)}/backlog`)}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            title="Plan sprints in the backlog"
          >
            <ListTodo size={14} /> Backlog
          </button>
          <button
            onClick={() => { if (confirm(`Delete "${board.title || 'this board'}"?`)) { navigate('/boards'); store.deleteBoard(board.id); } }}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
            title="Delete board"
            aria-label="Delete board"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <BoardStorageNotice persistError={store.persistError} recovery={store.recovery} onDismissRecovery={store.dismissRecovery} className="px-3 sm:px-5 pt-3 shrink-0" />

      {(sprint || board.mode === 'scrum' || hiddenDone > 0) && (
        <p className="px-3 sm:px-5 pt-2 text-xs text-gray-500 shrink-0">
          {sprint && <>Sprint: <span className="font-semibold text-gray-700">{sprint.name}</span>{sprint.endDate && <> · ends {sprint.endDate}</>}. New cards join it.</>}
          {!sprint && board.mode === 'scrum' && <>No sprint is active, so every card is shown. Start one from the backlog.</>}
          {hiddenDone > 0 && <> {hiddenDone} done card{hiddenDone === 1 ? ' is' : 's are'} hidden: resolved more than {board.hideDoneAfterDays} days ago.</>}
        </p>
      )}

      {/* Mobile list tabs — tap to scroll a column into view */}
      {lists.length > 0 && (
        <div className="md:hidden bg-white border-b border-gray-100 overflow-x-auto shrink-0">
          <div className="flex gap-1.5 px-3 py-2">
            {lists.map((l) => (
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
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 items-start px-3 sm:px-5 py-4 h-full snap-x snap-mandatory md:snap-none">
            <SortableContext items={lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
              {lists.map((list) => (
                <BoardColumn
                  key={list.id}
                  list={list}
                  onOpenCard={(cardId, listId) => setOpen({ cardId, listId })}
                  onAddCard={(listId, title) => store.addIssue(board.id, { title, columnId: listId, sprintId: sprint?.id ?? null })}
                  onRenameList={(title) => store.updateColumn(board.id, list.id, { title })}
                  onDeleteList={() => deleteList(list)}
                />
              ))}
            </SortableContext>
            <AddListColumn onAdd={(title) => store.addColumn(board.id, { title })} />
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
          onChange={(patch) => changeCard(openCard.id, patch)}
          onDelete={() => { store.deleteIssue(board.id, openCard.id); setOpen(null); }}
        />
      )}
    </div>
  );
}
