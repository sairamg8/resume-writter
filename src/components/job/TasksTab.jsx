import { useState, useRef } from 'react';
import { Plus, CheckSquare } from 'lucide-react';
import { TodoItem } from '@/components/job/TodoItem';
import { addTodo as withTodo, toggleTodo } from '@/utils/jobEdits';
import { visibleDone } from '@/utils/jobQuery';

const DONE_PAGE_SIZE = 5;

export function TasksTab({ todos, onChange }) {
  const [input, setInput] = useState('');
  const [showAllDone, setShowAllDone] = useState(false);
  const inputRef = useRef(null);

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
  function remove(id) { onChange(todos.filter(t => t.id !== id)); }
  function rename(id, text) { onChange(todos.map(t => t.id === id ? { ...t, text } : t)); }

  return (
    <div className="space-y-6">
      {/* Add task */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Add Task</p>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            aria-label="New task"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTodo(input); } }}
            placeholder="New task… (Enter to add)"
            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder-gray-300"
          />
          <button
            onClick={() => addTodo(input)}
            disabled={!input.trim()}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Progress */}
      {todos.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">Progress</span>
            <span className={`text-sm font-bold ${pct === 100 ? 'text-indigo-600' : 'text-gray-500'}`}>
              {done.length} / {todos.length} complete
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-indigo-500' : 'bg-indigo-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct === 100 && (
            <p className="text-xs text-indigo-600 font-semibold mt-2">All tasks complete!</p>
          )}
        </div>
      )}

      {/* Pending tasks */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">To Do</p>
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
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
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
              className="w-full text-xs font-semibold text-indigo-500 hover:text-indigo-700 py-2 rounded-xl border border-dashed border-indigo-200 hover:bg-indigo-50 transition-all"
            >
              {showAllDone ? 'Show fewer' : `Show ${done.length - DONE_PAGE_SIZE} more completed`}
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {todos.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center shadow-sm">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckSquare size={26} className="text-indigo-300" />
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">No tasks yet</p>
          <p className="text-xs text-gray-400">Add tasks to track your progress</p>
        </div>
      )}
    </div>
  );
}
