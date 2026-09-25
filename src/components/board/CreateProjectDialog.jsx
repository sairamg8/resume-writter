import { useState } from 'react';
import { Check } from 'lucide-react';
import { useBoardStore } from '@/hooks/useBoardStore';
import { Button, Dialog, TextArea, TextField, cx } from '@/components/ui';
import { BOARD_COLORS, BOARD_TEMPLATES } from '@/constants/boards';
import { deriveKey, keyInput } from '@/utils/boardModel';

/** The form, fresh each time the dialog opens. */
function ProjectForm({ onCreated, onClose }) {
  const store = useBoardStore();
  const [title, setTitle] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [template, setTemplate] = useState('kanban');
  const [color, setColor] = useState(BOARD_COLORS[store.boards.length % BOARD_COLORS.length]);
  const [description, setDescription] = useState('');
  const [tried, setTried] = useState(false);
  const shownKey = keyTouched ? key : (title.trim() ? deriveKey(title, store.boards.map((b) => b.key)) : '');
  const keyProblem = shownKey ? store.keyError(shownKey) : null;
  const nameProblem = tried && !title.trim() ? 'A project needs a name.' : null;

  function submit(e) {
    e.preventDefault();
    setTried(true);
    if (!title.trim() || keyProblem) return;
    const board = store.addBoard({ title: title.trim(), key: shownKey || undefined, template, color, description });
    onCreated(board);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <TextField label="Name" required data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} error={nameProblem ?? undefined} placeholder="e.g. Home renovation" />
      <TextField
        label="Key"
        required
        value={shownKey}
        onChange={(e) => { setKeyTouched(true); setKey(keyInput(e.target.value)); }}
        hint="Issues are numbered after it: KEY-1, KEY-2… 2–10 letters or digits, a letter first."
        error={keyProblem ?? undefined}
        className="max-w-xs"
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[12px] font-semibold text-ink-subtle">Template</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {BOARD_TEMPLATES.map((t) => (
            <label key={t.id} className={cx('flex cursor-pointer flex-col gap-1 rounded-md border-2 p-3 transition-colors', template === t.id ? 'border-brand bg-brand-subtle' : 'border-line hover:bg-hovered')}>
              <span className="flex items-center gap-2">
                <input type="radio" name="template" value={t.id} checked={template === t.id} onChange={() => setTemplate(t.id)} className="accent-[#0c66e4]" />
                <span className="text-sm font-semibold text-ink">{t.name}</span>
                <span className="ml-auto rounded-[3px] bg-neutral-fill px-1 text-[11px] font-bold uppercase text-ink-subtle">{t.mode}</span>
              </span>
              <span className="text-[12px] text-ink-subtle">{t.description}</span>
              <span className="mt-1 flex flex-wrap gap-1">
                {t.columns.map(([name]) => <span key={name} className="rounded-[3px] bg-white px-1.5 text-[11px] text-ink-subtle ring-1 ring-line">{name}</span>)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-[12px] font-semibold text-ink-subtle">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {BOARD_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className="flex size-8 items-center justify-center rounded-md ring-offset-2 transition-transform hover:scale-105 aria-pressed:ring-2 aria-pressed:ring-brand" style={{ backgroundColor: c }}>
              {color === c && <Check size={16} className="text-white" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </fieldset>
      <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit">Create project</Button>
      </div>
    </form>
  );
}

/**
 * Create project: a name, its key (derived from the name until edited, checked as typed), a
 * template (Kanban, Scrum, Personal, Blank — their columns shown), a colour and a description.
 * `onCreated(board)` gets the new project.
 */
export function CreateProjectDialog({ open, onClose, onCreated }) {
  return (
    <Dialog open={open} onClose={onClose} title="Create project" size="lg">
      {open && <ProjectForm onCreated={onCreated} onClose={onClose} />}
    </Dialog>
  );
}
