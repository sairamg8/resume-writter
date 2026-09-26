import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useBoardStore } from '@/hooks/useBoardStore';
import { ProjectHeader } from '@/components/board/ProjectTabs';
import { BoardStorageNotice } from '@/components/board/BoardStorageNotice';
import { Button, EmptyState, useConfirmOptional, useToast } from '@/components/ui';
import { BOARD_COLORS, BOARD_MODES, COLUMN_CATEGORIES, DEFAULT_HIDE_DONE_DAYS, LABEL_COLORS } from '@/constants/boards';
import { cleanTitle } from '@/utils/boardModel';

const FIELD = 'text-sm px-2 py-1.5 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-brand';

/**
 * A text field that saves when it is left or Enter is pressed (Escape puts the saved value back),
 * so each keystroke is not a save. Shows the saved `value` whenever it is not being edited.
 */
function CommitField({ value, onCommit, multiline = false, ...props }) {
  const [draft, setDraft] = useState(null);
  const commit = () => {
    if (draft !== null && draft !== String(value ?? '')) onCommit(draft);
    setDraft(null);
  };
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <Tag
      {...props}
      value={draft ?? String(value ?? '')}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !multiline) commit();
        if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
}

/** One settings card: a heading, an optional line under it, and its controls. */
function Card({ title, note, children, tone = 'default' }) {
  return (
    <section className={`bg-white border rounded-md  p-4 space-y-3 ${tone === 'danger' ? 'border-red-200' : 'border-line'}`}>
      <div>
        <h2 className={`text-sm font-semibold ${tone === 'danger' ? 'text-red-700' : 'text-ink'}`}>{title}</h2>
        {note && <p className="text-xs text-ink-subtlest mt-0.5">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** The project's key: a live check (keyError) and a Save; issue keys change with it. */
function KeyField({ board, keyError, onSave }) {
  const [draft, setDraft] = useState(board.key);
  const [refused, setRefused] = useState(null);
  const next = draft.trim().toUpperCase();
  const problem = next === board.key ? null : keyError(next, board.id);
  function save() {
    const reason = onSave(next);
    setRefused(reason);
    if (!reason) setDraft(next);
  }
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input aria-label="Project key" value={draft} onChange={(e) => { setDraft(e.target.value); setRefused(null); }} className={`${FIELD} w-32 font-mono uppercase`} />
        <button onClick={save} disabled={next === board.key || Boolean(problem)} className="px-3 py-1.5 text-xs font-semibold text-white bg-brand rounded-lg hover:bg-brand-hover disabled:opacity-40">Save key</button>
      </div>
      {(problem || refused) && <p role="alert" className="text-xs text-red-600">{refused || problem}</p>}
      <p className="text-xs text-ink-subtlest">Issue keys use it: {board.key}-1 becomes {next || board.key}-1.</p>
    </div>
  );
}

/** A column's row: title, category, WIP limit, move up/down, delete (its issues go to another column). */
function ColumnRow({ board, column, index, store }) {
  const [deleting, setDeleting] = useState(false);
  const others = board.columns.filter((c) => c.id !== column.id);
  const [target, setTarget] = useState(others[0]?.id ?? '');
  const count = board.issues.filter((i) => i.columnId === column.id).length;
  const last = board.columns.length === 1;
  const confirm = useConfirmOptional();

  async function remove() {
    if (count === 0) {
      if (await confirm({ title: `Delete the ${column.title} column?`, body: 'It holds no issues.', confirmLabel: 'Delete column', tone: 'danger' })) store.deleteColumn(board.id, column.id);
      return;
    }
    setDeleting(true);
  }

  return (
    <li data-column={column.id} className="py-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <CommitField aria-label="Column title" value={column.title} onCommit={(title) => store.updateColumn(board.id, column.id, { title })} className={`${FIELD} flex-1 min-w-[8rem]`} />
        <select aria-label="Column category" value={column.category} onChange={(e) => store.updateColumn(board.id, column.id, { category: e.target.value })} className={FIELD}>
          {COLUMN_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-ink-subtlest">WIP
          <CommitField aria-label="WIP limit" type="number" min="1" placeholder="none" value={column.wipLimit ?? ''} onCommit={(v) => store.updateColumn(board.id, column.id, { wipLimit: v })} className={`${FIELD} w-20`} />
        </label>
        <span className="text-xs text-ink-subtlest w-16">{count} issue{count === 1 ? '' : 's'}</span>
        <button aria-label="Move column up" title="Move up" disabled={index === 0} onClick={() => store.moveColumn(board.id, column.id, index - 1)} className="p-1 text-ink-subtlest hover:text-ink-subtle disabled:opacity-30"><ArrowUp size={14} /></button>
        <button aria-label="Move column down" title="Move down" disabled={index === board.columns.length - 1} onClick={() => store.moveColumn(board.id, column.id, index + 1)} className="p-1 text-ink-subtlest hover:text-ink-subtle disabled:opacity-30"><ArrowDown size={14} /></button>
        <button aria-label="Delete column" title={last ? 'A project keeps at least one column' : 'Delete column'} disabled={last} onClick={remove} className="p-1 text-gray-300 hover:text-red-500 disabled:opacity-30"><Trash2 size={14} /></button>
      </div>
      {deleting && (
        <div className="flex flex-wrap items-center gap-2 bg-red-50 border border-red-100 rounded-md p-2 text-xs text-ink-subtle">
          <label className="flex items-center gap-2">
            Its {count} issue{count === 1 ? '' : 's'} move to
            <select aria-label="Move its issues to" value={target} onChange={(e) => setTarget(e.target.value)} className="text-xs px-2 py-1 rounded-lg border border-line">
              {others.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          <button onClick={() => { store.deleteColumn(board.id, column.id, target); setDeleting(false); }} className="px-3 py-1 font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700">Delete column</button>
          <button onClick={() => setDeleting(false)} className="px-3 py-1 font-semibold text-ink-subtle">Cancel</button>
        </div>
      )}
    </li>
  );
}

/** "Add" row: a name (and for labels a colour), then Add or Enter. */
function AddRow({ label, onAdd, colors }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(colors?.[0]?.color);
  const add = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), color);
    setName('');
  };
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <input aria-label={label} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder={`${label}…`} className={`${FIELD} flex-1 min-w-[8rem]`} />
      {colors && (
        <select aria-label="New label colour" value={color} onChange={(e) => setColor(e.target.value)} className={FIELD}>
          {colors.map((c) => <option key={c.color} value={c.color}>{c.name}</option>)}
        </select>
      )}
      <button onClick={add} disabled={!name.trim()} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-brand rounded-lg hover:bg-brand-hover disabled:opacity-40"><Plus size={12} /> Add</button>
    </div>
  );
}

