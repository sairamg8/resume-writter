import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus } from 'lucide-react';
import { useBoardStore } from '@/hooks/useBoardStore';
import { Button, Dialog, EmptyState, Select, TextField, isImeKey, useToast } from '@/components/ui';
import RichTextEditor from '@/components/RichTextEditor';
import { activeSprint, defaultColumnId, issueKey } from '@/utils/boardModel';
import { DateInput, EpicPicker, LabelsPicker, PointsInput, PriorityPicker, SprintPicker, TypePicker } from './IssueFields';

/** The fields a new issue starts with in `board`, from what the opener asked for. */
function initialDraft(board, defaults = {}) {
  const scrumSprint = board?.mode === 'scrum' ? activeSprint(board)?.id ?? null : null;
  return {
    type: defaults.type ?? 'task',
    title: '',
    description: '',
    columnId: defaults.columnId && board?.columns.some((c) => c.id === defaults.columnId) ? defaults.columnId : defaultColumnId(board ?? { columns: [] }),
    priority: 'medium',
    labelIds: [],
    due: defaults.due ?? '',
    startDate: '',
    estimate: null,
    epicId: defaults.epicId ?? null,
    sprintId: defaults.sprintId !== undefined ? defaults.sprintId : scrumSprint,
  };
}

/** One labelled row of the form: the label on the left on wide screens, above on phones. */
function Row({ label, children }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8.5rem_1fr] sm:items-center sm:gap-3">
      <span className="text-[12px] font-semibold text-ink-subtle">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * `draft` moved to `board`: what the user typed that any project can hold (type, summary,
 * description, priority, points, dates) stays; the status, labels, epic and sprint belong to the
 * old project, so they start again from the new one's defaults.
 */
function moveDraft(draft, board, defaults) {
  const { type, title, description, priority, estimate, startDate, due } = draft;
  return { ...initialDraft(board, defaults), type, title, description, priority, estimate, startDate, due };
}

