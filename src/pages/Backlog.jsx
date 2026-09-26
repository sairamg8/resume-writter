import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, Layers, MoreHorizontal } from 'lucide-react';
import { DndContext, MouseSensor, TouchSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useBoardStore } from '@/hooks/useBoardStore';
import { Button, EmptyState, IconButton, InlineEdit, Menu, cx, useConfirmOptional, useToast, useUrlState } from '@/components/ui';
import { BoardStorageNotice } from '@/components/board/BoardStorageNotice';
import { BoardToolbar, EMPTY_FILTERS } from '@/components/board/BoardToolbar';
import { ProjectHeader } from '@/components/board/ProjectTabs';
import { InlineCreate } from '@/components/board/InlineCreate';
import { IssueHost, useIssueActions, useIssueRoute } from '@/components/board/useIssueActions';
import { BacklogRow, CompleteSprintDialog, EpicPanel, PointBubbles, StartSprintDialog, sprintDates } from '@/components/board/BacklogParts';
import { backlogSections, filterIssues } from '@/utils/boardQuery';
import { activeSprint, issueKey } from '@/utils/boardModel';
import { boardCollision } from '@/utils/boardDnd';

/**
 * A sprint's (or the backlog's) section, droppable as a whole: a row dropped anywhere in it — its
 * header, its empty space, its "Create issue" row, or the header of a folded section — lands at its
 * foot. The whole section, not its body alone: the backlog asks what is under the pointer
 * (R4-BRD-07), and a body alone refused drops on the header and the create row that used to land.
 */
function DroppableSection({ id, sprintId, children, ...props }) {
  const { setNodeRef, isOver } = useDroppable({ id: `section:${id}`, data: { type: 'section', sprintId } });
  return <section ref={setNodeRef} {...props} className={cx('rounded-md p-2 transition-colors', isOver ? 'bg-brand-subtle' : 'bg-sunken')}>{children}</section>;
}

/**
 * A project's backlog (/boards/:id/backlog) — where work is planned: the active sprint, each future
 * sprint, then the backlog, each a folding container with its issues, counts and points by status.
 * Drag rows to reorder or to move them between sprints (or use a row's ⋯ menu); create issues in
 * place; start, complete, rename or delete sprints. The Epic panel filters by epic. A kanban
 * project plans in one backlog and may switch to sprints.
 */
