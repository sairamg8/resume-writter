import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Dialog } from './Dialog.jsx';
import { Button } from './Button.jsx';

/**
 * A yes/no question in a small alert dialog — the kit's replacement for window.confirm.
 *
 * - `open`, `title`, `body` (text or node), `confirmLabel` ('Confirm'), `cancelLabel` ('Cancel').
 * - `tone`: 'danger' (a red confirm button and a warning icon; focus starts on Cancel, so a stray
 *   Enter never deletes) or 'default' (focus starts on the confirm button).
 * - `onConfirm()`, `onCancel()` — Cancel, Escape, the X and the overlay all cancel. `busy` shows a
 *   spinner on the confirm button while the caller works.
 */
export function ConfirmDialog({
  open, title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default', busy = false,
  onConfirm, onCancel,
}) {
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const danger = tone === 'danger';
  return (
    <Dialog
      open={open}
      onClose={() => onCancel?.()}
      role="alertdialog"
      size="sm"
      title={title}
      initialFocusRef={danger ? cancelRef : confirmRef}
      hideClose
      footer={(
        <>
          <Button ref={cancelRef} variant="secondary" onClick={() => onCancel?.()} disabled={busy}>{cancelLabel}</Button>
          <Button ref={confirmRef} variant={danger ? 'danger' : 'primary'} onClick={() => onConfirm?.()} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      )}
    >
      {(body || danger) && (
        <div className="flex gap-3">
          {danger && (
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600" aria-hidden="true">
              <TriangleAlert size={16} />
            </span>
          )}
          {body && <div className="min-w-0 pt-1 text-sm leading-6 text-slate-600">{body}</div>}
        </div>
      )}
    </Dialog>
  );
}

const ConfirmContext = createContext(null);

/**
 * The confirm host: mounted once (WorkspaceLayout does it) so any component can ask through
 * useConfirm(). Questions asked while one is open wait their turn; one still open when the host
 * goes away is answered false.
 */
export function ConfirmProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const latest = useRef(queue);
  useEffect(() => { latest.current = queue; });
  const seq = useRef(0);
  const timers = useRef(new Set());

  const confirm = useCallback((options = {}) => new Promise((resolve) => {
    seq.current += 1;
    setQueue((q) => [...q, { ...options, id: seq.current, resolve, closing: false }]);
  }), []);

  const current = queue[0];
  const answer = (value) => {
    // A double click answers once: the question is already on its way out.
    if (!current || current.closing) return;
    current.resolve(value);
    setQueue((q) => (q[0] === current ? [{ ...current, closing: true }, ...q.slice(1)] : q));
    // Let it animate out (Dialog: 150 ms) before the next question, if any, takes its place.
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setQueue((q) => q.filter((item) => item.id !== current.id));
    }, 160);
    timers.current.add(timer);
  };

  useEffect(() => () => {
    for (const q of latest.current) q.resolve(false);
    for (const timer of timers.current) clearTimeout(timer); // gone: nothing left to animate out
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {current && (
        <ConfirmDialog
          key={current.id}
          open={!current.closing}
          title={current.title ?? 'Are you sure?'}
          body={current.body}
          confirmLabel={current.confirmLabel}
          cancelLabel={current.cancelLabel}
          tone={current.tone}
          onConfirm={() => answer(true)}
          onCancel={() => answer(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

/**
 * `const confirm = useConfirm();` then `if (await confirm({ title, body, confirmLabel, tone: 'danger' }))`
 * — resolves true on confirm, false on cancel. Needs a ConfirmProvider above (the workspace shell
 * has one); without it this throws, rather than silently answering for the user.
 */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm() needs a <ConfirmProvider> above it (WorkspaceLayout mounts one).');
  return confirm;
}
