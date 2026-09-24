import { Field, controlClass, useFieldIds } from './Field.jsx';
import { cx } from './compose.js';

/**
 * A labelled text input. Every native <input> prop passes through (`value`, `onChange(event)`,
 * `type`, `placeholder`, `required`, `autoFocus`, `ref`…).
 *
 * - `label`, `hint`, `error` (a message: the field turns red, aria-invalid, and the message is
 *   read with the field); `required` adds a *.
 * - `leadingIcon`: a lucide component drawn inside on the left; `trailing`: a node inside on the
 *   right (a unit, a small button).
 * - `size`: 'sm' (32 px) | 'md' (36 px, default); 44 px and 16 px text on touch screens.
 * - `className` styles the wrapper; `inputClassName` the <input>.
 */
export function TextField({
  id, label, hint, error, required, leadingIcon: LeadingIcon, trailing, size = 'md', className, inputClassName,
  labelClassName, ref, ...rest
}) {
  const ids = useFieldIds(id, { hint, error });
  return (
    <Field ids={ids} label={label} hint={hint} error={error} required={required} className={className} labelClassName={labelClassName}>
      <div className="relative flex items-center">
        {LeadingIcon && (
          <LeadingIcon size={16} aria-hidden="true" className="pointer-events-none absolute left-2.5 text-slate-400" />
        )}
        <input
          ref={ref}
          id={ids.controlId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          className={cx(
            controlClass({ invalid: !!error, size }),
            size === 'sm' ? 'h-8 pointer-coarse:h-11' : 'h-9 pointer-coarse:h-11',
            LeadingIcon ? 'pl-8' : 'pl-3',
            trailing ? 'pr-9' : 'pr-3',
            inputClassName,
          )}
          {...rest}
        />
        {trailing && <div className="absolute right-1.5 flex items-center">{trailing}</div>}
      </div>
    </Field>
  );
}
