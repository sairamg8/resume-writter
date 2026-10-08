import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useBoardStore } from '@/hooks/useBoardStore';
import { Button, Dialog, TextArea, TextField, cx, useConfirmOptional } from '@/components/ui';
import { BOARD_COLORS, BOARD_TEMPLATES } from '@/constants/boards';
import { deriveKey, keyInput } from '@/utils/boardModel';

/** The form, fresh each time the dialog opens. */
function ProjectForm({ onCreated, onClose, typedRef }) {
  const store = useBoardStore();
  const [title, setTitle] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [template, setTemplate] = useState('kanban');
  const [color, setColor] = useState(BOARD_COLORS[store.boards.length % BOARD_COLORS.length]);
  const [description, setDescription] = useState('');
  const [tried, setTried] = useState(false);
  // One project per opening: the project's board opens as a transition, so this dialog stays open,
  // and its button live, while the board's code loads — the second click of a double-click (or a
  // second Enter) made a second project, keyed HR2.
  const made = useRef(false);
  const shownKey = keyTouched ? key : (title.trim() ? deriveKey(title, store.boards.map((b) => b.key)) : '');
  const keyProblem = shownKey ? store.keyError(shownKey) : null;
  const nameProblem = tried && !title.trim() ? 'A project needs a name.' : null;
  // Tells the dialog whether closing it would throw typed words away (a name, a key or a description).
  useEffect(() => {
    typedRef.current = Boolean(title.trim() || (keyTouched && key) || description.trim());
    return () => { typedRef.current = false; };
  });

  function submit(e) {
    e.preventDefault();
    setTried(true);
    if (made.current || !title.trim() || keyProblem) return;
    made.current = true;
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
        <legend className="mb-1.5 text-[12px] font-semibold text-cv-muted">Template</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {BOARD_TEMPLATES.map((t) => (
            <label key={t.id} className={cx('flex cursor-pointer flex-col gap-1 rounded-cv-control border-2 p-3 transition-colors', template === t.id ? 'border-cv-brand bg-cv-brand-soft' : 'border-cv-hairline hover:bg-cv-stage')}>
              <span className="flex items-center gap-2">
                <input type="radio" name="template" value={t.id} checked={template === t.id} onChange={() => setTemplate(t.id)} className="accent-[#0c66e4]" />
                <span className="text-sm font-semibold text-cv-ink">{t.name}</span>
                <span className="ml-auto rounded-[3px] bg-cv-sunken px-1 text-[11px] font-bold uppercase text-cv-muted">{t.mode}</span>
              </span>
              <span className="text-[12px] text-cv-muted">{t.description}</span>
              <span className="mt-1 flex flex-wrap gap-1">
                {t.columns.map(([name]) => <span key={name} className="rounded-[3px] bg-cv-surface px-1.5 text-[11px] text-cv-muted ring-1 ring-cv-hairline">{name}</span>)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-[12px] font-semibold text-cv-muted">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {BOARD_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className="flex size-8 items-center justify-center rounded-cv-control ring-offset-2 transition-transform hover:scale-105 aria-pressed:ring-2 aria-pressed:ring-cv-brand" style={{ backgroundColor: c }}>
              {color === c && <Check size={16} className="text-white" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </fieldset>
      <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <div className="flex justify-end gap-2 border-t border-cv-hairline pt-4">
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
  const confirm = useConfirmOptional();
  const typedRef = useRef(false);
  const askingRef = useRef(false);
  // Escape and a click beside the dialog are easy to hit by accident: with a name, a key or a
  // description typed, they ask before throwing it away. Cancel and the X close at once.
  const dismiss = async (reason) => {
    if ((reason === 'escape' || reason === 'overlay') && typedRef.current) {
      if (askingRef.current) return;
      askingRef.current = true;
      const discard = await confirm({ title: 'Discard this project?', body: 'What you typed will be lost.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', tone: 'danger' });
      askingRef.current = false;
      if (!discard) return;
    }
    onClose();
  };
  return (
    <Dialog open={open} onClose={dismiss} title="Create project" size="lg">
      {open && <ProjectForm onCreated={onCreated} onClose={onClose} typedRef={typedRef} />}
    </Dialog>
  );
}
