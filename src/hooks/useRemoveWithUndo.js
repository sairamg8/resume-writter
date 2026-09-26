import { useLayoutEffect, useRef } from 'react';
import { useToast } from '@/components/ui/Toast';

/**
 * `remove(id, title)` for a list edited as a whole (`items` in, `onChange(items)` out): takes the
 * item out at once and shows `title` with Undo, which puts it back where it was — a job's task,
 * an issue's checklist item (R4-DUX-20). Undo inserts into the list as it is when clicked, not as
 * it was at the delete: a task ticked or added meanwhile stays (the item back at its old index,
 * or last when the list is shorter now). No toast outside a ToastProvider: the delete still works.
 */
export function useRemoveWithUndo(items, onChange) {
  const { toast } = useToast();
  // The list and its writer as last rendered, for an Undo clicked after later edits.
  const latest = useRef({ items, onChange });
  useLayoutEffect(() => {
    latest.current = { items, onChange };
  });

  return function remove(id, title) {
    const index = items.findIndex((x) => x.id === id);
    if (index < 0) return;
    const item = items[index];
    onChange(items.filter((x) => x.id !== id));
    toast({
      title,
      action: {
        label: 'Undo',
        onClick: () => {
          const { items: now, onChange: write } = latest.current;
          const rest = now.filter((x) => x.id !== id);
          const at = Math.min(index, rest.length);
          write([...rest.slice(0, at), item, ...rest.slice(at)]);
        },
      },
    });
  };
}
