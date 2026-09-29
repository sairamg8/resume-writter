import { useState, useRef } from 'react';
import { Plus, CheckSquare } from 'lucide-react';
import { TodoItem } from '@/components/job/TodoItem';
import { addTodo as withTodo, toggleTodo } from '@/utils/jobEdits';
import { visibleDone } from '@/utils/jobQuery';
import { isImeKey } from '@/components/ui/compose';
import { IconButton, controlClass, cx } from '@/components/ui';
import { useRemoveWithUndo } from '@/hooks/useRemoveWithUndo';

const DONE_PAGE_SIZE = 5;

export function TasksTab({ todos, onChange, readNow }) {
  const [input, setInput] = useState('');
  const [showAllDone, setShowAllDone] = useState(false);
  const inputRef = useRef(null);
  // A delete is one click, so it offers Undo, as a job's own delete does (R4-DUX-20).
  // `readNow()` gives the tasks as stored now, for an Undo clicked after this tab unmounted.
  const removeWithUndo = useRemoveWithUndo(todos, onChange, readNow);

  const pending = todos.filter(t => !t.done);
  // Newest completed first: the task just ticked never hides behind 'Show more' (J-27).
  const done = visibleDone(todos);
  const shownDone = showAllDone ? done : done.slice(0, DONE_PAGE_SIZE);
  const pct = todos.length ? Math.round((done.length / todos.length) * 100) : 0;

  // A text another task has — even a done one — is added: it was ignored without a word (J-26).
  function addTodo(text) {
    const next = withTodo(todos, text);
    if (next === todos) return;
    onChange(next);
    setInput('');
    inputRef.current?.focus();
  }

  function toggle(id) { onChange(toggleTodo(todos, id)); }
  function remove(id) { removeWithUndo(id, 'Task deleted'); }
  function rename(id, text) { onChange(todos.map(t => t.id === id ? { ...t, text } : t)); }

  return (
    <div className="space-y-6">
      {/* Add task */}
      <div className="bg-white rounded-md border border-line p-4 shadow-sm">
        {/* The job page's card and section headings, as its Details box and this tab's Progress card
            draw theirs: they were 10 px bold capitals (R4-DVIS-09). */}
        <p className="text-sm font-semibold text-ink mb-3">Add Task</p>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            aria-label="New task"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !isImeKey(e)) { e.preventDefault(); addTodo(input); } }}
            placeholder="New task… (Enter to add)"
            // The kit's text box, as TextField draws it: 36 px tall (44 on a touch screen), and 16 px text
            // on touch, as iOS Safari zooms the page into any smaller field it focuses (J-38). It and its
            // button were a hand-sized 42 px beside the kit's 32–36 px controls.
            className={cx(controlClass(), 'h-9 pointer-coarse:h-11 min-w-0 flex-1 px-3')}
          />
          {/* The kit's 36 px icon button, level with the box on a touch screen too. */}
          <IconButton
            icon={Plus}
            label="Add task"
            variant="primary"
            size="lg"
            tooltip={false}
            className="pointer-coarse:size-11"
            onClick={() => addTodo(input)}
            disabled={!input.trim()}
          />
        </div>
      </div>

      {/* Progress */}
      {todos.length > 0 && (
        <div className="bg-white rounded-md border border-line p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-ink">Progress</span>
            <span className={`text-sm font-bold ${pct === 100 ? 'text-brand' : 'text-ink-subtle'}`}>
              {done.length} / {todos.length} complete
            </span>
          </div>
          <div className="w-full h-2.5 bg-neutral-fill rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-brand' : 'bg-indigo-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct === 100 && (
            <p className="text-xs text-brand font-semibold mt-2">All tasks complete!</p>
          )}
        </div>
      )}

      {/* Pending tasks */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink px-1">To Do</p>
          <div className="space-y-2">
            {pending.map(t => (
              <TodoItem
                key={t.id}
                todo={t}
                onToggle={() => toggle(t.id)}
                onDelete={() => remove(t.id)}
                onRename={text => rename(t.id, text)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Done tasks */}
      {done.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink px-1">
            Completed ({done.length})
          </p>
          <div className="space-y-2">
            {shownDone.map(t => (
              <TodoItem
                key={t.id}
                todo={t}
                onToggle={() => toggle(t.id)}
                onDelete={() => remove(t.id)}
                onRename={text => rename(t.id, text)}
              />
            ))}
          </div>
          {done.length > DONE_PAGE_SIZE && (
            <button
              onClick={() => setShowAllDone(v => !v)}
              className="w-full text-xs font-semibold text-brand hover:text-brand py-2 rounded-md border border-dashed border-brand-subtle-hover hover:bg-brand-subtle transition-all"
            >
              {showAllDone ? 'Show fewer' : `Show ${done.length - DONE_PAGE_SIZE} more completed`}
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {todos.length === 0 && (
        <div className="bg-white rounded-md border border-line py-12 text-center shadow-sm">
          <div className="w-14 h-14 bg-brand-subtle rounded-md flex items-center justify-center mx-auto mb-4">
            <CheckSquare size={26} className="text-indigo-300" />
          </div>
          <p className="text-sm font-medium text-ink-subtle mb-1">No tasks yet</p>
          <p className="text-xs text-ink-subtlest">Add tasks to track your progress</p>
        </div>
      )}
    </div>
  );
}