/** The colours a label can take: the palette, plus its own when that is not in it. */
const labelColors = (color) => (LABEL_COLORS.some((c) => c.color === color) ? LABEL_COLORS : [...LABEL_COLORS, { name: color, color }]);

/**
 * A project's settings (/boards/:id/settings): its details (name, key, description, colour, Kanban
 * or Scrum), its columns (add, rename, category, WIP limit, reorder, delete — the issues moving to
 * another column), its labels (add, rename, recolour, delete — off every issue), how long done
 * issues stay on the board, and deleting the project. Every change goes through the board store's
 * actions, which refuse what would lose data (the last column, a taken key, a taken label name).
 */
export function BoardSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useBoardStore();
  const board = store.boards.find((b) => b.id === id);
  const [labelRefused, setLabelRefused] = useState(null);
  const confirm = useConfirmOptional();
  const { toast } = useToast();

  if (!board) {
    return <EmptyState className="m-auto" title="This project doesn’t exist" description="It may have been deleted, or the link is wrong." action={<Button variant="primary" to="/boards">View all projects</Button>} />;
  }

  const hides = board.hideDoneAfterDays !== null;

  // A label name as the store compares it: cleanTitle (runs of spaces one, trimmed), case aside.
  // Compared only trimmed and lower-cased here, "Needs  parts" was not "Needs parts": no message
  // was shown, and the store then refused the name without a word (R2-041b).
  const sameLabelName = (a, b) => cleanTitle(a).toLowerCase() === cleanTitle(b).toLowerCase();

  function renameLabel(label, name) {
    const taken = board.labels.some((l) => l.id !== label.id && sameLabelName(l.name, name));
    setLabelRefused(taken ? `Another label is already called “${cleanTitle(name)}”.` : null);
    if (!taken) store.updateLabel(board.id, label.id, { name });
  }

  function addLabel(name, color) {
    const taken = board.labels.some((l) => sameLabelName(l.name, name));
    setLabelRefused(taken ? `A label called “${cleanTitle(name)}” already exists.` : null);
    if (!taken) store.addLabel(board.id, { name, color });
  }

  async function deleteLabel(label) {
    const used = board.issues.filter((i) => i.labelIds.includes(label.id)).length;
    if (used === 0 || await confirm({ title: `Delete the label “${label.name}”?`, body: `It comes off ${used} issue${used === 1 ? '' : 's'}.`, confirmLabel: 'Delete label', tone: 'danger' })) store.deleteLabel(board.id, label.id);
  }

  async function deleteProject() {
    const ok = await confirm({ title: `Delete ${board.title}?`, body: `The project and its ${board.issues.length} issue${board.issues.length === 1 ? '' : 's'} will be deleted. You can undo this for a few seconds.`, confirmLabel: 'Delete project', tone: 'danger' });
    if (!ok) return;
    navigate('/boards');
    const removed = store.deleteBoard(board.id);
    if (removed) toast({ title: `${board.title} deleted`, action: { label: 'Undo', onClick: () => store.restoreBoard(removed) } });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProjectHeader board={board} />
      <h2 className="mx-auto w-full max-w-3xl px-4 pt-5 text-xl font-semibold text-ink sm:px-6">Project settings</h2>
      <BoardStorageNotice persistError={store.persistError} recovery={store.recovery} onDismissRecovery={store.dismissRecovery} className="max-w-3xl w-full mx-auto px-4 sm:px-6 pt-3" />

      <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-5 space-y-4">
        <Card title="Details">
          <label className="block text-xs text-ink-subtle space-y-1">Name
            <CommitField aria-label="Project name" value={board.title} onCommit={(title) => store.updateBoard(board.id, { title })} className={`${FIELD} w-full`} />
          </label>
          <div className="text-xs text-ink-subtle space-y-1">Key
            <KeyField key={board.key} board={board} keyError={store.keyError} onSave={(key) => store.updateBoard(board.id, { key })} />
          </div>
          <label className="block text-xs text-ink-subtle space-y-1">Description
            <CommitField multiline rows={3} aria-label="Project description" value={board.description} onCommit={(description) => store.updateBoard(board.id, { description })} className={`${FIELD} w-full`} />
          </label>
          <div className="text-xs text-ink-subtle space-y-1">Colour
            <div className="flex flex-wrap gap-1.5">
              {BOARD_COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`Colour ${c}`}
                  aria-pressed={board.color === c}
                  onClick={() => store.updateBoard(board.id, { color: c })}
                  className={`h-7 w-7 rounded-full border-2 ${board.color === c ? 'border-gray-900' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <label className="block text-xs text-ink-subtle space-y-1">Way of working
            <select aria-label="Project mode" value={board.mode} onChange={(e) => store.updateBoard(board.id, { mode: e.target.value })} className={`${FIELD} w-full`}>
              {BOARD_MODES.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.description}</option>)}
            </select>
          </label>
        </Card>

        <Card title="Columns" note="Issues in a Done column count as resolved. A WIP limit turns a column's count red when it holds more.">
          <ul className="divide-y divide-line-subtle">
            {board.columns.map((c, n) => <ColumnRow key={c.id} board={board} column={c} index={n} store={store} />)}
          </ul>
          <AddRow label="New column" onAdd={(title) => store.addColumn(board.id, { title, index: board.columns.length })} />
        </Card>

        <Card title="Labels">
          {board.labels.length === 0 && <p className="text-xs text-ink-subtlest">No labels yet.</p>}
          <ul className="divide-y divide-line-subtle">
            {board.labels.map((l) => (
              <li key={l.id} data-label={l.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                <CommitField aria-label="Label name" value={l.name} onCommit={(name) => renameLabel(l, name)} className={`${FIELD} flex-1 min-w-[8rem]`} />
                <select aria-label="Label colour" value={l.color} onChange={(e) => store.updateLabel(board.id, l.id, { color: e.target.value })} className={FIELD}>
                  {labelColors(l.color).map((c) => <option key={c.color} value={c.color}>{c.name}</option>)}
                </select>
                <button aria-label="Delete label" title="Delete label" onClick={() => deleteLabel(l)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
          {labelRefused && <p role="alert" className="text-xs text-red-600">{labelRefused}</p>}
          <AddRow label="New label" colors={LABEL_COLORS} onAdd={addLabel} />
        </Card>

        <Card title="Done issues on the board" note="Done issues resolved longer ago than this leave the board; they stay in the project.">
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-subtle">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label="Hide old done issues"
                checked={hides}
                onChange={() => store.updateBoard(board.id, { hideDoneAfterDays: hides ? null : DEFAULT_HIDE_DONE_DAYS })}
              />
              Hide done issues after
            </label>
            <CommitField
              aria-label="Days before done issues are hidden"
              type="number"
              min="0"
              disabled={!hides}
              value={hides ? board.hideDoneAfterDays : ''}
              onCommit={(v) => { const n = Number(v); if (v.trim() !== '' && Number.isInteger(n) && n >= 0) store.updateBoard(board.id, { hideDoneAfterDays: n }); }}
              className={`${FIELD} w-20 disabled:opacity-40`}
            />
            days
          </div>
        </Card>

        <Card title="Delete project" tone="danger" note="Deletes the project with every issue, sprint and label in it.">
          <Button variant="danger" onClick={deleteProject}>Delete project</Button>
        </Card>
      </div>
    </div>
  );
}
