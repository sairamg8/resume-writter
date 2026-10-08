import { cx } from './compose.js';

/**
 * What a list shows when there is nothing in it — and what to do about it.
 *
 * - `icon`: a lucide component in a soft circle; `title`; `description` (the body text);
 *   `action`: the main button; `secondaryAction`: a second one (Import…).
 * - `size`: 'md' (a page, default) | 'sm' (a column, a panel); `bordered` draws a dashed frame.
 */
export function EmptyState({ icon: Icon, title, description, action, secondaryAction, size = 'md', bordered = false, className, children }) {
  const small = size === 'sm';
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center text-center',
        small ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        bordered && 'rounded-xl border border-dashed border-cv-field bg-cv-surface',
        className,
      )}
    >
      {Icon && (
        <span className={cx('flex items-center justify-center rounded-full bg-cv-sunken text-cv-faint', small ? 'size-10' : 'size-12')} aria-hidden="true">
          <Icon size={small ? 18 : 22} />
        </span>
      )}
      {title && <h3 className={cx('font-semibold text-cv-ink', small ? 'text-sm' : 'text-[15px]')}>{title}</h3>}
      {description && <p className={cx('max-w-sm text-cv-faint', small ? 'text-[13px] leading-5' : 'text-sm leading-6')}>{description}</p>}
      {children}
      {(action || secondaryAction) && (
        <div className={cx('flex flex-wrap items-center justify-center gap-2', small ? 'mt-1' : 'mt-2')}>
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
