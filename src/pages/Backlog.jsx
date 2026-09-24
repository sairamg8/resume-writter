import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { useBoardStore } from '@/hooks/useBoardStore';
import { PageHeader } from '@/components/shell/PageHeader';
import { ProjectTabs } from '@/components/board/ProjectTabs';
import { BoardStorageNotice } from '@/components/board/BoardStorageNotice';
import { backlogSections } from '@/utils/boardQuery';
import { activeSprint, addDays, issueKey, statusColumn, todayISO } from '@/utils/boardModel';
import { DEFAULT_SPRINT_DAYS } from '@/constants/boards';

const BACKLOG = 'backlog';

/** "3 issues · 1 done · 5 points" — a section's totals (boardQuery.issueStats). */
function statsLine({ issues, done, points }) {
  const parts = [`${issues} issue${issues === 1 ? '' : 's'}`, `${done} done`];
  if (points) parts.push(`${points} point${points === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/** The form that starts a future sprint: its name, dates (today and two weeks on) and goal. */
function StartSprintForm({ sprint, onStart, onCancel }) {
  const today = todayISO();
  const [name, setName] = useState(sprint.name);
  const [startDate, setStartDate] = useState(sprint.startDate || today);
  const [endDate, setEndDate] = useState(sprint.endDate || addDays(sprint.startDate || today, DEFAULT_SPRINT_DAYS));
  const [goal, setGoal] = useState(sprint.goal);
  const input = 'w-full text-sm px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400';
  return (
    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-indigo-50/60 border border-indigo-100 rounded-xl p-3">
      <label className="text-xs text-gray-600 sm:col-span-2">Sprint name
        <input aria-label="Sprint name" value={name} onChange={(e) => setName(e.target.value)} className={input} />
      </label>
      <label className="text-xs text-gray-600">Start date
        <input aria-label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} />
      </label>
      <label className="text-xs text-gray-600">End date
        <input aria-label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} />
      </label>
      <label className="text-xs text-gray-600 sm:col-span-2">Sprint goal
        <input aria-label="Sprint goal" value={goal} onChange={(e) => setGoal(e.target.value)} className={input} />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button onClick={() => onStart({ name, startDate, endDate, goal })} className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Start</button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900">Cancel</button>
      </div>
    </div>
  );
}

/** The form that completes the active sprint: where its open issues go (the backlog or a future sprint). */
function CompleteSprintForm({ open, futures, onComplete, onCancel }) {
  const [to, setTo] = useState(BACKLOG);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 text-xs text-gray-700">
      {open > 0 ? (
        <label className="flex items-center gap-2">
          {open} open issue{open === 1 ? '' : 's'} move to
          <select aria-label="Move open issues to" value={to} onChange={(e) => setTo(e.target.value)} className="text-xs px-2 py-1 rounded-lg border border-gray-200">
            <option value={BACKLOG}>the backlog</option>
            {futures.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      ) : (
        <span>Every issue in this sprint is done.</span>
      )}
      <button onClick={() => onComplete(to === BACKLOG ? null : to)} className="px-3 py-1.5 font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">Complete</button>
      <button onClick={onCancel} className="px-3 py-1.5 font-semibold text-gray-600 hover:text-gray-900">Cancel</button>
    </div>
  );
}

/** A section's name: click to rename (a sprint's; the backlog's is fixed). */
function SprintName({ sprint, onRename }) {
  const [draft, setDraft] = useState(null);
  if (draft === null) {
    return (
      <button onClick={() => setDraft(sprint.name)} title="Rename sprint" className="text-sm font-semibold text-gray-900 hover:bg-gray-100 rounded px-1 truncate">
        {sprint.name}
      </button>
    );
  }
  const commit = () => {
    if (draft.trim() && draft.trim() !== sprint.name) onRename(draft.trim());
    setDraft(null);
  };
  return (
    <input
      autoFocus
      aria-label="Sprint name"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(null);
      }}
      className="text-sm font-semibold px-1.5 py-0.5 rounded border border-indigo-300 focus:outline-none"
    />
  );
}

/** "Add an issue" at the foot of a section: a title, then Enter. */
function AddIssue({ onAdd }) {
  const [title, setTitle] = useState('');
  const add = () => {
    if (!title.trim()) return;
    onAdd(title.trim());
    setTitle('');
  };
  return (
    <div className="flex gap-2 px-3 py-2">
      <input
        aria-label="New issue"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
        placeholder="Add an issue…"
        className="flex-1 text-sm px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <button onClick={add} disabled={!title.trim()} className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40">Add</button>
    </div>
  );
}

/**
 * A project's backlog (/boards/:id/backlog) — where sprints are planned: the active sprint, each
 * future sprint, then the backlog (boardQuery.backlogSections), each with its issues and totals.
 * Create a sprint, move an issue between sections, start a future sprint (name, dates — today and
 * two weeks on — and goal; one at a time), complete the active one (its open issues go to the
 * backlog or a future sprint), rename or delete a sprint (its issues go to the backlog). Sprints
 * are a Scrum project's: a Kanban project is offered the switch, and its board then shows the
 * active sprint (boardView.boardSprint).
 */
export function Backlog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useBoardStore();
  const board = store.boards.find((b) => b.id === id);
  const [starting, setStarting] = useState(null); // id of the sprint whose start form is open
  const [completing, setCompleting] = useState(false);

  if (!board) {
    return (
      <div className="min-h-screen bg-[#f5f3ef] flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-gray-500">This board doesn’t exist.</p>
        <button onClick={() => navigate('/boards')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Back to boards</button>
      </div>
    );
  }

  const base = `/boards/${encodeURIComponent(board.id)}`;
  const sections = backlogSections(board);
  const active = activeSprint(board);
  const futures = board.sprints.filter((s) => s.state === 'future');
  const scrum = board.mode === 'scrum';
  // Where an issue can go: each open sprint, then the backlog.
  const targets = [...(active ? [active] : []), ...futures].map((s) => ({ value: s.id, label: s.name })).concat({ value: BACKLOG, label: 'Backlog' });

  function moveTo(issue, value) {
    store.moveIssue(board.id, issue.id, { sprintId: value === BACKLOG ? null : value });
  }

  function start(sprintId, fields) {
    store.startSprint(board.id, sprintId, fields);
    setStarting(null);
  }

  function complete(moveOpenTo) {
    store.completeSprint(board.id, active.id, { moveOpenTo });
    setCompleting(false);
  }

  return (
    <div className="flex flex-col min-h-full bg-[#f5f3ef]">
      <PageHeader
        title="Backlog"
        breadcrumbs={[{ label: 'Projects', to: '/boards' }, { label: board.title, to: base }, { label: 'Backlog' }]}
        tabs={<ProjectTabs boardId={board.id} />}
        actions={scrum && (
          <button onClick={() => store.addSprint(board.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">
            <Plus size={13} /> Create sprint
          </button>
        )}
      />

      <BoardStorageNotice persistError={store.persistError} recovery={store.recovery} onDismissRecovery={store.dismissRecovery} className="max-w-5xl w-full mx-auto px-4 sm:px-6 pt-3" />

      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-5 space-y-4">
        {scrum ? (
          <p className="text-xs text-gray-500">
            Scrum: the board shows the active sprint.{' '}
            <button onClick={() => store.updateBoard(board.id, { mode: 'kanban' })} className="font-semibold text-indigo-600 hover:text-indigo-800">Switch to Kanban</button>
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <p className="flex-1 min-w-[12rem] text-sm text-gray-600">This project is Kanban: its board shows every issue. Use sprints to plan work in time-boxed iterations — the board then shows the active sprint.</p>
            <button onClick={() => store.updateBoard(board.id, { mode: 'scrum' })} className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Use sprints</button>
          </div>
        )}

        {sections.filter((s) => scrum || s.kind === 'backlog').map((section) => {
          const { sprint } = section;
          const isActive = sprint?.state === 'active';
          return (
            <section key={section.id} data-section={section.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-gray-100">
                {sprint ? <SprintName sprint={sprint} onRename={(name) => store.updateSprint(board.id, sprint.id, { name })} /> : <span className="text-sm font-semibold text-gray-900 px-1">Backlog</span>}
                {isActive && <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">Active</span>}
                {sprint?.startDate && <span className="text-[11px] text-gray-400">{sprint.startDate} → {sprint.endDate}</span>}
                <span className="text-[11px] text-gray-400">{statsLine(section.stats)}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  {sprint?.state === 'future' && (
                    <button
                      onClick={() => setStarting(sprint.id)}
                      disabled={Boolean(active)}
                      title={active ? 'Complete the active sprint first' : 'Start sprint'}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-40"
                    >
                      <Play size={11} /> Start sprint
                    </button>
                  )}
                  {isActive && (
                    <button onClick={() => setCompleting(true)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">
                      <CheckCircle2 size={11} /> Complete sprint
                    </button>
                  )}
                  {sprint && (
                    <button
                      onClick={() => { if (confirm(`Delete "${sprint.name}"? Its issues go to the backlog.`)) store.deleteSprint(board.id, sprint.id); }}
                      aria-label="Delete sprint"
                      title="Delete sprint"
                      className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </span>
                {sprint?.goal && <p className="basis-full text-xs text-gray-500 px-1">{sprint.goal}</p>}
                {starting === sprint?.id && sprint && (
                  <div className="basis-full"><StartSprintForm sprint={sprint} onStart={(fields) => start(sprint.id, fields)} onCancel={() => setStarting(null)} /></div>
                )}
                {isActive && completing && (
                  <div className="basis-full">
                    <CompleteSprintForm open={section.stats.open} futures={futures} onComplete={complete} onCancel={() => setCompleting(false)} />
                  </div>
                )}
              </div>

              {section.issues.length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-400">{sprint ? 'No issues yet: move some here from the backlog.' : 'The backlog is empty.'}</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {section.issues.map((issue) => (
                    <li key={issue.id} data-issue={issue.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="text-[11px] font-mono text-gray-400 shrink-0">{issueKey(board, issue)}</span>
                      <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{issue.title}</span>
                      <span className="text-[11px] text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 shrink-0">{statusColumn(board, issue)?.title}</span>
                      {scrum && (
                        <select
                          aria-label={`Move ${issueKey(board, issue)} to`}
                          value={section.kind === 'backlog' ? BACKLOG : section.id}
                          onChange={(e) => moveTo(issue, e.target.value)}
                          className="text-xs px-1.5 py-1 rounded-lg border border-gray-200 shrink-0 max-w-[9rem]"
                        >
                          {targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <AddIssue onAdd={(title) => store.addIssue(board.id, { title, sprintId: sprint?.id ?? null })} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
