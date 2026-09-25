import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { Portal } from './Portal.jsx';
import { IconButton } from './IconButton.jsx';
import { FOCUS_RING } from './Button.jsx';
import { cx } from './compose.js';

const DURATION = 5000;
const MAX_VISIBLE = 4;
const EXIT_MS = 150;

const TONES = {
  neutral: null,
  success: { icon: CircleCheck, className: 'text-emerald-600' },
  danger: { icon: CircleAlert, className: 'text-red-600' },
  warning: { icon: TriangleAlert, className: 'text-amber-600' },
  info: { icon: Info, className: 'text-sky-600' },
};

/**
 * One notification. Counts down its `duration` while the stack is not `paused` (hovered or
 * focused), keeping what is left across pauses, then asks to be dismissed.
 */
export function Toast({ toast, paused, onDismiss }) {
  const { id, title, description, action, tone = 'neutral', duration = DURATION, leaving } = toast;
  const remaining = useRef(duration);
  useEffect(() => {
    if (paused || leaving || !Number.isFinite(duration) || duration <= 0) return undefined;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - started));
    };
  }, [paused, leaving, duration, id, onDismiss]);

  const Icon = TONES[tone]?.icon;
  return (
    <div
      data-toast=""
      className={cx(
        'pointer-events-auto flex w-full items-start gap-3 rounded-xl bg-white p-3 pr-2 shadow-lg ring-1 ring-slate-900/10',
        leaving ? 'animate-ui-fade-out' : 'animate-ui-toast-in',
      )}
    >
      {Icon && <Icon size={18} className={cx('mt-px shrink-0', TONES[tone].className)} aria-hidden="true" />}
      <div className="min-w-0 flex-1 py-px">
        {title && <p className="text-[13px] font-semibold leading-5 text-slate-900">{title}</p>}
        {description && <p className="mt-0.5 text-[13px] leading-5 text-slate-600">{description}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={() => { action.onClick?.(); onDismiss(id); }}
          className={cx('shrink-0 rounded-md px-2 py-1 text-[13px] font-semibold text-brand transition-colors hover:bg-brand-subtle hover:text-brand', FOCUS_RING)}
        >
          {action.label}
        </button>
      )}
      <IconButton icon={X} label="Dismiss notification" size="sm" tooltip={false} onClick={() => onDismiss(id)} className="-my-0.5" />
    </div>
  );
}

const ToastContext = createContext(null);
const NOOP = Object.freeze({ toast: () => null, dismiss: () => {} });

/**
 * The notification stack: bottom-right on a desktop, bottom-centre on a phone, newest at the
 * bottom, at most four (the oldest goes first). The stack is a polite live region (role="status",
 * not atomic), always in the page so screen readers announce each toast as it is added. Hovering or focusing it
 * pauses every countdown, so an Undo is never snatched away under the pointer.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [paused, setPaused] = useState(false);
  const seq = useRef(0);
  const timers = useRef(new Set());

  const remove = useCallback((id) => {
    setToasts((list) => list.map((t) => (t.id === id && !t.leaving ? { ...t, leaving: true } : t)));
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setToasts((list) => list.filter((t) => t.id !== id));
    }, EXIT_MS);
    timers.current.add(timer);
  }, []);

  const toast = useCallback((options = {}) => {
    seq.current += 1;
    const id = options.id ?? `toast-${seq.current}`;
    setToasts((list) => {
      const next = [...list.filter((t) => t.id !== id), { ...options, id, leaving: false }];
      const live = next.filter((t) => !t.leaving);
      const overflow = live.length - MAX_VISIBLE;
      return overflow > 0 ? next.filter((t) => !live.slice(0, overflow).includes(t)) : next;
    });
    return id;
  }, []);

  useEffect(() => () => { for (const timer of timers.current) clearTimeout(timer); }, []);
  const value = useMemo(() => ({ toast, dismiss: remove }), [toast, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Portal>
        {/* role="status" is atomic by default — a new toast would re-read every toast still up. */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="false"
          aria-label="Notifications"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}
          className="pointer-events-none fixed inset-x-4 bottom-4 z-[90] flex flex-col items-center gap-2 md:inset-x-auto md:right-6 md:bottom-6 md:w-[360px] md:items-stretch"
        >
          {toasts.map((t) => (
            <Toast key={t.id} toast={t} paused={paused} onDismiss={remove} />
          ))}
        </div>
      </Portal>
    </ToastContext.Provider>
  );
}

/**
 * `const { toast, dismiss } = useToast();` then
 * `toast({ title, description, tone, action: { label: 'Undo', onClick }, duration })` → its id.
 * `tone`: 'neutral' (default) | 'success' | 'danger' | 'warning' | 'info'; `duration` in ms
 * (5000; Infinity keeps it until dismissed); passing an existing `id` replaces that toast.
 * Outside a ToastProvider it does nothing (a toast is never essential).
 */
export function useToast() {
  return useContext(ToastContext) ?? NOOP;
}
