import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, Info, MoreHorizontal, Plus } from 'lucide-react';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core';
import { useBoardStore } from '@/hooks/useBoardStore';
import { Button, EmptyState, IconButton, Menu, cx, useConfirmOptional, useToast } from '@/components/ui';
import { useWorkspace } from '@/components/shell';
import { BoardStorageNotice } from '@/components/board/BoardStorageNotice';
import { BoardColumn, ColumnDialog, ColumnMenu } from '@/components/board/BoardColumn';
import { BoardToolbar, EMPTY_FILTERS } from '@/components/board/BoardToolbar';
import { IssueCardMenu, IssueCardView, SortableIssueCard } from '@/components/board/IssueCard';
import { ProjectHeader } from '@/components/board/ProjectTabs';
import { IssueHost, useIssueActions, useIssueRoute } from '@/components/board/useIssueActions';
import { IssueTypeIcon, PriorityIcon } from '@/components/tracker/TrackerIcons';
import { BOARD_DRAG_INSTRUCTIONS } from '@/utils/cardKeys';
import { boardLists, boardSprint, dropTarget, hiddenDoneCount } from '@/utils/boardView';
import { filterIssues, swimlanes } from '@/utils/boardQuery';
import { issueKey } from '@/utils/boardModel';

/** "+" at the end of the columns: a new column, named at once. */
function AddColumn({ onAdd }) {
  const [text, setText] = useState(null);
  if (text === null) {
    return <IconButton icon={Plus} label="Add column" variant="subtle" onClick={() => setText('')} className="mt-1 shrink-0" />;
  }
  const add = () => { if (text.trim()) onAdd(text.trim()); setText(null); };
  return (
    <input
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={add}
      onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setText(null); }}
      placeholder="Column name"
      aria-label="Column name"
      className="h-9 w-[272px] shrink-0 rounded border-2 border-brand bg-white px-2 text-sm text-ink focus:outline-none"
    />
  );
}

/** A swimlane's heading: fold it, its name (an epic's, a priority's, a type's), how many issues. */
function LaneHeader({ lane, open, onToggle }) {
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className="sticky left-0 flex items-center gap-2 rounded px-1 py-2 text-sm font-semibold text-ink hover:bg-neutral-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60">
      <ChevronDown size={16} aria-hidden="true" className={cx('transition-transform', !open && '-rotate-90')} />
      {lane.kind === 'type' && <IssueTypeIcon type={lane.id} decorative />}
      {lane.kind === 'priority' && <PriorityIcon priority={lane.id} decorative />}
      {lane.kind === 'epic' && lane.id !== 'none' && <IssueTypeIcon type="epic" decorative />}
      {lane.title}
      <span className="font-normal text-ink-subtlest">({lane.issues.length} {lane.issues.length === 1 ? 'issue' : 'issues'})</span>
    </button>
  );
}

/**
 * A project's board: its columns (statuses) side by side, the issues as cards in rank order —
 * a scrum project's active sprint, a kanban project's all but long-done ones — filtered by the
 * toolbar and, with "Group by", in swimlanes. Drag a card to another place or column; its ⋯ menu
 * moves it too. `?issue=KEY` opens the issue view over the board.
 */
