import { useState } from 'react';
import { CheckSquare, Trash2 } from 'lucide-react';
import { IconButton, InlineEdit, ProgressBar, isImeKey } from '@/components/ui';
import { newId } from '@/utils/ids';
import { useRemoveWithUndo } from '@/hooks/useRemoveWithUndo';

/**
 * An issue's checklist, as the issue view shows it: a progress bar ("2 of 5 done"), each item
 * with its tick, its text (click to rename) and a delete (with Undo); a field to add the next one (Enter adds
 * and stays, Escape leaves). `items` in, `onChange(items)` out — the store records the change.
 */
export function IssueChecklist({ items = [], onChange, autoFocus = false }) {
  const [text, setText] = useState('');
  const done = items.filter((c) => c.done).length;
  // A delete is one click, so it offers Undo, as an issue's own delete does (R4-DUX-20).
  const remove = useRemoveWithUndo(items, onChange);
  const set = (id, patch) => onChange(items.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  function add() {
    const t = text.trim();
    if (!t) return;
    onChange([...items, { id: newId('chk'), text: t, done: false }]);
    setText('');
  }

  return (
    <section aria-labelledby="issue-checklist-heading" className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <h3 id="issue-checklist-heading" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <CheckSquare size={16} aria-hidden="true" className="text-ink-subtle" /> Checklist
        </h3>
        {items.length > 0 && <span className="text-[12px] text-ink-subtlest">{done} of {items.length} done</span>}
      </div>
      {items.length > 0 && (
        <ProgressBar value={done} max={items.length} autoTone label="Checklist progress" valueText={`${done} of ${items.length} done`} />
      )}
      {items.length > 0 && (
        <ul className="flex flex-col divide-y divide-line-subtle rounded-md border border-line">
          {items.map((c) => (
            <li key={c.id} className="group flex items-center gap-2 px-2 py-1">
              <input
                type="checkbox"
                checked={c.done}
                onChange={(e) => set(c.id, { done: e.target.checked })}
                aria-label={`Done: ${c.text}`}
                className="size-4 shrink-0 accent-[#0c66e4]"
              />
              {/* min-w-0 lets the text shrink below its longest word (a flex item will not, by
                  default) and break-words wraps that word at the row's edge: a pasted URL stays in
                  its row instead of pushing the issue view sideways. */}
              <InlineEdit
                value={c.text}
                onCommit={(next) => set(c.id, { text: next })}
                label="Checklist item"
                className={`min-w-0 flex-1 break-words text-sm ${c.done ? 'text-ink-subtlest line-through' : 'text-ink'}`}
              />
              <IconButton
                icon={Trash2}
                label={`Delete “${c.text}”`}
                size="sm"
                variant="danger"
                onClick={() => remove(c.id, 'Checklist item deleted')}
                className="opacity-0 group-hover:opacity-100 no-hover:opacity-100 focus-visible:opacity-100"
              />
            </li>
          ))}
        </ul>
      )}
      <input
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // While an input method (Chinese, Japanese, Korean) is composing, Enter picks the word
          // and Escape drops it: the keystroke is the IME's, not an add.
          if (isImeKey(e)) return;
          if (e.key === 'Enter') { e.preventDefault(); add(); }
          if (e.key === 'Escape' && text) { e.stopPropagation(); setText(''); }
        }}
        onBlur={add}
        placeholder="Add an item (Enter to add)"
        aria-label="Add a checklist item"
        className="h-8 rounded border border-transparent bg-transparent px-2 text-sm text-ink placeholder:text-ink-subtlest transition-colors hover:bg-neutral-fill focus:border-brand focus:bg-white focus:outline-none"
      />
    </section>
  );
}