export function Backlog() {
  const { id } = useParams();
  const store = useBoardStore();
  const confirm = useConfirmOptional();
  const { toast } = useToast();
  const board = store.boards.find((b) => b.id === id);
  const route = useIssueRoute(store.boards, board);
  const actions = useIssueActions(board ?? { id, key: '', columns: [], issues: [] });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [epicsOpen, setEpicsOpen] = useState(false);
  const [folded, setFolded] = useState(() => new Set());
  const [starting, setStarting] = useState(null);
  const [completing, setCompleting] = useState(false);
  // The board's "Complete sprint" links here with ?complete=1, which opens the dialog for the
  // active sprint (R4-BRD-13). With no sprint to complete, the page drops it from the address.
  const [completeParam, setCompleteParam] = useUrlState('complete');
  const canComplete = Boolean(board && board.mode === 'scrum' && activeSprint(board));
  useEffect(() => {
    if (completeParam && board && !canComplete) setCompleteParam(null);
  }, [completeParam, board, canComplete, setCompleteParam]);
  const stopCompleting = () => { setCompleting(false); setCompleteParam(null); };
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  if (!board) {
    return <EmptyState className="m-auto" title="This project doesn’t exist" description="It may have been deleted, or the link is wrong." action={<Button variant="primary" to="/boards">View all projects</Button>} />;
  }

  const scrum = board.mode === 'scrum';
  const active = activeSprint(board);
  const futures = board.sprints.filter((s) => s.state === 'future');
  // A Kanban project plans in one backlog, with no sprint sections: every open issue belongs in
  // it, including one still in a sprint from when the project used sprints (R4-BRD-08).
  const all = backlogSections(scrum ? board : { ...board, sprints: [] }, board.issues.filter((i) => i.type !== 'epic'));
  const sections = all.map((s) => ({ ...s, shown: filterIssues(board, filters, { issues: s.issues }) }));
  const targets = [...(active ? [active] : []), ...futures].map((s) => ({ id: s.id, name: s.name })).concat({ id: null, name: 'Backlog' });
  const toggleFold = (sid) => setFolded((f) => { const n = new Set(f); if (n.has(sid)) n.delete(sid); else n.add(sid); return n; });

  function onDragEnd({ active: a, over }) {
    if (!over || over.id === a.id) return;
    const from = sections.find((s) => s.shown.some((i) => i.id === a.id));
    const data = over.data.current ?? {};
    // A Kanban project's one backlog holds issues of every sprint (R4-BRD-08): a row still in one
    // leaves it (null); one in none keeps none, and its place is read off the whole backlog
    // (undefined), not off the issues in no sprint alone — or a drop among the others was a no-op.
    const dragged = board.issues.find((i) => i.id === a.id);
    const sprintId = scrum ? data.sprintId ?? null : (dragged?.sprintId ? null : undefined);
    let beforeId = null;
    if (data.type === 'row') {
      beforeId = over.id;
      const to = sections.find((s) => s.shown.some((i) => i.id === over.id));
      if (to && from && to.id === from.id) {
        const ids = to.shown.map((i) => i.id);
        if (ids.indexOf(over.id) > ids.indexOf(a.id)) beforeId = ids[ids.indexOf(over.id) + 1] ?? null;
      }
    }
    store.moveIssue(board.id, a.id, { sprintId, beforeId });
  }

  async function removeSprint(sprint) {
    const ok = await confirm({ title: `Delete ${sprint.name}?`, body: 'Its issues move to the backlog.', confirmLabel: 'Delete sprint', tone: 'danger' });
    if (ok) { store.deleteSprint(board.id, sprint.id); toast({ title: `${sprint.name} deleted` }); }
  }

  const completingSection = (completing || completeParam) && active ? all.find((s) => s.id === active.id) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProjectHeader board={board} />
      <BoardStorageNotice persistError={store.persistError} recovery={store.recovery} onDismissRecovery={store.dismissRecovery} className="px-4 pt-3 md:px-8" />
      <BoardToolbar
        board={board}
        filters={filters}
        onChange={setFilters}
        right={<Button size="md" leftIcon={Layers} onClick={() => setEpicsOpen((o) => !o)} aria-pressed={epicsOpen}>Epic panel</Button>}
      />
      {!scrum && (
        <div className="mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-md border border-line bg-sunken px-4 py-3 md:mx-8">
          <p className="min-w-[14rem] flex-1 text-sm text-ink-subtle">
            <span className="font-semibold text-ink">Plan in sprints?</span> This project runs as Kanban: its board shows every issue. With sprints you plan time-boxed iterations, and the board shows the active one.
          </p>
          <Button variant="primary" onClick={() => store.updateBoard(board.id, { mode: 'scrum' })}>Use sprints</Button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 pb-8 md:px-8 lg:flex-row">
        {epicsOpen && (
          <EpicPanel
            board={board}
            selected={filters.epicIds}
            onToggle={(eid) => setFilters((f) => ({ ...f, epicIds: f.epicIds.includes(eid) ? f.epicIds.filter((x) => x !== eid) : [...f.epicIds, eid] }))}
            onOpen={route.open}
            onCreate={(title) => store.addIssue(board.id, { title, type: 'epic' })}
            onClose={() => setEpicsOpen(false)}
          />
        )}
        {/* What is under the pointer, not the nearest section: a row released outside every section stays put (R4-BRD-07). */}
        <DndContext sensors={sensors} collisionDetection={boardCollision} onDragEnd={onDragEnd}>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {sections.map((section) => {
              const { sprint } = section;
              const open = !folded.has(section.id);
              const sprintId = sprint?.id ?? null;
              return (
                <DroppableSection key={section.id} id={section.id} sprintId={sprintId} data-section={section.id} aria-label={sprint ? sprint.name : 'Backlog'}>
                  <header className="flex flex-wrap items-center gap-2 px-1 py-1">
                    <button type="button" aria-expanded={open} aria-label={`${open ? 'Fold' : 'Unfold'} ${sprint ? sprint.name : 'the backlog'}`} onClick={() => toggleFold(section.id)} className="rounded p-1 text-ink-subtle hover:bg-neutral-fill">
                      <ChevronDown size={16} aria-hidden="true" className={cx('transition-transform', !open && '-rotate-90')} />
                    </button>
                    {sprint
                      ? <InlineEdit value={sprint.name} onCommit={(name) => store.updateSprint(board.id, sprint.id, { name })} label="Sprint name" className="text-sm font-semibold text-ink" />
                      : <h2 className="text-sm font-semibold text-ink">Backlog</h2>}
                    {sprint?.state === 'active' && <span className="rounded-[3px] bg-loz-progress px-1 text-[11px] font-bold uppercase text-loz-progress-ink">Active</span>}
                    {sprintDates(sprint) && <span className="text-[13px] text-ink-subtle">{sprintDates(sprint)}</span>}
                    <span className="text-[13px] text-ink-subtlest">({section.stats.issues} issue{section.stats.issues === 1 ? '' : 's'})</span>
                    <span className="ml-auto flex items-center gap-2">
                      <PointBubbles board={board} issues={section.issues} />
                      {sprint?.state === 'future' && (
                        <Button size="sm" onClick={() => setStarting(sprint)} disabled={Boolean(active) || section.stats.issues === 0} title={active ? 'Complete the active sprint first' : section.stats.issues === 0 ? 'Add issues to start this sprint' : 'Start sprint'}>
                          Start sprint
                        </Button>
                      )}
                      {sprint?.state === 'active' && <Button size="sm" onClick={() => setCompleting(true)}>Complete sprint</Button>}
                      {!sprint && scrum && <Button size="sm" onClick={() => store.addSprint(board.id)}>Create sprint</Button>}
                      {sprint && (
                        <Menu
                          label={`${sprint.name} actions`}
                          items={[{ id: 'del', label: 'Delete sprint', danger: true, onSelect: () => removeSprint(sprint) }]}
                          trigger={<IconButton icon={MoreHorizontal} label={`${sprint.name} actions`} size="sm" />}
                        />
                      )}
                    </span>
                    {sprint?.goal && <p className="basis-full pl-9 text-[13px] text-ink-subtle">{sprint.goal}</p>}
                  </header>
                  {open && (
                    <div className="mt-1 flex flex-col gap-1">
                      <div className="min-h-10 rounded-sm">
                        {section.shown.length === 0 ? (
                          <p className="rounded border-2 border-dashed border-line px-4 py-3 text-center text-[13px] text-ink-subtlest">
                            {section.issues.length ? 'No issues here match the filters.' : sprint ? 'Plan this sprint: drag issues here from the backlog, or create one.' : 'Your backlog is empty.'}
                          </p>
                        ) : (
                          <SortableContext items={section.shown.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                            <ul className="overflow-hidden rounded border border-line">
                              {section.shown.map((issue) => (
                                <BacklogRow
                                  key={issue.id}
                                  board={board}
                                  issue={issue}
                                  sprintId={sprintId}
                                  targets={targets}
                                  onOpen={() => route.open(issueKey(board, issue))}
                                  onStatus={(columnId) => store.updateIssue(board.id, issue.id, { columnId })}
                                  onMove={(to) => store.moveIssue(board.id, issue.id, { sprintId: to })}
                                  onDelete={() => actions.remove(issue)}
                                />
                              ))}
                            </ul>
                          </SortableContext>
                        )}
                      </div>
                      <InlineCreate variant="row" onCreate={({ title, type }) => store.addIssue(board.id, { title, type, sprintId })} />
                    </div>
                  )}
                </DroppableSection>
              );
            })}
          </div>
        </DndContext>
      </div>
      <StartSprintDialog key={starting?.id ?? 'none'} sprint={starting} onClose={() => setStarting(null)} onStart={(f) => { store.startSprint(board.id, starting.id, f); setStarting(null); toast({ tone: 'success', title: `${f.name?.trim() || starting.name} started` }); }} />
      <CompleteSprintDialog
        key={completingSection ? 'open' : 'closed'}
        sprint={completingSection?.sprint}
        stats={completingSection?.stats}
        futures={futures}
        onClose={stopCompleting}
        onComplete={(moveOpenTo) => { store.completeSprint(board.id, active.id, { moveOpenTo }); stopCompleting(); toast({ tone: 'success', title: `${active.name} completed` }); }}
      />
      <IssueHost route={route} />
    </div>
  );
}