export function Board() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useBoardStore();
  const workspace = useWorkspace();
  const confirm = useConfirmOptional();
  const { toast } = useToast();
  const board = store.boards.find((b) => b.id === id);
  const route = useIssueRoute(store.boards, board);
  const actions = useIssueActions(board ?? { id, key: '', columns: [], issues: [] });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [groupBy, setGroupBy] = useState('none');
  const [folded, setFolded] = useState(() => new Set());
  const [active, setActive] = useState(null);
  const [columnEdit, setColumnEdit] = useState(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  if (!board) {
    return (
      <EmptyState
        className="m-auto"
        title="This project doesn’t exist"
        description="It may have been deleted, or the link is wrong."
        action={<Button variant="primary" to="/boards">View all projects</Button>}
      />
    );
  }

  const now = Date.now();
  const lists = boardLists(board, { now });
  const sprint = boardSprint(board);
  const hiddenDone = hiddenDoneCount(board, { now });
  const shown = new Set(filterIssues(board, filters, { now, issues: lists.flatMap((l) => l.cards) }).map((i) => i.id));
  const allCards = lists.flatMap((l) => l.cards);
  const lanes = swimlanes(board, allCards.filter((c) => shown.has(c.id)), groupBy);
  const doneIds = new Set(board.columns.filter((c) => c.category === 'done').map((c) => c.id));
  const activeCard = active ? allCards.find((c) => c.id === active) : null;

  function onDragEnd({ active: a, over }) {
    setActive(null);
    if (!over) return;
    const target = over.data.current?.type === 'list' ? { id: over.data.current.listId, data: { type: 'list' } } : { id: over.id, data: over.data.current };
    const move = dropTarget(board, { id: a.id, type: 'card' }, target, { now });
    if (move?.kind === 'issue') store.moveIssue(board.id, move.issueId, move.target);
  }

  async function deleteColumn(list, index) {
    const target = lists[index + 1] ?? lists[index - 1];
    if (!target) return;
    const n = list.cards.length;
    if (n > 0) {
      const ok = await confirm({
        title: `Delete the ${list.title || 'Untitled'} column?`,
        body: `Its ${n} issue${n === 1 ? '' : 's'} will move to “${target.title || 'Untitled'}”.`,
        confirmLabel: 'Delete column',
        tone: 'danger',
      });
      if (!ok) return;
    }
    store.deleteColumn(board.id, list.id, target.id);
    toast({ title: `Column “${list.title || 'Untitled'}” deleted` });
  }

  const columnMenu = (list, index) => {
    const column = board.columns.find((c) => c.id === list.id);
    return (
      <ColumnMenu
        column={column}
        index={index}
        count={lists.length}
        onRename={() => setColumnEdit({ id: list.id, mode: 'rename' })}
        onLimit={() => setColumnEdit({ id: list.id, mode: 'limit' })}
        onCategory={(category) => store.updateColumn(board.id, list.id, { category })}
        onMove={(to) => store.moveColumn(board.id, list.id, to)}
        onDelete={() => deleteColumn(list, index)}
      />
    );
  };

  const renderCard = (listId) => (card) => {
    const key = issueKey(board, card);
    return (
      <SortableIssueCard
        card={card}
        listId={listId}
        issueKey={key}
        done={doneIds.has(card.columnId)}
        onOpen={() => route.open(key)}
        menu={(
          <IssueCardMenu
            columns={board.columns}
            columnId={card.columnId}
            priority={card.priority}
            onOpen={() => route.open(key)}
            onMove={(columnId) => store.moveIssue(board.id, card.id, { columnId, sprintId: card.sprintId, beforeId: null })}
            onPriority={(priority) => store.updateIssue(board.id, card.id, { priority })}
            onCopyLink={() => actions.copyLink(card)}
            onDuplicate={() => actions.duplicate(card)}
            onDelete={() => actions.remove(card)}
          />
        )}
      />
    );
  };

  const create = (listId) => ({ title, type }) => store.addIssue(board.id, { title, type, columnId: listId, sprintId: sprint?.id ?? null });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProjectHeader
        board={board}
        actions={(
          <>
            {sprint && <Button to={`/boards/${encodeURIComponent(board.id)}/backlog`} size="md">Complete sprint</Button>}
            <Menu
              label="Board actions"
              items={[
                { id: 'create', label: 'Create issue', onSelect: () => workspace?.openCreate({ boardId: board.id }) },
                { id: 'settings', label: 'Project settings', onSelect: () => navigate(`/boards/${encodeURIComponent(board.id)}/settings`) },
              ]}
              trigger={<IconButton icon={MoreHorizontal} label="Board actions" />}
            />
          </>
        )}
      />
      <BoardStorageNotice persistError={store.persistError} recovery={store.recovery} onDismissRecovery={store.dismissRecovery} className="px-4 pt-3 md:px-8" />
      <BoardToolbar board={board} filters={filters} onChange={setFilters} groupBy={groupBy} onGroupBy={setGroupBy} />
      {(sprint || board.mode === 'scrum' || hiddenDone > 0) && (
        <p className="flex items-center gap-1.5 px-4 pb-2 text-[13px] text-ink-subtle md:px-8">
          <Info size={14} aria-hidden="true" className="shrink-0 text-ink-subtlest" />
          <span>
            {sprint && <><span className="font-semibold text-ink">{sprint.name}</span>{sprint.endDate && <> · ends {sprint.endDate}</>}{sprint.goal && <> · {sprint.goal}</>}. </>}
            {!sprint && board.mode === 'scrum' && <>No sprint is active, so every issue is shown. <Link className="font-medium text-brand hover:underline" to={`/boards/${encodeURIComponent(board.id)}/backlog`}>Plan one in the backlog</Link>. </>}
            {hiddenDone > 0 && <>{hiddenDone} done issue{hiddenDone === 1 ? ' is' : 's are'} hidden: resolved more than {board.hideDoneAfterDays} days ago.</>}
          </span>
        </p>
      )}

      <DndContext
        sensors={sensors}
        accessibility={{ screenReaderInstructions: BOARD_DRAG_INSTRUCTIONS }}
        collisionDetection={closestCorners}
        onDragStart={({ active: a }) => setActive(a.id)}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActive(null)}
      >
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-6 md:px-8">
          {groupBy === 'none' ? (
            <div className="flex min-h-full snap-x snap-mandatory items-start gap-2 md:snap-none">
              {lists.map((list, index) => (
                <BoardColumn
                  key={list.id}
                  list={list}
                  cards={list.cards.filter((c) => shown.has(c.id))}
                  renderCard={renderCard(list.id)}
                  onCreate={create(list.id)}
                  menu={columnMenu(list, index)}
                />
              ))}
              <AddColumn onAdd={(title) => store.addColumn(board.id, { title, index: board.columns.length })} />
            </div>
          ) : (
            <div className="flex w-max min-w-full flex-col gap-1">
              <div className="sticky top-0 z-10 flex gap-2 bg-white pb-1">
                {lists.map((list) => (
                  <div key={list.id} className="flex h-10 w-[272px] shrink-0 items-center gap-2 rounded-md bg-sunken px-3 text-[12px] font-semibold uppercase tracking-[0.03em] text-ink-subtle">
                    {list.title || 'Untitled'} <span className="text-ink-subtlest">{list.cards.filter((c) => shown.has(c.id)).length}</span>
                  </div>
                ))}
              </div>
              {lanes.length === 0 && <p className="py-8 text-center text-sm text-ink-subtlest">No issues match these filters.</p>}
              {lanes.map((lane) => {
                const open = !folded.has(lane.id);
                const inLane = new Set(lane.issues.map((i) => i.id));
                return (
                  <div key={lane.id} className="flex flex-col">
                    <LaneHeader lane={lane} open={open} onToggle={() => setFolded((f) => { const n = new Set(f); if (n.has(lane.id)) n.delete(lane.id); else n.add(lane.id); return n; })} />
                    {open && (
                      <div className="flex items-stretch gap-2">
                        {lists.map((list) => (
                          <BoardColumn key={list.id} list={list} droppableId={`${lane.id}:${list.id}`} showHeader={false} cards={list.cards.filter((c) => inLane.has(c.id))} renderCard={renderCard(list.id)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeCard ? <div className="w-[264px]"><IssueCardView card={activeCard} issueKey={issueKey(board, activeCard)} overlay /></div> : null}
        </DragOverlay>
      </DndContext>
      <IssueHost route={route} />
      <ColumnDialog
        column={columnEdit && board.columns.find((c) => c.id === columnEdit.id)}
        mode={columnEdit?.mode}
        onClose={() => setColumnEdit(null)}
        onSave={(patch) => { store.updateColumn(board.id, columnEdit.id, patch); setColumnEdit(null); }}
      />
    </div>
  );
}