/** The form itself, in the project it creates in. */
function CreateForm({ board, boards, defaults, onBoardChange, onClose }) {
  const store = useBoardStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [draft, setDraft] = useState(() => initialDraft(board, defaults));
  // Another project (picked, or the open one gone): carry the typed fields over rather than
  // remounting, which wiped the summary and description the user had written.
  const [draftBoardId, setDraftBoardId] = useState(board.id);
  if (draftBoardId !== board.id) {
    setDraftBoardId(board.id);
    setDraft((d) => moveDraft(d, board, defaults));
  }
  const [another, setAnother] = useState(false);
  const [error, setError] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const scrum = board.mode === 'scrum' || board.sprints.length > 0;

  function submit(e) {
    e?.preventDefault();
    if (!draft.title.trim()) {
      setError('A summary is required.');
      return;
    }
    const fields = { ...draft, epicId: draft.type === 'epic' ? null : draft.epicId };
    const made = store.addIssue(board.id, fields);
    if (!made) return;
    const key = issueKey(board, made);
    toast({
      tone: 'success',
      title: `${key} has been created`,
      description: made.title,
      action: { label: 'View issue', onClick: () => navigate(`/boards/${encodeURIComponent(board.id)}?issue=${encodeURIComponent(key)}`) },
    });
    if (another) {
      setDraft((d) => ({ ...initialDraft(board, defaults), type: d.type, columnId: d.columnId, epicId: d.epicId, sprintId: d.sprintId }));
      setEditorKey((k) => k + 1);
      setError('');
    } else {
      onClose();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-[13px] text-ink-subtlest">Required fields are marked with an asterisk <span className="text-red-600">*</span></p>
      <Select
        label="Project"
        required
        value={board.id}
        onChange={(e) => onBoardChange(e.target.value)}
        options={boards.map((b) => ({ value: b.id, label: b.key ? `${b.title} (${b.key})` : b.title }))}
      />
      <Row label="Issue type"><TypePicker value={draft.type} onChange={(type) => set({ type })} /></Row>
      <Row label="Status">
        <Select
          aria-label="Status"
          size="sm"
          value={draft.columnId ?? ''}
          onChange={(e) => set({ columnId: e.target.value })}
          options={board.columns.map((c) => ({ value: c.id, label: c.title || 'Untitled' }))}
        />
      </Row>
      <TextField
        label="Summary"
        required
        data-autofocus
        value={draft.title}
        error={error || undefined}
        maxLength={255}
        onChange={(e) => { set({ title: e.target.value }); if (error) setError(''); }}
        // The Enter that picks an input method's word is not a submit: it created the issue half-typed.
        onKeyDown={(e) => { if (e.key === 'Enter' && !isImeKey(e)) submit(e); }}
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-ink-subtle">Description</span>
        <RichTextEditor key={editorKey} ariaLabel="Description" value={draft.description} onChange={(description) => set({ description })} placeholder="Add a description…" rows={4} />
      </div>
      <div className="flex flex-col gap-1 rounded-md border border-line p-2">
        <Row label="Priority"><PriorityPicker value={draft.priority} onChange={(priority) => set({ priority })} /></Row>
        <Row label="Labels">
          <LabelsPicker board={board} value={draft.labelIds} onChange={(labelIds) => set({ labelIds })} onCreateLabel={(l) => store.addLabel(board.id, l)} />
        </Row>
        {draft.type !== 'epic' && <Row label="Parent epic"><EpicPicker board={board} value={draft.epicId} onChange={(epicId) => set({ epicId })} /></Row>}
        {scrum && <Row label="Sprint"><SprintPicker board={board} value={draft.sprintId} onChange={(sprintId) => set({ sprintId })} /></Row>}
        <Row label="Story points"><PointsInput value={draft.estimate} onChange={(estimate) => set({ estimate })} /></Row>
        <Row label="Start date"><DateInput label="Start date" value={draft.startDate} onChange={(startDate) => set({ startDate })} /></Row>
        <Row label="Due date"><DateInput label="Due date" value={draft.due} onChange={(due) => set({ due })} /></Row>
      </div>
      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center gap-3 border-t border-line bg-white px-5 py-3 sm:-mx-6 sm:px-6">
        <label className="mr-auto flex items-center gap-2 text-sm text-ink-subtle">
          <input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} className="size-4 accent-[#0c66e4]" />
          Create another
        </label>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit">Create</Button>
      </div>
    </form>
  );
}

/**
 * The Create issue dialog (the top bar's Create, the `c` key, a column's "+ Create issue"):
 * project, type, status, summary, description, priority, labels, epic, sprint, points and dates,
 * with "Create another" to keep going. Opens in `defaults.boardId` (else the first project) —
 * a workspace with no project yet is offered one first.
 */
export function CreateIssueDialog({ open, defaults = {}, onClose }) {
  const { boards } = useBoardStore();
  const navigate = useNavigate();
  const [chosenId, setChosenId] = useState(null);
  const boardId = chosenId ?? defaults.boardId;
  const board = boards.find((b) => b.id === boardId) ?? boards[0] ?? null;
  const close = () => { setChosenId(null); onClose(); };

  return (
    <Dialog open={open} onClose={close} title="Create issue" size="lg" bodyClassName="px-5 pb-5 sm:px-6">
      {board ? (
        <CreateForm board={board} boards={boards} defaults={board.id === defaults.boardId ? defaults : {}} onBoardChange={setChosenId} onClose={close} />
      ) : (
        <EmptyState
          icon={FolderPlus}
          title="Create a project first"
          description="Issues live in projects. Make one for your work or your life admin, then add issues to it."
          action={<Button variant="primary" onClick={() => { close(); navigate('/boards?create=1'); }}>Create project</Button>}
        />
      )}
    </Dialog>
  );
}
