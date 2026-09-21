import { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';

/**
 * The "Add a card" composer at the foot of a list: a button until opened, then a textarea that
 * adds on Enter (Shift+Enter for a newline) and stays open to add several in a row. Escape closes.
 */
export function AddCard({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const ref = useRef(null);

  useEffect(() => { if (open) ref.current?.focus(); }, [open]);

  function add() {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
    ref.current?.focus();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-lg transition-colors"
      >
        <Plus size={13} /> Add a card
      </button>
    );
  }

  return (
    <div className="mt-1">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); }
          if (e.key === 'Escape') { setOpen(false); setText(''); }
        }}
        placeholder="Card title… (Enter to add)"
        aria-label="Card title"
        className="w-full text-sm p-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
      />
      <div className="flex items-center gap-2 mt-1">
        <button onClick={add} className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Add card</button>
        <button onClick={() => { setOpen(false); setText(''); }} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Cancel">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
